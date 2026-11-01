-- ============================================================================
-- Migration: Member Portal UPI Pending Payments RLS Policy
-- Date: 2026-11-01
-- Description: Allows authenticated members to record pending UPI payment claims
-- for their own membership records without granting staff-level payment access.
-- ============================================================================

DROP POLICY IF EXISTS "payments_member_insert_pending" ON public.payments;
CREATE POLICY "payments_member_insert_pending" ON public.payments
  FOR INSERT WITH CHECK (
    payment_status = 'pending' AND
    payment_method = 'upi' AND
    (
      public.is_member_owner(member_id) OR
      EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = public.payments.member_id AND m.user_id = auth.uid()
      )
    )
  );
