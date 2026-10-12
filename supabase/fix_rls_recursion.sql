-- ============================================================================
-- QUICK FIX: Run this in Supabase SQL Editor to eliminate RLS recursion
-- ============================================================================

-- 1. Fix is_gym_staff and has_branch_access helper functions
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

-- 2. Fix Profiles Policy (Eliminate coworker join recursion)
DROP POLICY IF EXISTS "profiles_select_coworkers" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Fix Gym Users Policies (Zero recursion)
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
