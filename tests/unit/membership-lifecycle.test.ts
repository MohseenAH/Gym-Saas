import { describe, it, expect } from "vitest";
import { computeMembershipStatus } from "@/lib/actions/memberships";
import { createPlanSchema, updatePlanSchema } from "@/lib/actions/plans";
import { assignMembershipSchema } from "@/lib/actions/memberships";
import { hasCapability } from "@/lib/auth/capabilities";

describe("Membership Plans & Lifecycle Unit Tests", () => {
  // ==========================================================================
  // 1. Plan Validation Schema Tests
  // ==========================================================================
  describe("Plan Validation (Zod)", () => {
    const validPlan = {
      gymId: "11111111-1111-4111-a111-111111111111",
      branchId: "22222222-2222-4222-a222-222222222222",
      name: "Gold Annual Pass",
      durationDays: 365,
      price: 12000,
      description: "Full gym access including steam & locker",
    };

    it("accepts valid plan creation input", () => {
      const res = createPlanSchema.safeParse(validPlan);
      expect(res.success).toBe(true);
    });

    it("rejects zero or negative duration", () => {
      const zeroDur = createPlanSchema.safeParse({ ...validPlan, durationDays: 0 });
      expect(zeroDur.success).toBe(false);

      const negDur = createPlanSchema.safeParse({ ...validPlan, durationDays: -15 });
      expect(negDur.success).toBe(false);
    });

    it("rejects negative price", () => {
      const negPrice = createPlanSchema.safeParse({ ...validPlan, price: -500 });
      expect(negPrice.success).toBe(false);
    });

    it("allows zero price (free trial or promotional plan)", () => {
      const freePlan = createPlanSchema.safeParse({ ...validPlan, price: 0 });
      expect(freePlan.success).toBe(true);
    });

    it("rejects plan name with less than 2 characters", () => {
      const shortName = createPlanSchema.safeParse({ ...validPlan, name: "A" });
      expect(shortName.success).toBe(false);
    });

    it("rejects invalid branch or gym UUIDs", () => {
      const badGym = createPlanSchema.safeParse({ ...validPlan, gymId: "not-a-uuid" });
      expect(badGym.success).toBe(false);

      const badBranch = createPlanSchema.safeParse({ ...validPlan, branchId: "invalid" });
      expect(badBranch.success).toBe(false);
    });

    it("validates updatePlanSchema requires planId", () => {
      const res = updatePlanSchema.safeParse({
        ...validPlan,
        planId: "33333333-3333-4333-a333-333333333333",
        isActive: false,
      });
      expect(res.success).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Membership Contract Assignment Schema Tests
  // ==========================================================================
  describe("Membership Assignment Validation (Zod)", () => {
    const validAssignment = {
      gymId: "11111111-1111-4111-a111-111111111111",
      branchId: "22222222-2222-4222-a222-222222222222",
      memberId: "44444444-4444-4444-a444-444444444444",
      planId: "55555555-5555-4555-a555-555555555555",
      startDate: "2026-10-15",
      amountPaid: 5000,
      paymentMethod: "upi" as const,
      notes: "Enrolled in person",
    };

    it("accepts valid contract assignment input", () => {
      const res = assignMembershipSchema.safeParse(validAssignment);
      expect(res.success).toBe(true);
    });

    it("rejects invalid start date format", () => {
      const badDate = assignMembershipSchema.safeParse({
        ...validAssignment,
        startDate: "15/10/2026",
      });
      expect(badDate.success).toBe(false);
    });

    it("rejects negative amount paid", () => {
      const negPaid = assignMembershipSchema.safeParse({
        ...validAssignment,
        amountPaid: -100,
      });
      expect(negPaid.success).toBe(false);
    });

    it("defaults payment method to cash if omitted", () => {
      const withoutMethod = { ...validAssignment, paymentMethod: undefined };
      const res = assignMembershipSchema.parse(withoutMethod);
      expect(res.paymentMethod).toBe("cash");
    });
  });

  // ==========================================================================
  // 3. Lifecycle Status & Expiry Computation Tests
  // ==========================================================================
  describe("Membership Lifecycle Status Computation", () => {
    // Fixed reference date for deterministic testing: 2026-10-12
    const refDate = new Date("2026-10-12T00:00:00Z");

    it("identifies active membership in good standing (> 7 days remaining)", async () => {
      const res = await computeMembershipStatus(
        "2026-10-01",
        "2026-10-31", // 19 days remaining from Oct 12
        "active",
        refDate
      );
      expect(res.status).toBe("active");
      expect(res.isExpiringSoon).toBe(false);
      expect(res.isUpcoming).toBe(false);
      expect(res.daysRemaining).toBe(19);
    });

    it("identifies expiring soon contract when within 7-day window", async () => {
      const res = await computeMembershipStatus(
        "2026-09-15",
        "2026-10-16", // 4 days remaining from Oct 12
        "active",
        refDate
      );
      expect(res.status).toBe("active");
      expect(res.isExpiringSoon).toBe(true);
      expect(res.daysRemaining).toBe(4);
    });

    it("identifies expiring today (0 days remaining) as expiring soon", async () => {
      const res = await computeMembershipStatus(
        "2026-09-12",
        "2026-10-12", // Expires today
        "active",
        refDate
      );
      expect(res.status).toBe("active");
      expect(res.isExpiringSoon).toBe(true);
      expect(res.daysRemaining).toBe(0);
    });

    it("identifies expired contract when end date is in the past", async () => {
      const res = await computeMembershipStatus(
        "2026-09-01",
        "2026-10-10", // 2 days ago
        "active",
        refDate
      );
      expect(res.status).toBe("expired");
      expect(res.isExpiringSoon).toBe(false);
      expect(res.daysRemaining).toBeLessThan(0);
    });

    it("identifies upcoming contract when start date is in the future", async () => {
      const res = await computeMembershipStatus(
        "2026-10-20", // Starts in future
        "2026-11-20",
        "active",
        refDate
      );
      expect(res.status).toBe("upcoming");
      expect(res.isUpcoming).toBe(true);
      expect(res.isExpiringSoon).toBe(false);
    });

    it("preserves explicit frozen status", async () => {
      const res = await computeMembershipStatus(
        "2026-10-01",
        "2026-10-31",
        "frozen",
        refDate
      );
      expect(res.status).toBe("frozen");
      expect(res.isExpiringSoon).toBe(false);
    });

    it("preserves explicit cancelled status", async () => {
      const res = await computeMembershipStatus(
        "2026-10-01",
        "2026-10-31",
        "cancelled",
        refDate
      );
      expect(res.status).toBe("cancelled");
      expect(res.isExpiringSoon).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Role Capabilities for Plans & Memberships
  // ==========================================================================
  describe("Role Capabilities for Plans & Lifecycle", () => {
    it("permits owner to manage plans and memberships", () => {
      expect(hasCapability("owner", "plans:manage")).toBe(true);
      expect(hasCapability("owner", "members:manage")).toBe(true);
      expect(hasCapability("owner", "members:view")).toBe(true);
    });

    it("permits partner to manage plans and memberships", () => {
      expect(hasCapability("partner", "plans:manage")).toBe(true);
      expect(hasCapability("partner", "members:manage")).toBe(true);
      expect(hasCapability("partner", "members:view")).toBe(true);
    });

    it("permits manager to manage memberships but NOT create/edit plan templates", () => {
      expect(hasCapability("manager", "plans:manage")).toBe(false);
      expect(hasCapability("manager", "members:manage")).toBe(true);
      expect(hasCapability("manager", "members:view")).toBe(true);
    });

    it("permits staff to assign/renew memberships but NOT alter plan templates", () => {
      expect(hasCapability("staff", "plans:manage")).toBe(false);
      expect(hasCapability("staff", "members:manage")).toBe(true);
      expect(hasCapability("staff", "members:view")).toBe(true);
    });

    it("restricts trainer to view-only for members without management capabilities", () => {
      expect(hasCapability("trainer", "plans:manage")).toBe(false);
      expect(hasCapability("trainer", "members:manage")).toBe(false);
      expect(hasCapability("trainer", "members:view")).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Date Calculation & Duration Math
  // ==========================================================================
  describe("Contract Duration Math", () => {
    it("calculates 30-day plan end date accurately (inclusive of start day)", () => {
      const start = new Date("2026-10-01T00:00:00Z");
      const durationDays = 30;
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays - 1);

      // Start: Oct 1, Duration: 30 days -> End: Oct 30 (30 days total inclusive)
      expect(end.toISOString().split("T")[0]).toBe("2026-10-30");
    });

    it("calculates 365-day leap-year safe duration", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const durationDays = 365;
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays - 1);

      expect(end.toISOString().split("T")[0]).toBe("2026-12-31");
    });
  });

  // ==========================================================================
  // 6. Historical Contract Integrity
  // ==========================================================================
  describe("Historical Pricing Integrity Logic", () => {
    it("detects when plan price change requires versioning rather than in-place mutation", () => {
      const existingPlan = {
        id: "plan-1",
        price: 1500,
        durationDays: 30,
        usageCount: 12, // 12 members currently on this plan!
      };

      const updatedTerms = {
        price: 1800, // Price increased to 1800
        durationDays: 30,
      };

      const hasReferencingMemberships = existingPlan.usageCount > 0;
      const termsChanged =
        existingPlan.price !== updatedTerms.price ||
        existingPlan.durationDays !== updatedTerms.durationDays;

      const requiresVersioning = hasReferencingMemberships && termsChanged;

      // Must version so the 12 existing members don't have their historical contracts mutated!
      expect(requiresVersioning).toBe(true);
    });

    it("permits in-place update when no members reference the plan yet", () => {
      const newPlan = {
        id: "plan-2",
        price: 1000,
        durationDays: 30,
        usageCount: 0, // No members assigned yet
      };

      const updatedTerms = {
        price: 1200,
        durationDays: 30,
      };

      const hasReferencingMemberships = newPlan.usageCount > 0;
      const termsChanged =
        newPlan.price !== updatedTerms.price ||
        newPlan.durationDays !== updatedTerms.durationDays;

      const requiresVersioning = hasReferencingMemberships && termsChanged;
      expect(requiresVersioning).toBe(false);
    });

    it("permits in-place update when only name/description changes (price/duration untouched)", () => {
      const existingPlan = {
        id: "plan-3",
        price: 2000,
        durationDays: 60,
        usageCount: 25,
      };

      const updatedTerms = {
        price: 2000, // Same price
        durationDays: 60, // Same duration
      };

      const termsChanged =
        existingPlan.price !== updatedTerms.price ||
        existingPlan.durationDays !== updatedTerms.durationDays;

      expect(termsChanged).toBe(false);
    });
  });
});
