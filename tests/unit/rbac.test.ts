import { describe, it, expect } from "vitest";
import { StaffRole, ROLE_HIERARCHY, isRoleAtLeast } from "@/lib/auth/roles";

describe("Phase 2 RBAC & Hierarchy Unit Tests", () => {
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

  describe("Permission Matrix Rules (from Spec Section 3)", () => {
    function canViewFinancialPnL(role: StaffRole): boolean {
      return isRoleAtLeast(role, "partner");
    }

    function canRecordExpense(role: StaffRole): boolean {
      return isRoleAtLeast(role, "manager");
    }

    function canInvitePartners(role: StaffRole): boolean {
      return isRoleAtLeast(role, "partner");
    }

    function canInviteStaff(role: StaffRole): boolean {
      return isRoleAtLeast(role, "manager");
    }

    it("Only Owner and Partner can view Financial P&L Command Center", () => {
      expect(canViewFinancialPnL("owner")).toBe(true);
      expect(canViewFinancialPnL("partner")).toBe(true);
      expect(canViewFinancialPnL("manager")).toBe(false);
      expect(canViewFinancialPnL("staff")).toBe(false);
      expect(canViewFinancialPnL("trainer")).toBe(false);
    });

    it("Manager can record expenses, but Staff and Trainer cannot", () => {
      expect(canRecordExpense("owner")).toBe(true);
      expect(canRecordExpense("partner")).toBe(true);
      expect(canRecordExpense("manager")).toBe(true);
      expect(canRecordExpense("staff")).toBe(false);
      expect(canRecordExpense("trainer")).toBe(false);
    });

    it("TEST-P2-005: Manager cannot invite Partner or Owner (Escalation prevention)", () => {
      expect(canInvitePartners("manager")).toBe(false);
      expect(canInvitePartners("partner")).toBe(true);
      expect(canInvitePartners("owner")).toBe(true);
    });

    it("TEST-P2-006: Staff cannot invite Staff or Trainer (Escalation prevention)", () => {
      expect(canInviteStaff("staff")).toBe(false);
      expect(canInviteStaff("trainer")).toBe(false);
      expect(canInviteStaff("manager")).toBe(true);
    });
  });
});
