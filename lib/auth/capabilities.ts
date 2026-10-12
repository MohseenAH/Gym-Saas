import { StaffRole } from "./roles";

export type Capability =
  | "settings:manage"
  | "billing:manage"
  | "branches:manage"
  | "staff:manage"
  | "invitations:manage"
  | "plans:manage"
  | "members:manage"
  | "members:view"
  | "payments:record"
  | "payments:manage"
  | "attendance:record"
  | "financial:view"
  | "expenses:manage"
  | "reports:view"
  | "notices:manage"
  | "notices:view";

export const ROLE_CAPABILITIES: Record<StaffRole, Capability[]> = {
  owner: [
    "settings:manage",
    "billing:manage",
    "branches:manage",
    "staff:manage",
    "invitations:manage",
    "plans:manage",
    "members:manage",
    "members:view",
    "payments:record",
    "payments:manage",
    "attendance:record",
    "financial:view",
    "expenses:manage",
    "reports:view",
    "notices:manage",
    "notices:view",
  ],
  partner: [
    "staff:manage",
    "invitations:manage",
    "plans:manage",
    "members:manage",
    "members:view",
    "payments:record",
    "payments:manage",
    "attendance:record",
    "financial:view",
    "expenses:manage",
    "reports:view",
    "notices:manage",
    "notices:view",
  ],
  manager: [
    "members:manage",
    "members:view",
    "payments:record",
    "payments:manage",
    "attendance:record",
    "expenses:manage",
    "reports:view",
    "notices:manage",
    "notices:view",
  ],
  staff: [
    "members:manage",
    "members:view",
    "payments:record",
    "attendance:record",
    "notices:manage",
    "notices:view",
  ],
  trainer: [
    "members:view",
    "attendance:record",
    "notices:view",
  ],
};

export function hasCapability(role: StaffRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
