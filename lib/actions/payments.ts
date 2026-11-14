"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { WhatsAppLinkAdapter } from "@/lib/adapters/notification-adapter";
import {
  getTodayIST,
  calculateRemainingDues,
  validatePaymentAmountAgainstDues,
} from "@/lib/utils";

const recordPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  membershipId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z
    .enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"])
    .default("cash"),
  paymentStatus: z
    .enum(["paid", "partial", "pending", "refunded", "rejected"])
    .default("paid"),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(1).max(255).optional().nullable(),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export async function recordPaymentAction(input: RecordPaymentInput) {
  try {
    const validated = recordPaymentSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "payments:record",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Fetch member details
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, full_name, phone")
      .eq("id", validated.memberId)
      .maybeSingle();

    if (memberErr || !member) {
      return { success: false, error: "Target member record not found" };
    }

    // 2. Strict Dues & Overpayment Guard
    let targetMembership: { id: string; pending_dues: number | null } | null = null;

    if (validated.membershipId) {
      const { data: mem } = await supabase
        .from("memberships")
        .select("id, pending_dues, status, member_id")
        .eq("id", validated.membershipId)
        .maybeSingle();

      if (mem && mem.member_id === validated.memberId) {
        targetMembership = mem;
      }
    } else {
      // Find active membership with outstanding dues for this member
      const { data: activeMem } = await supabase
        .from("memberships")
        .select("id, pending_dues, status")
        .eq("member_id", validated.memberId)
        .eq("status", "active")
        .gt("pending_dues", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeMem) {
        targetMembership = activeMem;
      }
    }

    if (targetMembership) {
      const currentDues = Number(targetMembership.pending_dues ?? 0);
      const duesValidation = validatePaymentAmountAgainstDues(currentDues, validated.amount);
      if (!duesValidation.isValid) {
        return { success: false, error: duesValidation.error };
      }
    }

    // 3. Duplicate click protection (within 10 seconds for same gym, member, amount, and payment_date)
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
    const { data: recentDuplicate } = await supabase
      .from("payments")
      .select("id")
      .eq("gym_id", context.gymId)
      .eq("member_id", validated.memberId)
      .eq("amount", validated.amount)
      .eq("payment_date", validated.paymentDate)
      .gte("created_at", tenSecondsAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentDuplicate) {
      return {
        success: true,
        paymentId: recentDuplicate.id,
        isDuplicate: true,
      };
    }

    // 4. Atomic insert without non-existent schema columns
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        gym_id: context.gymId,
        branch_id: validated.branchId,
        member_id: validated.memberId,
        membership_id: targetMembership?.id || validated.membershipId || null,
        amount: validated.amount,
        payment_method: validated.paymentMethod,
        payment_status: validated.paymentStatus,
        payment_date: validated.paymentDate,
        notes: validated.notes || null,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: `Failed to record payment: ${error.message}` };
    }

    // 4. Atomically decrement pending_dues on paid payment
    let remainingDues: number | undefined;
    if (targetMembership && validated.paymentStatus === "paid") {
      const currentDues = Number(targetMembership.pending_dues ?? 0);
      remainingDues = calculateRemainingDues(currentDues, validated.amount);

      await supabase
        .from("memberships")
        .update({
          pending_dues: remainingDues,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetMembership.id);
    }

    // 5. Generate WhatsApp direct receipt link
    let receiptUrl: string | undefined;
    if (member?.phone) {
      const waAdapter = new WhatsAppLinkAdapter();
      const receiptRes = await waAdapter.sendReceipt({
        recipientName: member.full_name,
        recipientPhone: member.phone,
        receiptAmount: validated.amount,
        receiptId: payment.id,
        message:
          remainingDues !== undefined && remainingDues > 0
            ? `Remaining Dues: ₹${remainingDues.toFixed(2)}`
            : "Remaining Dues: ₹0.00 (Cleared)",
      });
      receiptUrl = receiptRes.directUrl;
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/revenue`);
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/app/${context.gymId}/reports`);
    revalidatePath(`/portal/${context.gymId}/payments`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);

    return {
      success: true,
      paymentId: payment.id,
      receiptUrl,
      remainingDues,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

const submitMemberUpiPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  membershipId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  utrRef: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type SubmitMemberUpiPaymentInput = z.infer<typeof submitMemberUpiPaymentSchema>;

export async function submitMemberUpiPaymentAction(input: SubmitMemberUpiPaymentInput) {
  try {
    const validated = submitMemberUpiPaymentSchema.parse(input);
    const user = await getCachedUser();
    if (!user) {
      return { success: false, error: "Authentication required to submit payment" };
    }

    const supabase = await createClient();

    // Verify member belongs to authenticated user
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("id, branch_id, full_name, phone")
      .eq("id", validated.memberId)
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member) {
      return { success: false, error: "Member profile not found or unauthorized" };
    }

    // Overpayment guard if membershipId is specified
    if (validated.membershipId) {
      const { data: mem } = await supabase
        .from("memberships")
        .select("id, pending_dues")
        .eq("id", validated.membershipId)
        .eq("member_id", validated.memberId)
        .maybeSingle();

      if (mem) {
        const dues = Number(mem.pending_dues ?? 0);
        const check = validatePaymentAmountAgainstDues(dues, validated.amount);
        if (!check.isValid) {
          return { success: false, error: check.error };
        }
      }
    }

    const notes = validated.utrRef
      ? `Member UPI transfer (UTR: ${validated.utrRef})${validated.notes ? ` - ${validated.notes}` : ""}`
      : validated.notes || "Member UPI transfer";

    // Submissions always create records with payment_status: 'pending' WITHOUT altering dues
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        gym_id: validated.gymId,
        branch_id: validated.branchId,
        member_id: validated.memberId,
        membership_id: validated.membershipId || null,
        amount: validated.amount,
        payment_method: "upi",
        payment_status: "pending",
        payment_date: getTodayIST(),
        notes,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: `Failed to record payment claim: ${error.message}` };
    }

    revalidatePath(`/portal/${validated.gymId}/payments`);
    revalidatePath(`/portal/${validated.gymId}/dashboard`);
    revalidatePath(`/app/${validated.gymId}/payments`);
    revalidatePath(`/app/${validated.gymId}/dashboard`);
    revalidatePath(`/app/${validated.gymId}/reports`);

    return {
      success: true,
      paymentId: payment.id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

const verifyPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  paymentId: z.string().uuid("Invalid payment ID"),
  action: z.enum(["approve", "reject"]).default("approve"),
  rejectionReason: z.string().max(300).optional().nullable(),
});

export type VerifyPaymentInput = z.input<typeof verifyPaymentSchema>;

export async function verifyPaymentAction(input: VerifyPaymentInput) {
  try {
    const validated = verifyPaymentSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "payments:record",
    });

    const supabase = await createClient();

    // Verify payment exists in this gym
    const { data: payment, error: fetchErr } = await supabase
      .from("payments")
      .select("id, gym_id, branch_id, member_id, amount, payment_status, membership_id, notes")
      .eq("id", validated.paymentId)
      .eq("gym_id", context.gymId)
      .single();

    if (fetchErr || !payment) {
      return { success: false, error: "Payment record not found" };
    }

    if (validated.action === "approve") {
      if (payment.payment_status === "paid") {
        return { success: true, alreadyPaid: true };
      }
      if (payment.payment_status === "rejected") {
        return { success: false, error: "Cannot approve an already rejected payment claim" };
      }

      // Update payment to paid
      const { error: updateErr } = await supabase
        .from("payments")
        .update({
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", validated.paymentId)
        .eq("gym_id", context.gymId);

      if (updateErr) {
        return { success: false, error: `Failed to verify payment: ${updateErr.message}` };
      }

      // Decrement pending dues on the linked membership upon approval
      if (payment.membership_id) {
        const { data: mem } = await supabase
          .from("memberships")
          .select("id, pending_dues")
          .eq("id", payment.membership_id)
          .maybeSingle();

        if (mem) {
          const currentDues = Number(mem.pending_dues ?? 0);
          const newDues = calculateRemainingDues(currentDues, Number(payment.amount));

          await supabase
            .from("memberships")
            .update({
              pending_dues: newDues,
              updated_at: new Date().toISOString(),
            })
            .eq("id", mem.id);
        }
      }

      revalidatePath(`/app/${context.gymId}`, "layout");
      revalidatePath(`/app/${context.gymId}/payments`);
      revalidatePath(`/app/${context.gymId}/dashboard`);
      revalidatePath(`/app/${context.gymId}/reports`);
      revalidatePath(`/portal/${context.gymId}/payments`);
      revalidatePath(`/portal/${context.gymId}/dashboard`);

      return { success: true, approved: true };
    }

    // Action === "reject"
    if (payment.payment_status === "paid") {
      return { success: false, error: "Cannot reject a verified paid payment" };
    }

    const rejectionTag = validated.rejectionReason
      ? ` [REJECTED: ${validated.rejectionReason}]`
      : " [REJECTED: Declined by front-desk]";
    const updatedNotes = (payment.notes || "") + rejectionTag;

    const { error: rejectErr } = await supabase
      .from("payments")
      .update({
        payment_status: "rejected",
        notes: updatedNotes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.paymentId)
      .eq("gym_id", context.gymId);

    if (rejectErr) {
      return { success: false, error: `Failed to reject payment claim: ${rejectErr.message}` };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/app/${context.gymId}/reports`);
    revalidatePath(`/portal/${context.gymId}/payments`);
    revalidatePath(`/portal/${context.gymId}/dashboard`);

    return { success: true, rejected: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

export async function rejectPaymentAction(params: {
  gymId: string;
  paymentId: string;
  reason?: string;
}) {
  return verifyPaymentAction({
    gymId: params.gymId,
    paymentId: params.paymentId,
    action: "reject",
    rejectionReason: params.reason,
  });
}
