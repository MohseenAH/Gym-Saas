import { describe, it, expect } from "vitest";
import {
  StaffRole,
  ROLE_HIERARCHY,
  isRoleAtLeast,
  canAssignRole,
  canDemoteOrRemoveOwner,
} from "@/lib/auth/roles";
import { hasCapability } from "@/lib/auth/capabilities";

describe("Phase 4 RBAC, Role Hierarchy & Privilege Escalation Guards", () => {
  describe("Mathematical Hierarchy & Role Comparisons", () => {
    it("Validates strict mathematical hierarchy: owner > partner > manager > staff > trainer", () => {
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.partner);
      expect(ROLE_HIERARCHY.partner).toBeGreaterThan(ROLE_HIERARCHY.manager);
      expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.staff);
      expect(ROLE_HIERARCHY.staff).toBeGreaterThan(ROLE_HIERARCHY.trainer);
    });

    it("Verifies isRoleAtLeast boundary evaluations", () => {
      // Owner can perform everything
      expect(isRoleAtLeast("owner", "owner")).toBe(true);
      expect(isRoleAtLeast("owner", "partner")).toBe(true);
      expect(isRoleAtLeast("owner", "manager")).toBe(true);
      expect(isRoleAtLeast("owner", "staff")).toBe(true);
      expect(isRoleAtLeast("owner", "trainer")).toBe(true);

      // Manager can perform manager, staff, and trainer tasks, but not partner or owner
      expect(isRoleAtLeast("manager", "owner")).toBe(false);
      expect(isRoleAtLeast("manager", "partner")).toBe(false);
      expect(isRoleAtLeast("manager", "manager")).toBe(true);
      expect(isRoleAtLeast("manager", "staff")).toBe(true);
      expect(isRoleAtLeast("manager", "trainer")).toBe(true);

      // Staff cannot perform manager tasks
      expect(isRoleAtLeast("staff", "manager")).toBe(false);
      expect(isRoleAtLeast("staff", "staff")).toBe(true);
      expect(isRoleAtLeast("staff", "trainer")).toBe(true);

      // Trainer has baseline capability only
      expect(isRoleAtLeast("trainer", "staff")).toBe(false);
      expect(isRoleAtLeast("trainer", "trainer")).toBe(true);
    });
  });

  describe("Financial Route Capabilities & Lockdown", () => {
    it("restricts 'expenses:manage' capability exclusively to owner, partner, and manager", () => {
      expect(hasCapability("owner", "expenses:manage")).toBe(true);
      expect(hasCapability("partner", "expenses:manage")).toBe(true);
      expect(hasCapability("manager", "expenses:manage")).toBe(true);

      // Floor staff locked out
      expect(hasCapability("staff", "expenses:manage")).toBe(false);
      expect(hasCapability("trainer", "expenses:manage")).toBe(false);
    });

    it("restricts 'reports:view' analytics capability exclusively to owner, partner, and manager", () => {
      expect(hasCapability("owner", "reports:view")).toBe(true);
      expect(hasCapability("partner", "reports:view")).toBe(true);
      expect(hasCapability("manager", "reports:view")).toBe(true);

      // Floor staff locked out
      expect(hasCapability("staff", "reports:view")).toBe(false);
      expect(hasCapability("trainer", "reports:view")).toBe(false);
    });

    it("restricts 'financial:view' (P&L Command Center) exclusively to owner and partner", () => {
      expect(hasCapability("owner", "financial:view")).toBe(true);
      expect(hasCapability("partner", "financial:view")).toBe(true);

      expect(hasCapability("manager", "financial:view")).toBe(false);
      expect(hasCapability("staff", "financial:view")).toBe(false);
      expect(hasCapability("trainer", "financial:view")).toBe(false);
    });

    it("restricts 'settings:manage' exclusively to owner", () => {
      expect(hasCapability("owner", "settings:manage")).toBe(true);

      expect(hasCapability("partner", "settings:manage")).toBe(false);
      expect(hasCapability("manager", "settings:manage")).toBe(false);
      expect(hasCapability("staff", "settings:manage")).toBe(false);
      expect(hasCapability("trainer", "settings:manage")).toBe(false);
    });
  });

  describe("Anti-Privilege Escalation Rules in Staff Invitations (canAssignRole)", () => {
    it("ensures ONLY an owner can invite or promote another owner", () => {
      expect(canAssignRole("owner", "owner")).toBe(true);
      expect(canAssignRole("partner", "owner")).toBe(false);
      expect(canAssignRole("manager", "owner")).toBe(false);
      expect(canAssignRole("staff", "owner")).toBe(false);
      expect(canAssignRole("trainer", "owner")).toBe(false);
    });

    it("prevents partners from inviting owners or fellow partners", () => {
      expect(canAssignRole("partner", "owner")).toBe(false);
      expect(canAssignRole("partner", "partner")).toBe(false);
      expect(canAssignRole("partner", "manager")).toBe(true);
      expect(canAssignRole("partner", "staff")).toBe(true);
      expect(canAssignRole("partner", "trainer")).toBe(true);
    });

    it("prevents managers from inviting owners, partners, or fellow managers", () => {
      expect(canAssignRole("manager", "owner")).toBe(false);
      expect(canAssignRole("manager", "partner")).toBe(false);
      expect(canAssignRole("manager", "manager")).toBe(false);
      expect(canAssignRole("manager", "staff")).toBe(true);
      expect(canAssignRole("manager", "trainer")).toBe(true);
    });

    it("blocks floor staff and trainers from inviting any staff roles", () => {
      const allRoles: StaffRole[] = ["owner", "partner", "manager", "staff", "trainer"];

      for (const role of allRoles) {
        expect(canAssignRole("staff", role)).toBe(false);
        expect(canAssignRole("trainer", role)).toBe(false);
      }
    });
  });

  describe("Sole Owner Demotion & Deletion Protection (canDemoteOrRemoveOwner)", () => {
    it("blocks demoting or removing the sole owner of a gym workspace", () => {
      const activeOwnerCount = 1;
      expect(canDemoteOrRemoveOwner(activeOwnerCount)).toBe(false);
    });

    it("allows demoting or removing an owner if multiple active owners exist", () => {
      expect(canDemoteOrRemoveOwner(2)).toBe(true);
      expect(canDemoteOrRemoveOwner(3)).toBe(true);
    });

    it("blocks demotion or removal if owner count is 0 (safety edge-case)", () => {
      expect(canDemoteOrRemoveOwner(0)).toBe(false);
    });
  });
});
