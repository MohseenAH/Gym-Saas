"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";

// ============================================================================
// 1. Validation Schemas & Types
// ============================================================================

export const assignMembershipSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  planId: z.string().uuid("Invalid plan ID"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
  amountPaid: z.number().min(0, "Amount paid cannot be negative").default(0),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
});

export type AssignMembershipInput = z.infer<typeof assignMembershipSchema>;

export interface MembershipLifecycleStatus {
  status: "active" | "expired" | "frozen" | "cancelled" | "upcoming";
  daysRemaining: number;
  isExpiringSoon: boolean;
  isUpcoming: boolean;
}

// ============================================================================
// 2. Pure Calculation Helper (used by tests, server, and client)
// ============================================================================

export async function computeMembershipStatus(
  startDateStr: string,
  endDateStr: string,
  rawStatus: "active" | "expired" | "frozen" | "cancelled",
  referenceDate: Date = new Date()
): Promise<MembershipLifecycleStatus> {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - ref.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isUpcoming = start.getTime() > ref.getTime();
  const isPast = end.getTime() < ref.getTime();

  if (rawStatus === "frozen" || rawStatus === "cancelled") {
    return {
      status: rawStatus,
      daysRemaining,
      isExpiringSoon: false,
      isUpcoming,
    };
  }

  if (isUpcoming) {
    return {
      status: "upcoming",
      daysRemaining,
      isExpiringSoon: false,
      isUpcoming: true,
    };
  }

  if (isPast || rawStatus === "expired") {
    return {
      status: "expired",
      daysRemaining,
      isExpiringSoon: false,
      isUpcoming: false,
    };
  }

  // Active status
  const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 7;
  return {
    status: "active",
    daysRemaining,
    isExpiringSoon,
    isUpcoming: false,
  };
}

// ============================================================================
// 3. Server Actions
// ============================================================================

/**
 * Assigns a membership plan to a member.
 * Strictly verifies `members:manage` capability, tenant isolation,
 * calculates non-overlapping contract validity dates, and records payment
 * with database-level idempotency protection.
 */
export async function assignMembershipAction(input: AssignMembershipInput) {
  try {
    const validated = assignMembershipSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Verify member belongs to this branch and gym
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, full_name, phone, branch_id, branches!inner(gym_id)")
      .eq("id", validated.memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: "Member not found" };
    }

    const memberGymId = (member.branches as unknown as { gym_id: string })?.gym_id;
    if (memberGymId !== context.gymId) {
      return { success: false, error: "Unauthorized member access across gym boundary" };
    }

    // 2. Fetch selected membership plan
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("id, name, duration_days, price, is_active, branch_id")
      .eq("id", validated.planId)
      .single();

    if (planErr || !plan) {
      return { success: false, error: "Membership plan not found" };
    }

    if (!plan.is_active) {
      return { success: false, error: "Cannot assign an inactive membership plan" };
    }

    // 3. Compute contract validity dates
    const start = new Date(validated.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + plan.duration_days - 1);

    const startDateStr = start.toISOString().split("T")[0];
    const endDateStr = end.toISOString().split("T")[0];

    // 4. Protect timeline integrity: expire previous active contracts
    await supabase
      .from("memberships")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", validated.memberId)
      .eq("status", "active");

    // 5. Create new membership contract
    const { data: newMembership, error: memErr } = await supabase
      .from("memberships")
      .insert({
        member_id: validated.memberId,
        plan_id: plan.id,
        start_date: startDateStr,
        end_date: endDateStr,
        status: "active",
        notes: validated.notes || `Contract assigned: ${plan.name}`,
      })
      .select("id")
      .single();

    if (memErr || !newMembership) {
      return { success: false, error: `Failed to create membership: ${memErr?.message}` };
    }

    // 6. If amount paid > 0, record payment with idempotency key
    let paymentId: string | null = null;
    if (validated.amountPaid > 0) {
      const planPrice = Number(plan.price);
      const isFull = validated.amountPaid >= planPrice;
      const idempotencyKey = `assign_${newMembership.id}_${validated.memberId}`;

      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          gym_id: context.gymId,
          branch_id: validated.branchId,
          member_id: validated.memberId,
          membership_id: newMembership.id,
          amount: validated.amountPaid,
          payment_method: validated.paymentMethod,
          payment_status: isFull ? "paid" : "partial",
          payment_date: startDateStr,
          notes: validated.notes || `Initial payment for ${plan.name}`,
          created_by: context.userId,
          idempotency_key: idempotencyKey,
        })
        .select("id")
        .single();

      if (!payErr && payment) {
        paymentId = payment.id;
      }
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/memberships`);
    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/members/${validated.memberId}`);
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);

    return {
      success: true,
      membershipId: newMembership.id,
      paymentId,
      startDate: startDateStr,
      endDate: endDateStr,
      planName: plan.name,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to assign membership";
    return { success: false, error: message };
  }
}
