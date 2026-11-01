-- ============================================================================
-- Migration: Support 'rejected' payment status for fraudulent/duplicate claims
-- Date: 2026-11-01
-- Description: Extends payments table check constraint to support staff rejection
-- of pending member UPI claims without mutating member dues.
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
  ALTER TABLE public.payments ADD CONSTRAINT payments_payment_status_check 
    CHECK (payment_status IN ('paid', 'partial', 'pending', 'refunded', 'rejected'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
