"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import {
  generateInvitationToken,
  hashToken,
  buildInvitationLinks,
  getAppBaseUrl,
} from "@/lib/auth/invitations";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const staffInviteSchema = z.object({
  gymId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum(["partner", "manager", "staff", "trainer"]),
  branchIds: z.array(z.string().uuid()).default([]),
});

export async function createStaffInvitationAction(data: z.infer<typeof staffInviteSchema>) {
  const validation = staffInviteSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || "Invalid input" };
  }

  const { gymId, email, phone, role, branchIds } = validation.data;

  // Authorization check: invitations:manage
  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "invitations:manage",
  });

  const supabase = await createClient();

  // Get gym name
  const { data: gym } = await supabase
    .from("gyms")
    .select("name")
    .eq("id", gymId)
    .single();

  const { rawToken, tokenHash } = generateInvitationToken();

  const cleanPhone = phone?.replace(/\D/g, "") || "";
  const resolvedEmail =
    email && email.trim()
      ? email.trim()
      : cleanPhone
      ? `${cleanPhone}@wa.invite`
      : `staff-${Date.now()}@invite.local`;

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      gym_id: gymId,
      role,
      email: resolvedEmail,
      token_hash: tokenHash,
      branch_ids: branchIds,
      invited_by: authContext.userId,
    })
    .select("id")
    .single();

  if (error || !invitation) {
    return { success: false, error: error?.message || "Failed to create invitation" };
  }

  const baseUrl = getAppBaseUrl();
  const links = buildInvitationLinks({
    baseUrl,
    type: "staff",
    rawToken,
    gymName: gym?.name || "the gym",
    role,
    recipientPhone: phone || undefined,
  });

  revalidatePath(`/app/${gymId}/staff`);

  return {
    success: true,
    invitationId: invitation.id,
    links,
  };
}

export async function createMemberInvitationAction(params: {
  gymId: string;
  memberId: string;
}) {
  // Authorization check: members:manage
  const authContext = await getAuthorizedActionContext({
    gymId: params.gymId,
    capability: "members:manage",
  });

  const supabase = await createClient();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, phone, email, branch_id, branches(gym_id, gyms(name))")
    .eq("id", params.memberId)
    .single();

  if (memberError || !member) {
    return { success: false, error: "Member not found" };
  }

  // Branch access check for the member's branch
  if (!authContext.branchIds.includes(member.branch_id)) {
    return { success: false, error: "No access to this branch's members" };
  }

  const { rawToken, tokenHash } = generateInvitationToken();

  const cleanPhone = member.phone?.replace(/\D/g, "") || "";
  const resolvedEmail =
    member.email && member.email.trim()
      ? member.email.trim()
      : cleanPhone
      ? `${cleanPhone}@wa.invite`
      : `member-${member.id}@invite.local`;

  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      gym_id: params.gymId,
      type: "member",
      role: "member",
      branch_ids: [member.branch_id],
      member_id: member.id,
      email: resolvedEmail,
      token_hash: tokenHash,
      invited_by: authContext.userId,
    })
    .select()
    .single();

  if (error || !invitation) {
    return { success: false, error: error?.message || "Failed to generate member invite" };
  }

  const gymName = (member.branches as unknown as { gyms?: { name?: string } })?.gyms?.name || "your gym";
  const baseUrl = getAppBaseUrl();

  const links = buildInvitationLinks({
    baseUrl,
    type: "member",
    rawToken,
    gymName,
    recipientName: member.full_name,
    recipientPhone: member.phone,
  });

  return {
    success: true,
    invitationId: invitation.id,
    links,
  };
}

export async function revokeInvitationAction(params: {
  gymId: string;
  invitationId: string;
}) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "invitations:manage",
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", params.invitationId)
      .eq("gym_id", params.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}/staff`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to revoke invitation";
    return { success: false, error: message };
  }
}

export async function toggleStaffStatusAction(params: {
  gymId: string;
  gymUserId: string;
  status: "active" | "suspended";
}) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "staff:manage",
    });

    const supabase = await createClient();

    const { error } = await supabase
      .from("gym_users")
      .update({ status: params.status })
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}/staff`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update staff status";
    return { success: false, error: message };
  }
}

export async function verifyInvitationTokenAction(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("verify_invitation_token", {
    p_token_hash: tokenHash,
  });

  if (error || !data) {
    return { valid: false, error: error?.message || "Verification failed" };
  }

  return data;
}

export async function acceptStaffInvitationAction(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Staff Member";

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone: user.user_metadata?.phone || null,
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function acceptMemberClaimAction(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Member";

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone: user.user_metadata?.phone || null,
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
