-- ============================================================================
-- GymApra V2: Production Speed, Zero-Recursion RLS, and Index Optimization
-- Migration: 20261015000001_production_speed_and_rls_fix.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS (Zero RLS Recursion)
-- ----------------------------------------------------------------------------

-- 1.1 Verify if a user is active staff in a gym
CREATE OR REPLACE FUNCTION public.is_gym_staff(p_gym_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_gym_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE gym_id = p_gym_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$;

-- 1.2 Verify if a user is owner/account holder of a gym
CREATE OR REPLACE FUNCTION public.is_gym_owner(p_gym_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_gym_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.gyms g
    JOIN public.accounts a ON g.account_id = a.id
    WHERE g.id = p_gym_id AND a.owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE gym_id = p_gym_id AND user_id = p_user_id AND role IN ('owner', 'partner') AND status = 'active'
  );
END;
$$;

-- 1.3 Verify if a user has access to a specific branch
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
  IF p_branch_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.branches WHERE id = p_branch_id;
  IF v_gym_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check direct gym ownership via accounts table
  IF EXISTS (
    SELECT 1 FROM public.gyms g
    JOIN public.accounts a ON g.account_id = a.id
    WHERE g.id = v_gym_id AND a.owner_id = p_user_id
  ) THEN
    RETURN TRUE;
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

-- 1.4 Helper: Check if member record belongs to authenticated user
CREATE OR REPLACE FUNCTION public.is_member_owner(p_member_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_member_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.members
    WHERE id = p_member_id AND user_id = p_user_id
  );
END;
$$;

-- 1.5 Helper: Get branch_id for a given member_id
CREATE OR REPLACE FUNCTION public.get_member_branch_id(p_member_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT branch_id INTO v_branch_id FROM public.members WHERE id = p_member_id;
  RETURN v_branch_id;
END;
$$;

-- Grant execute permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.is_gym_staff(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_gym_owner(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_branch_access(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_member_owner(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_member_branch_id(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. RECURSION-FREE RLS POLICIES
-- ----------------------------------------------------------------------------

-- 2.1 Profiles (Eliminate coworker join recursion)
DROP POLICY IF EXISTS "profiles_select_coworkers" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2.2 Gym Users (Zero-recursion using security definer helpers)
DROP POLICY IF EXISTS "gym_users_select" ON public.gym_users;
CREATE POLICY "gym_users_select" ON public.gym_users
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_gym_staff(gym_id)
  );

DROP POLICY IF EXISTS "gym_users_manage_owner" ON public.gym_users;
CREATE POLICY "gym_users_manage_owner" ON public.gym_users
  FOR ALL USING (
    public.is_gym_owner(gym_id)
  );

-- 2.3 User Branch Access
DROP POLICY IF EXISTS "user_branch_access_select" ON public.user_branch_access;
CREATE POLICY "user_branch_access_select" ON public.user_branch_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gym_users gu
      WHERE gu.id = public.user_branch_access.gym_user_id
        AND (gu.user_id = auth.uid() OR public.is_gym_owner(gu.gym_id))
    )
  );

-- 2.4 Memberships
DROP POLICY IF EXISTS "memberships_staff_all" ON public.memberships;
CREATE POLICY "memberships_staff_all" ON public.memberships
  FOR ALL USING (
    public.has_branch_access(public.get_member_branch_id(member_id))
  );

DROP POLICY IF EXISTS "memberships_member_select" ON public.memberships;
CREATE POLICY "memberships_member_select" ON public.memberships
  FOR SELECT USING (
    public.is_member_owner(member_id)
  );

-- 2.5 Payments
DROP POLICY IF EXISTS "payments_staff_all" ON public.payments;
CREATE POLICY "payments_staff_all" ON public.payments
  FOR ALL USING (
    public.has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "payments_member_select" ON public.payments;
CREATE POLICY "payments_member_select" ON public.payments
  FOR SELECT USING (
    public.is_member_owner(member_id)
  );

-- 2.6 Attendance
DROP POLICY IF EXISTS "attendance_staff_all" ON public.attendance;
CREATE POLICY "attendance_staff_all" ON public.attendance
  FOR ALL USING (
    public.has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "attendance_member_select" ON public.attendance;
CREATE POLICY "attendance_member_select" ON public.attendance
  FOR SELECT USING (
    public.is_member_owner(member_id)
  );

DROP POLICY IF EXISTS "attendance_member_insert_own" ON public.attendance;
CREATE POLICY "attendance_member_insert_own" ON public.attendance
  FOR INSERT WITH CHECK (
    check_in_method = 'member_portal' AND public.is_member_owner(member_id)
  );

-- ----------------------------------------------------------------------------
-- 3. SCHEMA AUGMENTATION & AUTOMATIC GYM_ID POPULATION TRIGGERS
-- ----------------------------------------------------------------------------

-- Add gym_id to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
UPDATE public.members m SET gym_id = b.gym_id FROM public.branches b WHERE m.branch_id = b.id AND m.gym_id IS NULL;

-- Add gym_id & branch_id to memberships
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;
UPDATE public.memberships ms SET gym_id = m.gym_id, branch_id = m.branch_id FROM public.members m WHERE ms.member_id = m.id AND (ms.gym_id IS NULL OR ms.branch_id IS NULL);

-- Add status column to payments & expenses for uniform status indexing
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';
UPDATE public.payments SET status = payment_status WHERE status IS NULL OR status = 'paid';

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'recorded';

-- Add gym_id & status to attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'checked_in';
UPDATE public.attendance a SET gym_id = b.gym_id FROM public.branches b WHERE a.branch_id = b.id AND a.gym_id IS NULL;

-- Automated triggers to guarantee gym_id is always synced
CREATE OR REPLACE FUNCTION public.sync_gym_id_from_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gym_id IS NULL AND NEW.branch_id IS NOT NULL THEN
    SELECT gym_id INTO NEW.gym_id FROM public.branches WHERE id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_members_gym_id ON public.members;
CREATE TRIGGER trg_sync_members_gym_id
BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.sync_gym_id_from_branch();

DROP TRIGGER IF EXISTS trg_sync_attendance_gym_id ON public.attendance;
CREATE TRIGGER trg_sync_attendance_gym_id
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.sync_gym_id_from_branch();

CREATE OR REPLACE FUNCTION public.sync_memberships_gym_and_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.gym_id IS NULL OR NEW.branch_id IS NULL) AND NEW.member_id IS NOT NULL THEN
    SELECT branch_id, gym_id INTO NEW.branch_id, NEW.gym_id FROM public.members WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_memberships_gym_id ON public.memberships;
CREATE TRIGGER trg_sync_memberships_gym_id
BEFORE INSERT OR UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.sync_memberships_gym_and_branch();

-- ----------------------------------------------------------------------------
-- 4. COMPOSITE INDEXES FOR FAST PAGE LOADS & ZERO TABLE SCANS
-- ----------------------------------------------------------------------------

-- 4.1 Members Indexes
CREATE INDEX IF NOT EXISTS idx_members_gym_branch ON public.members (gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_members_gym_status ON public.members (gym_id, status);
CREATE INDEX IF NOT EXISTS idx_members_gym_created_at ON public.members (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_branch_status ON public.members (branch_id, status);
CREATE INDEX IF NOT EXISTS idx_members_branch_created_at ON public.members (branch_id, created_at DESC);

-- 4.2 Memberships Indexes
CREATE INDEX IF NOT EXISTS idx_memberships_gym_branch ON public.memberships (gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_memberships_gym_status ON public.memberships (gym_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_gym_created_at ON public.memberships (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memberships_member_status ON public.memberships (member_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON public.memberships (end_date DESC);

-- 4.3 Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_gym_branch ON public.payments (gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_gym_status ON public.payments (gym_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_gym_payment_status ON public.payments (gym_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_gym_created_at ON public.payments (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gym_payment_date ON public.payments (gym_id, payment_date DESC);

-- 4.4 Expenses Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_gym_branch ON public.expenses (gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_gym_status ON public.expenses (gym_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_gym_created_at ON public.expenses (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_gym_expense_date ON public.expenses (gym_id, expense_date DESC);

-- 4.5 Attendance Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_gym_branch ON public.attendance (gym_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_status ON public.attendance (gym_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_created_at ON public.attendance (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON public.attendance (branch_id, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON public.attendance (member_id, check_in_date DESC);
