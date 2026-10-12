-- GymApra V2: RLS Policies and Security Definer RPCs
-- Phase 1 Foundation

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.is_gym_staff(p_gym_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE gym_id = p_gym_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_branch_access(p_branch_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_gym_id UUID;
  v_role TEXT;
  v_gym_user_id UUID;
BEGIN
  SELECT gym_id INTO v_gym_id FROM public.branches WHERE id = p_branch_id;
  IF v_gym_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id, role INTO v_gym_user_id, v_role
  FROM public.gym_users
  WHERE gym_id = v_gym_id AND user_id = p_user_id AND status = 'active';

  IF v_gym_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owners and Partners have universal branch access across the gym
  IF v_role IN ('owner', 'partner') THEN
    RETURN TRUE;
  END IF;

  -- Managers, Staff, Trainers require explicit branch access
  RETURN EXISTS (
    SELECT 1 FROM public.user_branch_access
    WHERE gym_user_id = v_gym_user_id AND branch_id = p_branch_id
  );
END;
$$;

-- RLS Policies: Profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_select_coworkers" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gym_users gu1
      JOIN public.gym_users gu2 ON gu1.gym_id = gu2.gym_id
      WHERE gu1.user_id = auth.uid() AND gu2.user_id = public.profiles.id
    )
  );

-- RLS Policies: Accounts
CREATE POLICY "accounts_owner_access" ON public.accounts
  FOR ALL USING (owner_id = auth.uid());

-- RLS Policies: Gyms
CREATE POLICY "gyms_staff_select" ON public.gyms
  FOR SELECT USING (public.is_gym_staff(id));

CREATE POLICY "gyms_member_select" ON public.gyms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m
      JOIN public.branches b ON m.branch_id = b.id
      WHERE b.gym_id = public.gyms.id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "gyms_owner_update" ON public.gyms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.gym_users
      WHERE gym_id = public.gyms.id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- RLS Policies: Branches
CREATE POLICY "branches_select_staff" ON public.branches
  FOR SELECT USING (public.is_gym_staff(gym_id));

CREATE POLICY "branches_select_member" ON public.branches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE branch_id = public.branches.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "branches_manage_owner" ON public.branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.gym_users
      WHERE gym_id = public.branches.gym_id AND user_id = auth.uid() AND role IN ('owner', 'partner')
    )
  );

-- RLS Policies: Gym Users
CREATE POLICY "gym_users_select" ON public.gym_users
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_gym_staff(gym_id)
  );

CREATE POLICY "gym_users_manage_owner" ON public.gym_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.gym_users gu
      WHERE gu.gym_id = public.gym_users.gym_id AND gu.user_id = auth.uid() AND gu.role IN ('owner', 'partner')
    )
  );

-- RLS Policies: User Branch Access
CREATE POLICY "user_branch_access_select" ON public.user_branch_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gym_users gu
      WHERE gu.id = public.user_branch_access.gym_user_id AND (gu.user_id = auth.uid() OR public.is_gym_staff(gu.gym_id))
    )
  );

-- RLS Policies: Members
CREATE POLICY "members_staff_select" ON public.members
  FOR SELECT USING (public.has_branch_access(branch_id));

CREATE POLICY "members_staff_mutate" ON public.members
  FOR ALL USING (public.has_branch_access(branch_id));

CREATE POLICY "members_portal_select" ON public.members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "members_portal_update" ON public.members
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies: Invitations
CREATE POLICY "invitations_staff_manage" ON public.invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.gym_users
      WHERE gym_id = public.invitations.gym_id AND user_id = auth.uid() AND role IN ('owner', 'partner')
    )
  );

-- Security Definer RPC: Single-Step Owner Signup & Provisioning
CREATE OR REPLACE FUNCTION public.create_owner_account_v2(
  p_full_name TEXT,
  p_gym_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_gym_id UUID;
  v_branch_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (v_user_id, p_full_name, p_phone)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      updated_at = now();

  -- Create SaaS account
  INSERT INTO public.accounts (owner_id, subscription_tier)
  VALUES (v_user_id, 'starter')
  RETURNING id INTO v_account_id;

  -- Create Gym
  INSERT INTO public.gyms (account_id, name, phone)
  VALUES (v_account_id, p_gym_name, p_phone)
  RETURNING id INTO v_gym_id;

  -- Create default Main Branch
  INSERT INTO public.branches (gym_id, name)
  VALUES (v_gym_id, 'Main Branch')
  RETURNING id INTO v_branch_id;

  -- Create Owner membership in gym_users
  INSERT INTO public.gym_users (gym_id, user_id, role, status)
  VALUES (v_gym_id, v_user_id, 'owner', 'active');

  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'gym_id', v_gym_id,
    'branch_id', v_branch_id
  );
END;
$$;

-- Security Definer RPC: Public Verification of Invitation Token
CREATE OR REPLACE FUNCTION public.verify_invitation_token_v2(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_gym_name TEXT;
  v_member_name TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
    AND status = 'pending'
    AND expires_at > now();

  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation expired or not found');
  END IF;

  SELECT name INTO v_gym_name FROM public.gyms WHERE id = v_inv.gym_id;

  IF v_inv.type = 'member' AND v_inv.member_id IS NOT NULL THEN
    SELECT full_name INTO v_member_name FROM public.members WHERE id = v_inv.member_id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_inv.id,
    'gym_id', v_inv.gym_id,
    'gym_name', v_gym_name,
    'type', v_inv.type,
    'role', v_inv.role,
    'member_id', v_inv.member_id,
    'member_name', v_member_name,
    'email', v_inv.email,
    'phone', v_inv.phone
  );
END;
$$;

-- Security Definer RPC: Staff Invitation Acceptance
CREATE OR REPLACE FUNCTION public.accept_staff_invitation_v2(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_inv RECORD;
  v_gym_user_id UUID;
  v_branch_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
    AND status = 'pending'
    AND expires_at > now()
    AND type = 'staff';

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired staff invitation';
  END IF;

  -- Create or activate gym_user
  INSERT INTO public.gym_users (gym_id, user_id, role, status)
  VALUES (v_inv.gym_id, v_user_id, v_inv.role, 'active')
  ON CONFLICT (gym_id, user_id) DO UPDATE
  SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING id INTO v_gym_user_id;

  -- Assign branch permissions
  IF v_inv.branch_ids IS NOT NULL AND array_length(v_inv.branch_ids, 1) > 0 THEN
    FOREACH v_branch_id IN ARRAY v_inv.branch_ids
    LOOP
      INSERT INTO public.user_branch_access (gym_user_id, branch_id)
      VALUES (v_gym_user_id, v_branch_id)
      ON CONFLICT (gym_user_id, branch_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Mark invitation accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'gym_id', v_inv.gym_id,
    'role', v_inv.role
  );
END;
$$;

-- Security Definer RPC: Phone-First Member Portal Self-Claim
CREATE OR REPLACE FUNCTION public.accept_member_claim_v2(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_inv RECORD;
  v_member RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token_hash = p_token_hash
    AND status = 'pending'
    AND expires_at > now()
    AND type = 'member';

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired member invitation';
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_inv.member_id;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Member record not found';
  END IF;

  -- Link member record to the claiming authenticated user
  UPDATE public.members
  SET user_id = v_user_id,
      email = COALESCE(public.members.email, v_user_email),
      updated_at = now()
  WHERE id = v_member.id;

  -- Mark invitation accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'gym_id', v_inv.gym_id,
    'member_id', v_member.id
  );
END;
$$;
