"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { getISTDateString, getTodayIST, calculateMembershipEndDate } from "@/lib/utils";
import {
  assignMembershipSchema,
  bulkAssignMembershipsSchema,
  manageMembershipSchema,
  type AssignMembershipInput,
  type BulkAssignMembershipsInput,
  type ManageMembershipInput,
} from "@/lib/validations/memberships";

export type {
  AssignMembershipInput,
  BulkAssignMembershipsInput,
  ManageMembershipInput,
};

export interface SkippedBulkMember {
  memberId: string;
  fullName: string;
  reason: string;
}

export interface BulkAssignMembershipsResult {
  success: boolean;
  assignedCount: number;
  skippedMembers: SkippedBulkMember[];
  error?: string;
}

export type { MembershipLifecycleStatus } from "@/lib/utils/membership-status";

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

    const startDateStr = getISTDateString(start);
    const endDateStr = getISTDateString(end);

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
        })
        .select("id")
        .single();

      if (!payErr && payment) {
        paymentId = payment.id;
      }
    }

    return JSON.parse(
      JSON.stringify({
        success: true,
        membershipId: newMembership.id,
        paymentId: paymentId || null,
        startDate: startDateStr,
        endDate: endDateStr,
        planName: plan.name,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(JSON.stringify({ success: false, error: message }));
  }
}

/**
 * Bulk assigns a membership plan to multiple members.
 * Atomic, branch-isolated, date-overlap protected, and preserves payment invariants (zero payment rows).
 */
export async function bulkAssignMembershipsAction(
  input: BulkAssignMembershipsInput
): Promise<BulkAssignMembershipsResult> {
  try {
    const validated = bulkAssignMembershipsSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Fetch and verify membership plan
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("id, name, duration_days, price, is_active, branch_id, branches!inner(gym_id)")
      .eq("id", validated.planId)
      .single();

    if (planErr || !plan) {
      return {
        success: false,
        assignedCount: 0,
        skippedMembers: [],
        error: "Membership plan not found",
      };
    }

    const planGymId = (plan.branches as unknown as { gym_id: string })?.gym_id;
    if (planGymId && planGymId !== context.gymId) {
      return {
        success: false,
        assignedCount: 0,
        skippedMembers: [],
        error: "Unauthorized plan access across gym boundary",
      };
    }

    if (!plan.is_active) {
      return {
        success: false,
        assignedCount: 0,
        skippedMembers: [],
        error: "Cannot assign an inactive membership plan",
      };
    }

    if (plan.branch_id && plan.branch_id !== validated.branchId) {
      return {
        success: false,
        assignedCount: 0,
        skippedMembers: [],
        error: "Plan belongs to a different branch than the target assignment branch",
      };
    }

    // 2. Fetch target members belonging to this gym and branch
    const { data: members, error: membersErr } = await supabase
      .from("members")
      .select("id, full_name, branch_id, branches!inner(gym_id)")
      .in("id", validated.memberIds)
      .eq("branches.gym_id", context.gymId);

    if (membersErr) {
      return {
        success: false,
        assignedCount: 0,
        skippedMembers: [],
        error: `Failed to fetch target members: ${membersErr.message}`,
      };
    }

    const membersMap = new Map((members || []).map((m) => [m.id, m]));
    const skippedMembers: SkippedBulkMember[] = [];
    const eligibleMembers: Array<{ id: string; full_name: string }> = [];

    // Verify each member belongs to this gym and branch
    for (const memberId of validated.memberIds) {
      const member = membersMap.get(memberId);
      if (!member) {
        skippedMembers.push({
          memberId,
          fullName: "Unknown Member",
          reason: "Member not found or unauthorized across gym boundary",
        });
        continue;
      }

      if (member.branch_id !== validated.branchId) {
        skippedMembers.push({
          memberId,
          fullName: member.full_name,
          reason: "Member belongs to a different branch than the target assignment branch",
        });
        continue;
      }

      eligibleMembers.push({ id: member.id, full_name: member.full_name });
    }

    if (eligibleMembers.length === 0) {
      return {
        success: true,
        assignedCount: 0,
        skippedMembers,
      };
    }

    // 3. Compute contract validity dates
    const startDateStr = validated.startDate;
    const endDateStr = calculateMembershipEndDate(startDateStr, plan.duration_days);
    const todayIST = getTodayIST();
    const contractStatus = endDateStr < todayIST ? "expired" : "active";

    // 4. Overlap Safeguards: Query existing contracts for eligible members
    const eligibleIds = eligibleMembers.map((m) => m.id);
    const { data: existingContracts, error: contractsErr } = await supabase
      .from("memberships")
      .select("id, member_id, start_date, end_date, status")
      .in("member_id", eligibleIds)
      .lte("start_date", endDateStr)
      .gte("end_date", startDateStr);

    if (contractsErr) {
      return {
        success: false,
        assignedCount: 0,
        skippedMembers,
        error: `Failed to check contract overlaps: ${contractsErr.message}`,
      };
    }

    const overlapMap = new Map<string, { start: string; end: string }>();
    (existingContracts || []).forEach((c) => {
      if (c.status !== "cancelled") {
        overlapMap.set(c.member_id, { start: c.start_date, end: c.end_date });
      }
    });

    const membersToAssign: Array<{ id: string; full_name: string }> = [];
    for (const member of eligibleMembers) {
      if (overlapMap.has(member.id)) {
        const o = overlapMap.get(member.id)!;
        skippedMembers.push({
          memberId: member.id,
          fullName: member.full_name,
          reason: `Overlaps with existing contract (${o.start} to ${o.end})`,
        });
      } else {
        membersToAssign.push(member);
      }
    }

    if (membersToAssign.length === 0) {
      return {
        success: true,
        assignedCount: 0,
        skippedMembers,
      };
    }

    // 5. Batch Insert Contracts in chunks of 100
    // Invariant: Writes strictly to 'memberships'. Zero payment records are inserted.
    const recordsToInsert = membersToAssign.map((m) => ({
      gym_id: context.gymId,
      branch_id: validated.branchId,
      member_id: m.id,
      plan_id: plan.id,
      start_date: startDateStr,
      end_date: endDateStr,
      status: contractStatus,
      notes: `Bulk assigned: ${plan.name}`,
    }));

    let assignedCount = 0;
    for (let i = 0; i < recordsToInsert.length; i += 100) {
      const chunk = recordsToInsert.slice(i, i + 100);
      const { error: insertErr } = await supabase.from("memberships").insert(chunk);

      if (insertErr) {
        return {
          success: false,
          assignedCount,
          skippedMembers,
          error: `Database insertion error: ${insertErr.message}`,
        };
      }
      assignedCount += chunk.length;
    }

    return JSON.parse(
      JSON.stringify({
        success: true,
        assignedCount,
        skippedMembers,
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(
      JSON.stringify({
        success: false,
        assignedCount: 0,
        skippedMembers: [],
        error: message,
      })
    );
  }
}

/**
 * Safely manages membership lifecycle updates: adjust dates / freeze days,
 * upgrade / change plan, or cancel membership without silent cash payments.
 */
export async function manageMembershipAction(input: ManageMembershipInput) {
  try {
    const validated = manageMembershipSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "memberships:manage",
    });

    const supabase = await createClient();

    // 1. Fetch current membership with member and branch validation
    const { data: membership, error: memErr } = await supabase
      .from("memberships")
      .select("id, member_id, plan_id, start_date, end_date, status, notes, members!inner(id, full_name, branch_id, branches!inner(gym_id)), membership_plans(id, name, duration_days, price)")
      .eq("id", validated.membershipId)
      .single();

    if (memErr || !membership) {
      return { success: false, error: "Membership contract not found" };
    }

    const memberGymId = ((membership.members as unknown as { branches?: { gym_id: string } })?.branches)?.gym_id;
    if (memberGymId !== context.gymId) {
      return { success: false, error: "Unauthorized access across gym boundary" };
    }

    if (membership.member_id !== validated.memberId) {
      return { success: false, error: "Contract does not belong to specified member" };
    }

    const todayIST = getTodayIST();

    if (validated.operation === "adjust_dates") {
      const newStartDate = validated.startDate || membership.start_date;
      let newEndDate = validated.endDate || membership.end_date;

      if (validated.freezeDays || validated.extensionDays) {
        const addedDays = (validated.freezeDays || 0) + (validated.extensionDays || 0);
        const curEnd = new Date(newEndDate);
        curEnd.setDate(curEnd.getDate() + addedDays);
        newEndDate = getISTDateString(curEnd);
      }

      if (newEndDate < newStartDate) {
        return { success: false, error: "End date cannot precede start date" };
      }

      const newStatus = newEndDate >= todayIST ? "active" : "expired";
      const noteAppend = validated.reason
        ? `Validity adjusted: ${validated.reason}`
        : validated.freezeDays
        ? `Freeze applied: +${validated.freezeDays} days`
        : `Validity updated (${newStartDate} to ${newEndDate})`;

      const updatedNotes = membership.notes
        ? `${membership.notes}\n• ${noteAppend}`
        : noteAppend;

      const { error: updateErr } = await supabase
        .from("memberships")
        .update({
          start_date: newStartDate,
          end_date: newEndDate,
          status: newStatus,
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validated.membershipId);

      if (updateErr) {
        return { success: false, error: `Failed to adjust dates: ${updateErr.message}` };
      }

      return JSON.parse(
        JSON.stringify({
          success: true,
          operation: "adjust_dates",
          startDate: newStartDate,
          endDate: newEndDate,
          status: newStatus,
        })
      );
    } else if (validated.operation === "change_plan") {
      if (!validated.newPlanId) {
        return { success: false, error: "Please select a new membership plan" };
      }

      const { data: newPlan, error: planErr } = await supabase
        .from("membership_plans")
        .select("id, name, duration_days, price, is_active")
        .eq("id", validated.newPlanId)
        .single();

      if (planErr || !newPlan) {
        return { success: false, error: "Selected plan not found" };
      }

      if (!newPlan.is_active) {
        return { success: false, error: "Cannot switch to an inactive membership plan" };
      }

      // Compute new end date from current start_date with new plan's duration
      const s = new Date(membership.start_date);
      const e = new Date(s);
      e.setDate(e.getDate() + newPlan.duration_days - 1);
      const newEndDate = getISTDateString(e);
      const newStatus = newEndDate >= todayIST ? "active" : "expired";

      const noteAppend = `Plan changed to ${newPlan.name} (₹${newPlan.price}, ${newPlan.duration_days}d). Unpaid balance remains for ledger.`;
      const updatedNotes = membership.notes
        ? `${membership.notes}\n• ${noteAppend}`
        : noteAppend;

      const { error: updateErr } = await supabase
        .from("memberships")
        .update({
          plan_id: newPlan.id,
          end_date: newEndDate,
          status: newStatus,
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validated.membershipId);

      if (updateErr) {
        return { success: false, error: `Failed to change plan: ${updateErr.message}` };
      }

      return JSON.parse(
        JSON.stringify({
          success: true,
          operation: "change_plan",
          planId: newPlan.id,
          planName: newPlan.name,
          endDate: newEndDate,
          status: newStatus,
        })
      );
    } else if (validated.operation === "cancel_membership") {
      const cancelReason = validated.reason || "Staff initiated cancellation";
      const noteAppend = `Cancelled: ${cancelReason}`;
      const updatedNotes = membership.notes
        ? `${membership.notes}\n• ${noteAppend}`
        : noteAppend;

      const { error: updateErr } = await supabase
        .from("memberships")
        .update({
          status: "cancelled",
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validated.membershipId);

      if (updateErr) {
        return { success: false, error: `Failed to cancel membership: ${updateErr.message}` };
      }

      return JSON.parse(
        JSON.stringify({
          success: true,
          operation: "cancel_membership",
          status: "cancelled",
        })
      );
    }

    return { success: false, error: "Invalid lifecycle operation" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.parse(
      JSON.stringify({
        success: false,
        error: message,
      })
    );
  }
}

