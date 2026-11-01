"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { WhatsAppLinkAdapter } from "@/lib/adapters/notification-adapter";
import { getTodayIST } from "@/lib/utils";

const recordPaymentSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  membershipId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
  paymentStatus: z.enum(["paid", "partial", "pending", "refunded"]).default("paid"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(1).max(255).optional().nullable(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export async function recordPaymentAction(input: RecordPaymentInput) {
  try {
    const validated = recordPaymentSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "payments:record",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // Fetch member details to format WhatsApp receipt link
    const { data: member } = await supabase
      .from("members")
      .select("full_name, phone")
      .eq("id", validated.memberId)
      .single();

    // Database-enforced atomic insert with idempotency key
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        gym_id: context.gymId,
        branch_id: validated.branchId,
        member_id: validated.memberId,
        membership_id: validated.membershipId || null,
        amount: validated.amount,
        payment_method: validated.paymentMethod,
        payment_status: validated.paymentStatus,
        payment_date: validated.paymentDate,
        notes: validated.notes || null,
        created_by: context.userId,
        idempotency_key: validated.idempotencyKey || null,
      })
      .select("id")
      .single();

    if (error) {
      // Handle unique constraint conflict on (gym_id, idempotency_key)
      if (
        (error.code === "23505" || error.message?.includes("idempotency") || error.message?.includes("duplicate key")) &&
        validated.idempotencyKey
      ) {
        const { data: existingPayment } = await supabase
          .from("payments")
          .select("id")
          .eq("gym_id", context.gymId)
          .eq("idempotency_key", validated.idempotencyKey)
          .maybeSingle();

        if (existingPayment) {
          return {
            success: true,
            paymentId: existingPayment.id,
            isDuplicate: true,
          };
        }
      }

      return { success: false, error: `Failed to record payment: ${error.message}` };
    }

    // Generate WhatsApp direct receipt link
    let receiptUrl: string | undefined;
    if (member?.phone) {
      const waAdapter = new WhatsAppLinkAdapter();
      const receiptRes = await waAdapter.sendReceipt({
        recipientName: member.full_name,
        recipientPhone: member.phone,
        receiptAmount: validated.amount,
        receiptId: payment.id,
        message: "",
      });
      receiptUrl = receiptRes.directUrl;
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/revenue`);
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/portal/${context.gymId}/payments`);

    return {
      success: true,
      paymentId: payment.id,
      receiptUrl,
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

    const notes = validated.utrRef
      ? `Member UPI transfer (UTR: ${validated.utrRef})${validated.notes ? ` - ${validated.notes}` : ""}`
      : validated.notes || "Member UPI transfer";

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
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

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
      .select("id, gym_id, branch_id, member_id, amount, payment_status, membership_id")
      .eq("id", validated.paymentId)
      .eq("gym_id", context.gymId)
      .single();

    if (fetchErr || !payment) {
      return { success: false, error: "Payment record not found" };
    }

    if (payment.payment_status === "paid") {
      return { success: true, alreadyPaid: true };
    }

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

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/payments`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/app/${context.gymId}/reports`);
    revalidatePath(`/portal/${context.gymId}/payments`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}
