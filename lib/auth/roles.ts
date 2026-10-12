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
