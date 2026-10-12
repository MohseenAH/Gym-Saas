import { createClient } from "@/lib/supabase/server";
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

export async function getAuthorizedActionContext(params: {
  gymId: string;
  capability?: Capability;
  targetBranchId?: string;
}): Promise<AuthorizedContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError("Authentication required");
  }

  // Fetch staff record in the specified gym
  const { data: gymUser, error: gymUserError } = await supabase
    .from("gym_users")
    .select("id, role, status")
    .eq("gym_id", params.gymId)
    .eq("user_id", user.id)
    .single();

  if (gymUserError || !gymUser) {
    throw new AuthorizationError("No staff access to this gym workspace");
  }

  if (gymUser.status !== "active") {
    throw new AuthorizationError("Account is suspended");
  }

  const role = gymUser.role as StaffRole;

  // Verify capability
  if (params.capability && !hasCapability(role, params.capability)) {
    throw new AuthorizationError(
      `Permission denied: Missing required capability '${params.capability}'`
    );
  }

  // Fetch branch assignments
  let branchIds: string[] = [];
  if (role === "owner" || role === "partner") {
    // Owners & Partners have universal branch access
    const { data: branches } = await supabase
      .from("branches")
      .select("id")
      .eq("gym_id", params.gymId)
      .eq("is_active", true);

    branchIds = branches?.map((b) => b.id) ?? [];
  } else {
    const { data: branchAccess } = await supabase
      .from("user_branch_access")
      .select("branch_id")
      .eq("gym_user_id", gymUser.id);

    branchIds = branchAccess?.map((b) => b.branch_id) ?? [];
  }

  // Verify target branch access if requested
  if (params.targetBranchId && !branchIds.includes(params.targetBranchId)) {
    throw new AuthorizationError("Permission denied: No access to this branch");
  }

  return {
    userId: user.id,
    gymId: params.gymId,
    role,
    gymUserId: gymUser.id,
    branchIds,
  };
}
