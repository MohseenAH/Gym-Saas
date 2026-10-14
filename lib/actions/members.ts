"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { generateInvitationToken, buildInvitationLinks } from "@/lib/auth/invitations";

const quickEnrollMemberSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional().nullable(),
  // Optional plan assignment during quick enroll
  planId: z.string().uuid().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amountPaid: z.number().min(0).optional(),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
});

export type QuickEnrollMemberInput = z.infer<typeof quickEnrollMemberSchema>;

export async function quickEnrollMemberAction(input: QuickEnrollMemberInput) {
  try {
    const validated = quickEnrollMemberSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Create member record
    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({
        branch_id: validated.branchId,
        full_name: validated.fullName,
        phone: validated.phone,
        email: validated.email || null,
        notes: validated.notes || null,
        status: "active",
      })
      .select("id, full_name, phone")
      .single();

    if (memberError || !member) {
      return { success: false, error: `Failed to create member: ${memberError?.message}` };
    }

    let membershipId: string | null = null;

    // 2. If plan selected, create membership contract
    if (validated.planId) {
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("id, duration_days, price")
        .eq("id", validated.planId)
        .single();

      if (plan) {
        const start = validated.startDate ? new Date(validated.startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + plan.duration_days - 1);

        const startDateStr = start.toISOString().split("T")[0];
        const endDateStr = end.toISOString().split("T")[0];

        const { data: membership, error: memError } = await supabase
          .from("memberships")
          .insert({
            member_id: member.id,
            plan_id: plan.id,
            start_date: startDateStr,
            end_date: endDateStr,
            status: "active",
          })
          .select("id")
          .single();

        if (!memError && membership) {
          membershipId = membership.id;

          // 3. If payment provided, record initial payment
          if (validated.amountPaid && validated.amountPaid > 0) {
            await supabase.from("payments").insert({
              gym_id: context.gymId,
              branch_id: validated.branchId,
              member_id: member.id,
              membership_id: membership.id,
              amount: validated.amountPaid,
              payment_method: validated.paymentMethod,
              payment_status: validated.amountPaid >= Number(plan.price) ? "paid" : "partial",
              payment_date: startDateStr,
              created_by: context.userId,
            });
          }
        }
      }
    }

    // 4. Generate Portal Invitation Token for 1-Click WhatsApp Self-Claim
    const { rawToken, tokenHash } = generateInvitationToken();

    await supabase.from("invitations").insert({
      gym_id: context.gymId,
      email: validated.email || `${validated.phone}@placeholder.gym`,
      type: "member",
      role: "member",
      branch_ids: [validated.branchId],
      member_id: member.id,
      token_hash: tokenHash,
      status: "pending",
      invited_by: context.userId,
    });

    const links = buildInvitationLinks({
      type: "member",
      rawToken,
      gymName: "our gym",
      recipientName: validated.fullName,
      recipientPhone: validated.phone,
    });
    const inviteUrl = links.inviteUrl;
    const waShareUrl = links.whatsappUrl;

    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/dashboard`);
    revalidatePath(`/app/${context.gymId}/revenue`);

    return {
      success: true,
      memberId: member.id,
      membershipId,
      inviteUrl,
      waShareUrl,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to enroll member";
    return { success: false, error: message };
  }
}

const updateMemberSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  memberId: z.string().uuid("Invalid member ID"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  branchId: z.string().uuid("Invalid branch ID"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  notes: z.string().optional().nullable(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export async function updateMemberAction(input: UpdateMemberInput) {
  try {
    const validated = updateMemberSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("members")
      .update({
        full_name: validated.fullName,
        phone: validated.phone,
        email: validated.email || null,
        branch_id: validated.branchId,
        status: validated.status,
        notes: validated.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", validated.memberId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}/members`);
    revalidatePath(`/app/${context.gymId}/members/${validated.memberId}`);
    revalidatePath(`/app/${context.gymId}/dashboard`);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update member";
    return { success: false, error: message };
  }
}

const renewMembershipSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
  planId: z.string().uuid("Invalid plan ID"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).default("cash"),
  notes: z.string().optional().nullable(),
});

export type RenewMembershipInput = z.infer<typeof renewMembershipSchema>;

export async function renewMembershipAction(input: RenewMembershipInput) {
  try {
    const validated = renewMembershipSchema.parse(input);

    const context = await getAuthorizedActionContext({
      gymId: validated.gymId,
      capability: "members:manage",
      targetBranchId: validated.branchId,
    });

    const supabase = await createClient();

    // 1. Fetch plan
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("id, name, duration_days, price")
      .eq("id", validated.planId)
      .single();

    if (planErr || !plan) {
      return { success: false, error: "Membership plan not found" };
    }

    // 2. Compute start and end dates
    const start = new Date(validated.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + plan.duration_days - 1);

    const startDateStr = start.toISOString().split("T")[0];
    const endDateStr = end.toISOString().split("T")[0];

    // 3. Mark previous active memberships for this member as expired
    await supabase
      .from("memberships")
      .update({ status: "expired" })
      .eq("member_id", validated.memberId)
      .eq("status", "active");

    // 4. Create new membership contract
    const { data: newMembership, error: memErr } = await supabase
      .from("memberships")
      .insert({
        member_id: validated.memberId,
        plan_id: plan.id,
        start_date: startDateStr,
        end_date: endDateStr,
        status: "active",
        notes: validated.notes || `Renewed with ${plan.name}`,
      })
      .select("id")
      .single();

    if (memErr || !newMembership) {
      return { success: false, error: `Failed to create membership: ${memErr?.message}` };
    }

    // 5. If amount paid > 0, record payment
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
          notes: validated.notes || `Renewal fee for ${plan.name}`,
          created_by: context.userId,
        })
        .select("id")
        .single();

      if (!payErr && payment) {
        paymentId = payment.id;
      }
    }

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
    const message = err instanceof Error ? err.message : "Failed to renew membership";
    return { success: false, error: message };
  }
}
