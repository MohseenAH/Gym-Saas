export type StaffRole =
  | "owner"
  | "partner"
  | "manager"
  | "staff"
  | "trainer";

export const ROLE_HIERARCHY: Record<StaffRole, number> = {
  owner: 50,
  partner: 40,
  manager: 30,
  staff: 20,
  trainer: 10,
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  partner: "Partner",
  manager: "Manager",
  staff: "Staff",
  trainer: "Trainer",
};

export function isRoleAtLeast(role: StaffRole, requiredRole: StaffRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Evaluates whether an inviter/manager has permission to grant a target role.
 * Invariants:
 * 1. Only an existing owner can invite or promote another owner.
 * 2. Non-owners can only assign roles strictly below their own hierarchy level.
 */
export function canAssignRole(operatorRole: StaffRole, targetRole: StaffRole): boolean {
  // Floor staff and trainers have no staff delegation authority
  if (operatorRole === "staff" || operatorRole === "trainer") {
    return false;
  }
  if (targetRole === "owner") {
    return operatorRole === "owner";
  }
  return ROLE_HIERARCHY[operatorRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Checks whether an owner can be demoted, suspended, or removed given the active owner count.
 * Invariant: A gym must always retain at least 1 active owner (no orphan workspaces).
 */
export function canDemoteOrRemoveOwner(activeOwnerCount: number): boolean {
  return activeOwnerCount > 1;
}
