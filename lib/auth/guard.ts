import { cache } from "react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { StaffRole } from "./roles";
import { Capability, hasCapability } from "./capabilities";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface AuthorizedContext {
  userId: string;
  gymId: string;
  role: StaffRole;
  gymUserId: string;
  branchIds: string[];
}

/**
 * Request-level cached resolution of user, gym role, and authorized branches.
 * Using React's cache() ensures Supabase is queried only once per page load,
 * even when layout.tsx and child page.tsx both call this helper.
 */
export const getCachedGymAuthContext = cache(
  async (gymId: string): Promise<AuthorizedContext> => {
    const supabase = await createClient();
    const user = await getCachedUser();

    if (!user) {
      throw new AuthorizationError("Authentication required");
    }

    // Check account ownership first (universal owner access)
    const { data: gym } = await supabase
      .from("gyms")
      .select("id, name, account_id, accounts(owner_id)")
      .eq("id", gymId)
      .maybeSingle();

    const isAccountOwner =
      (gym?.accounts as unknown as { owner_id?: string } | null)?.owner_id === user.id;

    let role: StaffRole = "staff";
    let gymUserId = "";
    let isAuthorized = isAccountOwner;

    if (isAccountOwner) {
      role = "owner";
      // Fetch gym_user id if exists, or fallback
      const { data: gymUser } = await supabase
        .from("gym_users")
        .select("id, role, status")
        .eq("gym_id", gymId)
        .eq("user_id", user.id)
        .maybeSingle();

      gymUserId = gymUser?.id || user.id;
    } else {
      // Fetch staff record in the specified gym
      const { data: gymUser, error: gymUserError } = await supabase
        .from("gym_users")
        .select("id, role, status")
        .eq("gym_id", gymId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (gymUserError || !gymUser) {
        throw new AuthorizationError("No staff access to this gym workspace");
      }

      if (gymUser.status !== "active") {
        throw new AuthorizationError("Account is suspended");
      }

      role = gymUser.role as StaffRole;
      gymUserId = gymUser.id;
      isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new AuthorizationError("No staff access to this gym workspace");
    }

    // Fetch authorized branch IDs
    let branchIds: string[] = [];
    if (role === "owner" || role === "partner") {
      // Owners & Partners have universal branch access
      const { data: branches } = await supabase
        .from("branches")
        .select("id")
        .eq("gym_id", gymId)
        .eq("is_active", true);

      branchIds = branches?.map((b) => b.id) ?? [];
    } else {
      const { data: branchAccess } = await supabase
        .from("user_branch_access")
        .select("branch_id")
        .eq("gym_user_id", gymUserId);

      branchIds = branchAccess?.map((b) => b.branch_id) ?? [];
    }

    return {
      userId: user.id,
      gymId,
      role,
      gymUserId,
      branchIds,
    };
  }
);

export async function getAuthorizedActionContext(params: {
  gymId: string;
  capability?: Capability;
  targetBranchId?: string;
}): Promise<AuthorizedContext> {
  const context = await getCachedGymAuthContext(params.gymId);

  // Verify capability
  if (params.capability && !hasCapability(context.role, params.capability)) {
    throw new AuthorizationError(
      `Permission denied: Missing required capability '${params.capability}'`
    );
  }

  // Verify target branch access if requested
  if (params.targetBranchId && !context.branchIds.includes(params.targetBranchId)) {
    throw new AuthorizationError("Permission denied: No access to this branch");
  }

  return context;
}
