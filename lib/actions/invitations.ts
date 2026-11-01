"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import {
  generateInvitationToken,
  hashToken,
  buildInvitationLinks,
  getAppBaseUrl,
} from "@/lib/auth/invitations";
import {
  ROLE_HIERARCHY,
  StaffRole,
  canAssignRole,
  canDemoteOrRemoveOwner,
} from "@/lib/auth/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const staffInviteSchema = z.object({
  gymId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum(["owner", "partner", "manager", "staff", "trainer"]),
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

  // Anti-Privilege Escalation: verify inviter has authority to grant this role
  if (!canAssignRole(authContext.role, role)) {
    if (role === "owner") {
      return {
        success: false,
        error: "Permission denied: Only an existing owner can invite another owner",
      };
    }
    return {
      success: false,
      error: `Permission denied: Cannot invite staff with role '${role}' (requires higher privileges)`,
    };
  }

  const supabase = await createClient();

  // Validate that all attached branchIds strictly belong to this gym workspace and are active
  if (branchIds && branchIds.length > 0) {
    const { data: validBranches } = await supabase
      .from("branches")
      .select("id")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .in("id", branchIds);

    const validBranchSet = new Set((validBranches || []).map((b) => b.id));
    const hasForeignBranch = branchIds.some((id) => !validBranchSet.has(id));
    if (hasForeignBranch) {
      return {
        success: false,
        error: "One or more selected branches do not belong to this gym workspace",
      };
    }
  }

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

  revalidatePath(`/app/${gymId}`, "layout");
  revalidatePath(`/app/${gymId}/staff`);

  return {
    success: true,
    invitationId: invitation.id,
    links,
  };
}

// Convenient alias for createStaffInvitationAction
export async function inviteStaffAction(data: z.infer<typeof staffInviteSchema>) {
  return createStaffInvitationAction(data);
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

    revalidatePath(`/app/${context.gymId}`, "layout");
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

    const { data: targetUser, error: fetchErr } = await supabase
      .from("gym_users")
      .select("id, role, status, user_id")
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return { success: false, error: "Staff member not found" };
    }

    // Privilege protection: Non-owners cannot suspend senior or equal roles
    if (context.role !== "owner" && ROLE_HIERARCHY[targetUser.role as StaffRole] >= ROLE_HIERARCHY[context.role]) {
      return { success: false, error: "Permission denied: Cannot modify status of a senior staff member" };
    }

    // Sole owner suspension protection
    if (targetUser.role === "owner" && params.status === "suspended") {
      const { data: owners } = await supabase
        .from("gym_users")
        .select("id")
        .eq("gym_id", params.gymId)
        .eq("role", "owner")
        .eq("status", "active");

      if (!canDemoteOrRemoveOwner(owners?.length || 0)) {
        return { success: false, error: "Cannot suspend or deactivate the sole owner of this gym workspace" };
      }
    }

    const { error } = await supabase
      .from("gym_users")
      .update({ status: params.status })
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/staff`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update staff status";
    return { success: false, error: message };
  }
}

export async function updateStaffRoleAction(params: {
  gymId: string;
  gymUserId: string;
  newRole: StaffRole;
}) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "staff:manage",
    });

    const supabase = await createClient();

    const { data: targetUser, error: fetchErr } = await supabase
      .from("gym_users")
      .select("id, role, status, user_id")
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return { success: false, error: "Staff member not found" };
    }

    // Only owners can promote or assign owner role; non-owners can only assign below their hierarchy
    if (!canAssignRole(context.role, params.newRole)) {
      if (params.newRole === "owner") {
        return { success: false, error: "Permission denied: Only an existing owner can promote another user to owner" };
      }
      return { success: false, error: `Permission denied: Cannot assign role '${params.newRole}' (requires higher privileges)` };
    }

    // Non-owners cannot modify senior or equal staff
    if (context.role !== "owner" && ROLE_HIERARCHY[targetUser.role as StaffRole] >= ROLE_HIERARCHY[context.role]) {
      return { success: false, error: "Permission denied: Cannot modify a staff member with equal or higher role" };
    }

    // Sole owner demotion protection
    if (targetUser.role === "owner" && params.newRole !== "owner") {
      const { data: owners } = await supabase
        .from("gym_users")
        .select("id")
        .eq("gym_id", params.gymId)
        .eq("role", "owner")
        .eq("status", "active");

      if (!canDemoteOrRemoveOwner(owners?.length || 0)) {
        return { success: false, error: "Cannot demote the sole owner of this gym workspace" };
      }
    }

    const { error } = await supabase
      .from("gym_users")
      .update({ role: params.newRole })
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/staff`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update staff role";
    return { success: false, error: message };
  }
}

export async function deleteStaffMemberAction(params: {
  gymId: string;
  gymUserId: string;
}) {
  try {
    const context = await getAuthorizedActionContext({
      gymId: params.gymId,
      capability: "staff:manage",
    });

    const supabase = await createClient();

    const { data: targetUser, error: fetchErr } = await supabase
      .from("gym_users")
      .select("id, role, status, user_id")
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return { success: false, error: "Staff member not found" };
    }

    // Non-owners cannot remove senior staff
    if (context.role !== "owner" && ROLE_HIERARCHY[targetUser.role as StaffRole] >= ROLE_HIERARCHY[context.role]) {
      return { success: false, error: "Permission denied: Cannot remove a staff member with equal or higher role" };
    }

    // Sole owner deletion protection
    if (targetUser.role === "owner") {
      const { data: owners } = await supabase
        .from("gym_users")
        .select("id")
        .eq("gym_id", params.gymId)
        .eq("role", "owner")
        .eq("status", "active");

      if (!canDemoteOrRemoveOwner(owners?.length || 0)) {
        return { success: false, error: "Cannot delete or remove the sole owner of this gym workspace" };
      }
    }

    const { error } = await supabase
      .from("gym_users")
      .delete()
      .eq("id", params.gymUserId)
      .eq("gym_id", params.gymId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/app/${context.gymId}`, "layout");
    revalidatePath(`/app/${context.gymId}/staff`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove staff member";
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
