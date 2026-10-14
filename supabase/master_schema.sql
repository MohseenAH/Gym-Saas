-- ============================================================================
-- GYM SAAS (GYMAPRA V2) — COMPLETE MASTER DATABASE SCHEMA (IDEMPOTENT)
-- Run this entire script in Supabase Dashboard > SQL Editor > Run
-- ============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. DROP EXISTING RPC FUNCTIONS TO PREVENT PARAMETER NAME COLLISION (42P13)
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_owner_account(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_owner_account CASCADE;
DROP FUNCTION IF EXISTS public.create_owner_account_v2 CASCADE;
DROP FUNCTION IF EXISTS public.verify_invitation_token CASCADE;
DROP FUNCTION IF EXISTS public.verify_invitation_token_v2 CASCADE;
DROP FUNCTION IF EXISTS public.accept_invitation CASCADE;
DROP FUNCTION IF EXISTS public.accept_staff_invitation_v2 CASCADE;
DROP FUNCTION IF EXISTS public.accept_member_claim_v2 CASCADE;
DROP FUNCTION IF EXISTS public.is_gym_staff CASCADE;
DROP FUNCTION IF EXISTS public.has_branch_access CASCADE;

-- ============================================================================
-- 2. CORE MULTI-TENANCY & IDENTITY TABLES
-- ============================================================================

-- 2.1 Accounts (SaaS Subscription Account)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subscription_tier TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Gyms (Tenant Business Profile)
CREATE TABLE IF NOT EXISTS public.gyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 Branches (Physical Facilities)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Branch',
    code TEXT,
    address TEXT,
    city TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Gym Users (Staff Roles within a Gym)
CREATE TABLE IF NOT EXISTS public.gym_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'partner', 'manager', 'staff', 'trainer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(gym_id, user_id)
);

-- 2.6 User Branch Access (Staff Branch Permissions)
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_user_id UUID NOT NULL REFERENCES public.gym_users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(gym_user_id, branch_id)
);

-- 2.7 Members (Gym Clients — Linked to Member Portal via user_id)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    avatar_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8 Invitations (Staff Invitations & Member Portal Self-Claim Tokens)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    type TEXT NOT NULL DEFAULT 'staff' CHECK (type IN ('staff', 'member')),
    role TEXT NOT NULL CHECK (role IN ('partner', 'manager', 'staff', 'trainer', 'member')),
    branch_ids UUID[] NOT NULL DEFAULT '{}',
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. OPERATIONAL TABLES (Plans, Memberships, Payments, Expenses, Attendance, Notices)
-- ============================================================================

-- 3.1 Membership Plans
CREATE TABLE IF NOT EXISTS public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Member Memberships (Subscriptions / Contracts)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'frozen', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 3.3 Payments (Revenue Ledger)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'pending', 'refunded')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    idempotency_key TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Expenses (Operational Cost Outflow)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'rent',
        'electricity',
        'salaries',
        'equipment',
        'maintenance',
        'marketing',
        'miscellaneous',
        'other'
    )),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'card', 'cheque', 'other')),
    description TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 Attendance (Daily Check-in Ledger)
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    check_in_method TEXT NOT NULL DEFAULT 'staff_manual' CHECK (check_in_method IN ('staff_manual', 'member_portal', 'kiosk_qr', 'biometric')),
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(member_id, check_in_date)
);

-- 3.6 Notices (Gym Announcements)
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gyms_account_id ON public.gyms(account_id);
CREATE INDEX IF NOT EXISTS idx_branches_gym_id ON public.branches(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_users_user_id ON public.gym_users(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_users_gym_id ON public.gym_users(gym_id);
CREATE INDEX IF NOT EXISTS idx_members_branch_id ON public.members(branch_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_gym_id ON public.invitations(gym_id);
CREATE INDEX IF NOT EXISTS idx_plans_branch_id ON public.membership_plans(branch_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON public.memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_payments_gym_id ON public.payments(gym_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON public.payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE UNIQUE INDEX IF NOT EXISTS payments_gym_idempotency_idx ON public.payments(gym_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_gym_id ON public.expenses(gym_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON public.attendance(branch_id, check_in_date);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_notices_gym_id ON public.notices(gym_id);

-- ============================================================================
-- 5. SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_gym_staff(p_gym_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE gym_id = p_gym_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_branch_access(p_branch_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
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

  IF v_role IN ('owner', 'partner') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_branch_access
    WHERE gym_user_id = v_gym_user_id AND branch_id = p_branch_id
  );
END;
$$;

-- ============================================================================
-- 6. OWNER ONBOARDING RPC (create_owner_account)
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_owner_account(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_owner_account CASCADE;

CREATE OR REPLACE FUNCTION public.create_owner_account(
  p_name TEXT,
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
  VALUES (v_user_id, p_name, p_phone)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      updated_at = now();

  -- Prevent duplicate owner account
  SELECT id INTO v_account_id FROM public.accounts WHERE owner_id = v_user_id LIMIT 1;
  IF v_account_id IS NOT NULL THEN
    SELECT id INTO v_gym_id FROM public.gyms WHERE account_id = v_account_id LIMIT 1;
    SELECT id INTO v_branch_id FROM public.branches WHERE gym_id = v_gym_id LIMIT 1;
    RETURN jsonb_build_object(
      'account_id', v_account_id,
      'gym_id', v_gym_id,
      'branch_id', v_branch_id
    );
  END IF;

  -- Create SaaS account
  INSERT INTO public.accounts (owner_id, subscription_tier)
  VALUES (v_user_id, 'starter')
  RETURNING id INTO v_account_id;

  -- Create Gym
  INSERT INTO public.gyms (account_id, name, phone)
  VALUES (v_account_id, p_gym_name, p_phone)
  RETURNING id INTO v_gym_id;

  -- Create Main Branch
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

-- Alias for v2 signature
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
BEGIN
  RETURN public.create_owner_account(p_full_name, p_gym_name, p_phone);
END;
$$;

-- ============================================================================
-- 7. INVITATION RPCs (verify_invitation_token & accept_invitation)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_invitation_token(p_token_hash TEXT)
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

  IF v_inv.role = 'member' AND v_inv.member_id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_inv RECORD;
  v_gym_user_id UUID;
  v_branch_id UUID;
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
    AND expires_at > now();

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- CASE A: Member Portal Claim
  IF v_inv.role = 'member' THEN
    IF v_inv.member_id IS NULL THEN
      RAISE EXCEPTION 'Member ID missing from invitation';
    END IF;

    UPDATE public.members
    SET user_id = v_user_id,
        email = COALESCE(public.members.email, v_user_email),
        updated_at = now()
    WHERE id = v_inv.member_id;

    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_inv.id;

    RETURN jsonb_build_object('success', true, 'type', 'member', 'gym_id', v_inv.gym_id, 'member_id', v_inv.member_id);
  END IF;

  -- CASE B: Staff Role
  INSERT INTO public.gym_users (gym_id, user_id, role, status)
  VALUES (v_inv.gym_id, v_user_id, v_inv.role, 'active')
  ON CONFLICT (gym_id, user_id) DO UPDATE
  SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING id INTO v_gym_user_id;

  IF v_inv.branch_ids IS NOT NULL AND array_length(v_inv.branch_ids, 1) > 0 THEN
    FOREACH v_branch_id IN ARRAY v_inv.branch_ids
    LOOP
      INSERT INTO public.user_branch_access (gym_user_id, branch_id)
      VALUES (v_gym_user_id, v_branch_id)
      ON CONFLICT (gym_user_id, branch_id) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'type', 'staff', 'gym_id', v_inv.gym_id, 'role', v_inv.role);
END;
$$;

-- Aliases
CREATE OR REPLACE FUNCTION public.verify_invitation_token_v2(p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN public.verify_invitation_token(p_token_hash); END;
$$;

CREATE OR REPLACE FUNCTION public.accept_staff_invitation_v2(p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN public.accept_invitation(p_token_hash); END;
$$;

CREATE OR REPLACE FUNCTION public.accept_member_claim_v2(p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN public.accept_invitation(p_token_hash); END;
$$;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES (SAFE DROP & RECREATE)
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 8.1 Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_coworkers" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- 8.2 Accounts
DROP POLICY IF EXISTS "accounts_owner_all" ON public.accounts;
CREATE POLICY "accounts_owner_all" ON public.accounts FOR ALL USING (owner_id = auth.uid());

-- 8.3 Gyms
DROP POLICY IF EXISTS "gyms_staff_select" ON public.gyms;
CREATE POLICY "gyms_staff_select" ON public.gyms FOR SELECT USING (public.is_gym_staff(id));

DROP POLICY IF EXISTS "gyms_owner_update" ON public.gyms;
CREATE POLICY "gyms_owner_update" ON public.gyms FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.accounts WHERE id = public.gyms.account_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "gyms_member_select" ON public.gyms;
CREATE POLICY "gyms_member_select" ON public.gyms FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.branches b ON m.branch_id = b.id
    WHERE b.gym_id = public.gyms.id AND m.user_id = auth.uid()
  )
);

-- 8.4 Branches
DROP POLICY IF EXISTS "branches_staff_select" ON public.branches;
CREATE POLICY "branches_staff_select" ON public.branches FOR SELECT USING (public.is_gym_staff(gym_id));

DROP POLICY IF EXISTS "branches_owner_all" ON public.branches;
CREATE POLICY "branches_owner_all" ON public.branches FOR ALL USING (public.is_gym_staff(gym_id));

DROP POLICY IF EXISTS "branches_member_select" ON public.branches;
CREATE POLICY "branches_member_select" ON public.branches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.branch_id = public.branches.id AND m.user_id = auth.uid()
  )
);

-- 8.5 Gym Users (Zero-recursion policies)
DROP POLICY IF EXISTS "gym_users_self_select" ON public.gym_users;
CREATE POLICY "gym_users_self_select" ON public.gym_users FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "gym_users_staff_select" ON public.gym_users;

DROP POLICY IF EXISTS "gym_users_owner_all" ON public.gym_users;
CREATE POLICY "gym_users_owner_all" ON public.gym_users FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.gyms g
    JOIN public.accounts a ON g.account_id = a.id
    WHERE g.id = public.gym_users.gym_id AND a.owner_id = auth.uid()
  )
);

-- 8.6 User Branch Access
DROP POLICY IF EXISTS "uba_self_select" ON public.user_branch_access;
CREATE POLICY "uba_self_select" ON public.user_branch_access FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.gym_users gu
    WHERE gu.id = public.user_branch_access.gym_user_id AND gu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "uba_owner_all" ON public.user_branch_access;
CREATE POLICY "uba_owner_all" ON public.user_branch_access FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.gym_users gu_target
    JOIN public.gym_users gu_caller ON gu_target.gym_id = gu_caller.gym_id
    WHERE gu_target.id = public.user_branch_access.gym_user_id
      AND gu_caller.user_id = auth.uid()
      AND gu_caller.role IN ('owner', 'partner')
  )
);

-- 8.7 Members
DROP POLICY IF EXISTS "members_staff_all" ON public.members;
CREATE POLICY "members_staff_all" ON public.members FOR ALL USING (public.has_branch_access(branch_id));

DROP POLICY IF EXISTS "members_own_select" ON public.members;
CREATE POLICY "members_own_select" ON public.members FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "members_own_update" ON public.members;
CREATE POLICY "members_own_update" ON public.members FOR UPDATE USING (user_id = auth.uid());

-- 8.8 Invitations
DROP POLICY IF EXISTS "invitations_staff_all" ON public.invitations;
CREATE POLICY "invitations_staff_all" ON public.invitations FOR ALL USING (public.is_gym_staff(gym_id));

-- 8.9 Membership Plans
DROP POLICY IF EXISTS "plans_staff_all" ON public.membership_plans;
CREATE POLICY "plans_staff_all" ON public.membership_plans FOR ALL USING (public.has_branch_access(branch_id));

DROP POLICY IF EXISTS "plans_members_select" ON public.membership_plans;
CREATE POLICY "plans_members_select" ON public.membership_plans FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.branch_id = public.membership_plans.branch_id AND m.user_id = auth.uid()
  )
);

-- 8.10 Memberships
DROP POLICY IF EXISTS "memberships_staff_all" ON public.memberships;
CREATE POLICY "memberships_staff_all" ON public.memberships FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = public.memberships.member_id AND public.has_branch_access(m.branch_id)
  )
);

DROP POLICY IF EXISTS "memberships_member_select" ON public.memberships;
CREATE POLICY "memberships_member_select" ON public.memberships FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = public.memberships.member_id AND m.user_id = auth.uid()
  )
);

-- 8.11 Payments
DROP POLICY IF EXISTS "payments_staff_all" ON public.payments;
CREATE POLICY "payments_staff_all" ON public.payments FOR ALL USING (public.has_branch_access(branch_id));

DROP POLICY IF EXISTS "payments_member_select" ON public.payments;
CREATE POLICY "payments_member_select" ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = public.payments.member_id AND m.user_id = auth.uid()
  )
);

-- 8.12 Expenses
DROP POLICY IF EXISTS "expenses_staff_all" ON public.expenses;
CREATE POLICY "expenses_staff_all" ON public.expenses FOR ALL USING (public.has_branch_access(branch_id));

-- 8.13 Attendance
DROP POLICY IF EXISTS "attendance_staff_all" ON public.attendance;
CREATE POLICY "attendance_staff_all" ON public.attendance FOR ALL USING (public.has_branch_access(branch_id));

DROP POLICY IF EXISTS "attendance_member_select" ON public.attendance;
CREATE POLICY "attendance_member_select" ON public.attendance FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = public.attendance.member_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attendance_member_insert_own" ON public.attendance;
CREATE POLICY "attendance_member_insert_own" ON public.attendance FOR INSERT WITH CHECK (
  check_in_method = 'member_portal' AND
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = public.attendance.member_id
      AND m.branch_id = public.attendance.branch_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
);

-- 8.14 Notices
DROP POLICY IF EXISTS "notices_staff_all" ON public.notices;
CREATE POLICY "notices_staff_all" ON public.notices FOR ALL USING (public.is_gym_staff(gym_id));

DROP POLICY IF EXISTS "notices_member_select" ON public.notices;
CREATE POLICY "notices_member_select" ON public.notices FOR SELECT USING (
  is_active = true AND
  EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.branches b ON m.branch_id = b.id
    WHERE b.gym_id = public.notices.gym_id
      AND (public.notices.branch_id IS NULL OR public.notices.branch_id = m.branch_id)
      AND m.user_id = auth.uid()
  )
);

-- ============================================================================
-- 9. PERMISSIONS & IMMEDIATE SCHEMA CACHE RELOAD
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Force PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================================================
-- MASTER SCHEMA SETUP COMPLETE
-- ============================================================================
