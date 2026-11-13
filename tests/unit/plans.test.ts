import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPlanSchema,
  updatePlanSchema,
  togglePlanSchema,
  deletePlanSchema,
  createPlanAction,
  updatePlanAction,
  togglePlanAction,
  deletePlanAction,
} from "@/lib/actions/plans";

// Mocks for Next.js cache and Auth guard
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  getAuthorizedActionContext: vi.fn().mockImplementation(async ({ gymId, targetBranchId }) => ({
    userId: "staff-uuid-123",
    gymId,
    branchId: targetBranchId || "branch-1111-1111-1111-1111",
    role: "owner",
  })),
}));

// Mutable mock state for Supabase
let mockBranches: Array<{ id: string; gym_id: string; name?: string }> = [];
let mockPlans: Array<{
  id: string;
  branch_id: string;
  name: string;
  description?: string | null;
  duration_days: number;
  price: number;
  is_active: boolean;
  branches: { gym_id: string };
}> = [];
let mockMembershipsCountByPlan: Record<string, number> = {};
let mockDeletedPlanIds: string[] = [];
let mockInsertedPlans: any[] = [];
let mockUpdatedPlans: any[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: (table: string) => {
      if (table === "branches") {
        return {
          select: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: (_col2: string, val2: string) => ({
                single: () => {
                  const b = mockBranches.find((br) => br.id === val1 && br.gym_id === val2);
                  return Promise.resolve({ data: b || null, error: b ? null : { message: "Branch not found" } });
                },
              }),
            }),
          }),
        };
      }

      if (table === "memberships") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => ({
            eq: (_col: string, planId: string) => {
              const count = mockMembershipsCountByPlan[planId] || 0;
              return Promise.resolve({ count, error: null });
            },
          }),
        };
      }

      if (table === "membership_plans") {
        return {
          select: () => ({
            eq: (_col: string, planId: string) => ({
              single: () => {
                const plan = mockPlans.find((p) => p.id === planId);
                return Promise.resolve({ data: plan || null, error: plan ? null : { message: "Plan not found" } });
              },
            }),
          }),
          insert: (data: any) => {
            const newId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const created = { id: newId, ...data };
            mockInsertedPlans.push(created);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: created, error: null }),
              }),
            };
          },
          update: (updates: any) => ({
            eq: (_col: string, planId: string) => {
              mockUpdatedPlans.push({ planId, updates });
              const idx = mockPlans.findIndex((p) => p.id === planId);
              if (idx !== -1) {
                mockPlans[idx] = { ...mockPlans[idx], ...updates };
              }
              return Promise.resolve({ error: null });
            },
          }),
          delete: () => ({
            eq: (_col: string, planId: string) => {
              mockDeletedPlanIds.push(planId);
              mockPlans = mockPlans.filter((p) => p.id !== planId);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      };
    },
  })),
}));

describe("Phase B: Flexible Membership Plan Studio Suite", () => {
  const gymId = "11111111-1111-4111-8111-111111111111";
  const branchId = "22222222-2222-4222-8222-222222222222";
  const planId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mockBranches = [{ id: branchId, gym_id: gymId, name: "Downtown Branch" }];
    mockPlans = [
      {
        id: planId,
        branch_id: branchId,
        name: "Standard 1 Month",
        description: "Full gym floor access",
        duration_days: 30,
        price: 1500,
        is_active: true,
        branches: { gym_id: gymId },
      },
    ];
    mockMembershipsCountByPlan = {};
    mockDeletedPlanIds = [];
    mockInsertedPlans = [];
    mockUpdatedPlans = [];
  });

  // ==========================================================================
  // 1. Arbitrary Custom Duration Validation
  // ==========================================================================
  describe("Duration Validation (createPlanSchema & updatePlanSchema)", () => {
    it("accepts all standard preset durations: 15, 30, 90, 180, and 365 days", () => {
      const presets = [15, 30, 90, 180, 365];
      for (const days of presets) {
        const res = createPlanSchema.safeParse({
          gymId,
          branchId,
          name: `Preset ${days} Days`,
          durationDays: days,
          price: 1000,
        });
        expect(res.success).toBe(true);
      }
    });

    it("accepts arbitrary custom durations between 1 and 3650 days", () => {
      const customDurations = [1, 7, 21, 45, 100, 200, 730, 3650];
      for (const days of customDurations) {
        const res = createPlanSchema.safeParse({
          gymId,
          branchId,
          name: `Custom ${days} Days`,
          durationDays: days,
          price: 2500,
        });
        expect(res.success).toBe(true);
      }
    });

    it("rejects 0 days, negative days, and non-integer durations", () => {
      const zeroRes = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Zero Days",
        durationDays: 0,
        price: 1000,
      });
      expect(zeroRes.success).toBe(false);

      const negRes = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Negative Days",
        durationDays: -15,
        price: 1000,
      });
      expect(negRes.success).toBe(false);

      const floatRes = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Fractional Days",
        durationDays: 30.5,
        price: 1000,
      });
      expect(floatRes.success).toBe(false);
    });

    it("rejects durations exceeding 3650 days (10 years)", () => {
      const res = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Too Long Plan",
        durationDays: 3651,
        price: 10000,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("cannot exceed 3,650 days");
      }
    });
  });

  // ==========================================================================
  // 2. Price Non-Negativity Validation
  // ==========================================================================
  describe("Price Validation (createPlanSchema & updatePlanSchema)", () => {
    it("allows ₹0 price for promotional or trial plans", () => {
      const res = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Free 15-Day Trial",
        durationDays: 15,
        price: 0,
      });
      expect(res.success).toBe(true);
    });

    it("allows standard positive prices", () => {
      const res = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Quarterly Regular",
        durationDays: 90,
        price: 4500,
      });
      expect(res.success).toBe(true);
    });

    it("rejects negative prices", () => {
      const res = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Negative Price",
        durationDays: 30,
        price: -500,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("Price cannot be negative");
      }
    });

    it("rejects prices exceeding ₹1,00,00,000", () => {
      const res = createPlanSchema.safeParse({
        gymId,
        branchId,
        name: "Ultra Price",
        durationDays: 365,
        price: 10000001,
      });
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Plan Creation Action & Active State
  // ==========================================================================
  describe("createPlanAction", () => {
    it("creates an active plan by default with valid inputs", async () => {
      const res = await createPlanAction({
        gymId,
        branchId,
        name: "Special Monsoon Pass",
        description: "Monsoon special 45 days pass",
        durationDays: 45,
        price: 2200,
      });

      expect(res.success).toBe(true);
      expect(mockInsertedPlans).toHaveLength(1);
      expect(mockInsertedPlans[0].name).toBe("Special Monsoon Pass");
      expect(mockInsertedPlans[0].duration_days).toBe(45);
      expect(mockInsertedPlans[0].price).toBe(2200);
      expect(mockInsertedPlans[0].is_active).toBe(true);
    });

    it("creates a draft/archived plan when isActive: false is passed", async () => {
      const res = await createPlanAction({
        gymId,
        branchId,
        name: "Draft Diwali Plan",
        durationDays: 60,
        price: 3500,
        isActive: false,
      });

      expect(res.success).toBe(true);
      expect(mockInsertedPlans[0].is_active).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Deletion Guard & Referenced Contracts Invariant
  // ==========================================================================
  describe("deletePlanAction & Safe Deletion Guard", () => {
    it("BLOCKS hard deletion when contracts reference the plan and returns exact error message", async () => {
      // Simulate that 5 active/historical member contracts reference this plan
      mockMembershipsCountByPlan[planId] = 5;

      const res = await deletePlanAction({
        gymId,
        planId,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe(
        "Cannot delete plan with existing member contracts. Archive it instead."
      );
      // Ensure the plan was NOT deleted
      expect(mockDeletedPlanIds).not.toContain(planId);
      expect(mockPlans.find((p) => p.id === planId)).toBeDefined();
    });

    it("permits hard deletion when zero contracts reference the plan", async () => {
      mockMembershipsCountByPlan[planId] = 0;

      const res = await deletePlanAction({
        gymId,
        planId,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("has been permanently deleted");
      expect(mockDeletedPlanIds).toContain(planId);
      expect(mockPlans.find((p) => p.id === planId)).toBeUndefined();
    });

    it("blocks deletion of a plan belonging to another gym", async () => {
      const foreignPlanId = "99999999-9999-4999-a999-999999999999";
      mockPlans = [
        {
          id: foreignPlanId,
          branch_id: branchId,
          name: "Foreign Plan",
          duration_days: 30,
          price: 1000,
          is_active: true,
          branches: { gym_id: "other-gym-uuid" },
        },
      ];

      const res = await deletePlanAction({
        gymId,
        planId: foreignPlanId,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");
    });
  });

  // ==========================================================================
  // 5. Soft-Archival & Availability Toggling
  // ==========================================================================
  describe("togglePlanAction & Soft Archival", () => {
    it("soft-archives an active plan by setting is_active = false", async () => {
      const res = await togglePlanAction({
        gymId,
        planId,
        isActive: false,
      });

      expect(res.success).toBe(true);
      expect(mockPlans.find((p) => p.id === planId)?.is_active).toBe(false);
    });

    it("re-activates an archived plan by setting is_active = true", async () => {
      mockPlans[0].is_active = false;

      const res = await togglePlanAction({
        gymId,
        planId,
        isActive: true,
      });

      expect(res.success).toBe(true);
      expect(mockPlans.find((p) => p.id === planId)?.is_active).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Contract Terms Preservation & Versioning Invariant
  // ==========================================================================
  describe("updatePlanAction & Historical Terms Preservation", () => {
    it("preserves historical contract terms by versioning (deactivating old, creating new) when price or duration changes on a referenced plan", async () => {
      // Plan has existing member contracts
      mockMembershipsCountByPlan[planId] = 12;

      const res = await updatePlanAction({
        gymId,
        planId,
        branchId,
        name: "Standard 1 Month (Price Hike)",
        durationDays: 30,
        price: 2000, // Price changed from 1500 to 2000
      });

      expect(res.success).toBe(true);
      expect(res.versioned).toBe(true);
      expect(res.message).toContain("historical terms preserved");

      // Verify that the old plan was deactivated so old contracts keep their terms
      expect(mockPlans.find((p) => p.id === planId)?.is_active).toBe(false);

      // Verify a new plan was inserted with updated price
      expect(mockInsertedPlans).toHaveLength(1);
      expect(mockInsertedPlans[0].price).toBe(2000);
      expect(mockInsertedPlans[0].duration_days).toBe(30);
    });

    it("updates in-place without versioning when memberships count is 0", async () => {
      mockMembershipsCountByPlan[planId] = 0;

      const res = await updatePlanAction({
        gymId,
        planId,
        branchId,
        name: "Updated Plan Name",
        durationDays: 45,
        price: 1800,
      });

      expect(res.success).toBe(true);
      expect(res.versioned).toBe(false);
      expect(mockInsertedPlans).toHaveLength(0);
      expect(mockPlans.find((p) => p.id === planId)?.name).toBe("Updated Plan Name");
      expect(mockPlans.find((p) => p.id === planId)?.duration_days).toBe(45);
    });
  });
});
