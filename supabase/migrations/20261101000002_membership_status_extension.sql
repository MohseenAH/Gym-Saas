-- ============================================================================
-- Migration: Support 'renewed' and 'completed' membership lifecycle statuses
-- Date: 2026-11-01
-- Description: Extends the memberships table status check constraint to support
-- clean contract stacking and transition auditability ('renewed', 'completed').
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_status_check;
  ALTER TABLE public.memberships ADD CONSTRAINT memberships_status_check 
    CHECK (status IN ('active', 'expired', 'frozen', 'cancelled', 'renewed', 'completed'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
