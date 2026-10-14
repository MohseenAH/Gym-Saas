-- ==============================================================================
-- Migration: 20260912000001_production_security_and_performance_hardening.sql
-- Description: Production Security Hardening & Performance Optimization
-- Scope:
--   1. Secure mutable search_path on trigger, stats, and auth helper functions.
--   2. Enforce explicit function permissions (REVOKE from PUBLIC, GRANT to authenticated).
--   3. Optimize auth.uid() evaluation in security definer functions to initPlan (SELECT auth.uid()).
--   4. Add database-enforced atomic payment idempotency column and unique index.
--   5. Add composite performance indexes for dashboard, reports, ledger, and kiosk queries.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEARCH_PATH SECURITY HARDENING & PERMISSIONS
-- ------------------------------------------------------------------------------

-- 1.1 Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;

-- 1.2 Fix get_owner_dashboard_stats search_path and authorization check
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats(p_branch_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_active_members integer;
  v_active_memberships integer;
  v_today_attendance integer;
  v_monthly_revenue numeric;
  v_pending_payments numeric;
  v_expiring_memberships integer;
BEGIN
  v_caller_id := (SELECT auth.uid());
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify branch belongs to authenticated user with authorized role
  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    JOIN public.gym_users gu ON gu.gym_id = b.gym_id
    LEFT JOIN public.user_branch_access uba ON uba.gym_user_id = gu.id AND uba.branch_id = b.id
    WHERE b.id = p_branch_id
      AND gu.user_id = v_caller_id
      AND gu.status = 'active'
      AND (
        gu.role IN ('owner', 'partner')
        OR (gu.role IN ('manager', 'staff') AND uba.branch_id = p_branch_id)
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized branch access';
  END IF;

  -- Total active members in branch
  SELECT count(*)
  INTO v_active_members
  FROM public.members
  WHERE branch_id = p_branch_id
    AND status = 'active';

  -- Active memberships
  SELECT count(*)
  INTO v_active_memberships
  FROM public.memberships m
  JOIN public.members mem ON mem.id = m.member_id
  WHERE mem.branch_id = p_branch_id
    AND m.status = 'active';

  -- Today's attendance
  SELECT count(*)
  INTO v_today_attendance
  FROM public.attendance
  WHERE branch_id = p_branch_id
    AND (
      check_in_date = CURRENT_DATE
      OR (checked_in_at >= CURRENT_DATE AND checked_in_at < CURRENT_DATE + interval '1 day')
    );

  -- Current month's paid revenue
  SELECT coalesce(sum(amount), 0)
  INTO v_monthly_revenue
  FROM public.payments
  WHERE branch_id = p_branch_id
    AND payment_status IN ('paid', 'partial')
    AND payment_date >= date_trunc('month', CURRENT_DATE)::date;

  -- Pending dues estimate
  v_pending_payments := 0;

  -- Expiring in next 7 days
  SELECT count(*)
  INTO v_expiring_memberships
  FROM public.memberships m
  JOIN public.members mem ON mem.id = m.member_id
  WHERE mem.branch_id = p_branch_id
    AND m.status = 'active'
    AND m.end_date >= CURRENT_DATE
    AND m.end_date <= CURRENT_DATE + interval '7 days';

  RETURN json_build_object(
    'active_members', v_active_members,
    'active_memberships', v_active_memberships,
    'today_attendance', v_today_attendance,
    'monthly_revenue', v_monthly_revenue,
    'pending_payments', v_pending_payments,
    'expiring_memberships', v_expiring_memberships
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_dashboard_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats(uuid) TO authenticated;

-- 1.3 Fix get_owner_subscription search_path and authorization
CREATE OR REPLACE FUNCTION public.get_owner_subscription()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account record;
  v_caller_id uuid;
BEGIN
  v_caller_id := (SELECT auth.uid());
  IF v_caller_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    id,
    subscription_status,
    subscription_plan,
    trial_ends_at,
    grace_period_ends_at,
    subscription_tier
  INTO v_account
  FROM public.accounts
  WHERE owner_id = v_caller_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'account_id', v_account.id,
    'status', v_account.subscription_status,
    'plan', coalesce(v_account.subscription_plan, v_account.subscription_tier, 'trial'),
    'trial_ends_at', v_account.trial_ends_at,
    'grace_period_ends_at', v_account.grace_period_ends_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_subscription() TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. AUTH.UID() INITPLAN OPTIMIZATION IN SECURITY DEFINER HELPERS
-- ------------------------------------------------------------------------------

-- 2.1 has_account_role: wrap auth.uid() in (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.has_account_role(p_account_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.gyms g
    JOIN public.gym_users gu ON gu.gym_id = g.id
    WHERE g.account_id = p_account_id
      AND gu.user_id = (SELECT auth.uid())
      AND gu.status = 'active'
      AND gu.role = ANY(p_roles)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_account_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_account_role(uuid, text[]) TO authenticated;

-- 2.2 has_branch_role: wrap auth.uid() in (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.has_branch_role(p_branch_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.branches b
    JOIN public.gym_users gu ON gu.gym_id = b.gym_id
    LEFT JOIN public.user_branch_access uba ON uba.gym_user_id = gu.id AND uba.branch_id = b.id
    WHERE b.id = p_branch_id
      AND gu.user_id = (SELECT auth.uid())
      AND gu.status = 'active'
      AND gu.role = ANY(p_roles)
      AND (
        gu.role IN ('owner', 'partner')
        OR (gu.role IN ('manager', 'staff', 'trainer') AND uba.branch_id = p_branch_id)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_branch_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_branch_role(uuid, text[]) TO authenticated;

-- 2.3 get_user_gym_ids: wrap auth.uid() in (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_gym_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT gym_id
  FROM public.gym_users
  WHERE user_id = (SELECT auth.uid())
    AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_gym_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_gym_ids() TO authenticated;

-- 2.4 has_gym_role: wrap auth.uid() in (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.has_gym_role(p_gym_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.gym_users
    WHERE gym_id = p_gym_id
      AND user_id = (SELECT auth.uid())
      AND status = 'active'
      AND role = ANY(p_roles)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_gym_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_gym_role(uuid, text[]) TO authenticated;

-- 2.5 has_branch_access: wrap auth.uid() in (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.has_branch_access(p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.branches b
    JOIN public.gym_users gu ON gu.gym_id = b.gym_id
    LEFT JOIN public.user_branch_access uba ON uba.gym_user_id = gu.id AND uba.branch_id = b.id
    WHERE b.id = p_branch_id
      AND gu.user_id = (SELECT auth.uid())
      AND gu.status = 'active'
      AND (
        gu.role IN ('owner', 'partner')
        OR (gu.role IN ('manager', 'staff', 'trainer') AND uba.branch_id = p_branch_id)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_branch_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_branch_access(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. PAYMENT IDEMPOTENCY & COMPOSITE PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

-- 3.1 Payments: Database-enforced idempotency column & unique index
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_gym_idempotency_idx
  ON public.payments (gym_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3.2 Payments: Fast lookup for dashboard collections and payments ledger
CREATE INDEX IF NOT EXISTS payments_gym_date_idx
  ON public.payments (gym_id, payment_date DESC);

-- 3.3 Expenses: Fast lookup for dashboard net cash flow
CREATE INDEX IF NOT EXISTS expenses_gym_date_idx
  ON public.expenses (gym_id, expense_date DESC);

-- 3.4 Members: Fast filtered directory and active member counter
CREATE INDEX IF NOT EXISTS members_branch_status_idx
  ON public.members (branch_id, status);

-- 3.5 Memberships: 7-day expiring alert roster
CREATE INDEX IF NOT EXISTS memberships_status_end_date_idx
  ON public.memberships (status, end_date);

-- 3.6 Attendance: Daily check-in kiosk and dashboard stream
CREATE INDEX IF NOT EXISTS attendance_branch_checkin_date_idx
  ON public.attendance (branch_id, check_in_date DESC);
