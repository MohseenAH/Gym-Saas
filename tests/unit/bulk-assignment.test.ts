import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkAssignMembershipsSchema } from "@/lib/validations/memberships";
import { bulkAssignMembershipsAction } from "@/lib/actions/memberships";
import { updateMemberAction } from "@/lib/actions/members";
import { normalizeIndianPhone, calculateMembershipEndDate } from "@/lib/utils";

// ============================================================================
// Mocks for Next.js Cache & Auth Guard
// ============================================================================

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockCallerRole = "owner";
let mockCallerGymId = "11111111-1111-4111-a111-111111111111";
let mockCallerBranchId = "22222222-2222-4222-a222-222222222222";
let mockGuardError: Error | null = null;

vi.mock("@/lib/auth/guard", () => ({
  getAuthorizedActionContext: vi.fn().mockImplementation(async ({ gymId, targetBranchId, capability }) => {
    if (mockGuardError) {
      throw mockGuardError;
    }
    if (mockCallerRole === "member" && capability === "members:manage") {
      throw new Error("Unauthorized: capability members:manage required");
    }
    return {
      userId: "staff-uuid-123",
      gymId: gymId || mockCallerGymId,
      gymName: "Powerhouse Gym",
      branchId: targetBranchId || mockCallerBranchId,
      role: mockCallerRole,
    };
  }),
}));

// ============================================================================
// Mock In-Memory Database State
// ============================================================================

let mockPlans: Array<{
  id: string;
  name: string;
  duration_days: number;
  price: number;
  is_active: boolean;
  branch_id: string | null;
  branches: { gym_id: string };
}> = [];

let mockMembers: Array<{
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  branch_id: string;
  status: string;
  branches: { gym_id: string };
}> = [];

let mockMemberships: Array<{
  id: string;
  member_id: string;
  plan_id: string;
  gym_id: string;
  branch_id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes?: string;
}> = [];

let mockPayments: any[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: (table: string) => {
      if (table === "membership_plans") {
        return {
          select: () => ({
            eq: (_col: string, planId: string) => ({
              single: () => {
                const plan = mockPlans.find((p) => p.id === planId);
                return Promise.resolve({
                  data: plan || null,
                  error: plan ? null : { message: "Plan not found" },
                });
              },
            }),
          }),
        };
      }

      if (table === "members") {
        return {
          select: () => ({
            in: (_col: string, memberIds: string[]) => ({
              eq: (_gymCol: string, gymId: string) => {
                const matched = mockMembers.filter(
                  (m) => memberIds.includes(m.id) && m.branches.gym_id === gymId
                );
                return Promise.resolve({ data: matched, error: null });
              },
            }),
            eq: (_col1: string, val1: string) => ({
              eq: (_col2: string, val2: string) => ({
                neq: (_col3: string, val3: string) => ({
                  maybeSingle: () => {
                    const match = mockMembers.find(
                      (m) =>
                        m.branches.gym_id === val1 &&
                        m.phone === val2 &&
                        m.id !== val3
                    );
                    return Promise.resolve({ data: match || null, error: null });
                  },
                }),
              }),
            }),
          }),
          update: (updates: any) => ({
            eq: (_col: string, memberId: string) => {
              const idx = mockMembers.findIndex((m) => m.id === memberId);
              if (idx !== -1) {
                mockMembers[idx] = { ...mockMembers[idx], ...updates };
              }
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      if (table === "memberships") {
        return {
          select: () => ({
            in: (_col: string, memberIds: string[]) => ({
              lte: (_startCol: string, maxStart: string) => ({
                gte: (_endCol: string, minEnd: string) => {
                  const contracts = mockMemberships.filter(
                    (c) =>
                      memberIds.includes(c.member_id) &&
                      c.start_date <= maxStart &&
                      c.end_date >= minEnd
                  );
                  return Promise.resolve({ data: contracts, error: null });
                },
              }),
            }),
          }),
          insert: (rows: any[]) => {
            const inserted = rows.map((r, i) => ({
              id: `membership-auto-${Date.now()}-${i}`,
              ...r,
            }));
            mockMemberships.push(...inserted);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === "payments") {
        return {
          insert: (rows: any[]) => {
            mockPayments.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }

      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    },
  })),
}));

describe("Phase C: Bulk Membership Assignment Workspace & Cross-Module Hardening", () => {
  const gymId = "11111111-1111-4111-a111-111111111111";
  const branchId = "22222222-2222-4222-a222-222222222222";
  const foreignGymId = "99999999-9999-4999-a999-999999999999";
  const foreignBranchId = "88888888-8888-4888-a888-888888888888";

  const memberAId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
  const memberBId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
  const memberCId = "cccccccc-cccc-4ccc-accc-cccccccccccc";
  const plan1MonthId = "33333333-3333-4333-a333-333333333333";
  const planInactiveId = "44444444-4444-4444-a444-444444444444";
  const planForeignGymId = "55555555-5555-4555-a555-555555555555";
  const planForeignBranchId = "66666666-6666-4666-a666-666666666666";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallerRole = "owner";
    mockCallerGymId = gymId;
    mockCallerBranchId = branchId;
    mockGuardError = null;
    mockPayments = [];

    mockPlans = [
      {
        id: plan1MonthId,
        name: "1 Month Standard",
        duration_days: 30,
        price: 2000,
        is_active: true,
        branch_id: branchId,
        branches: { gym_id: gymId },
      },
      {
        id: planInactiveId,
        name: "Old Archived Plan",
        duration_days: 30,
        price: 1500,
        is_active: false,
        branch_id: branchId,
        branches: { gym_id: gymId },
      },
      {
        id: planForeignGymId,
        name: "Cross Gym Plan",
        duration_days: 30,
        price: 3000,
        is_active: true,
        branch_id: foreignBranchId,
        branches: { gym_id: foreignGymId },
      },
      {
        id: planForeignBranchId,
        name: "Other Branch Plan",
        duration_days: 30,
        price: 2500,
        is_active: true,
        branch_id: foreignBranchId,
        branches: { gym_id: gymId },
      },
    ];

    mockMembers = [
      {
        id: memberAId,
        full_name: "Rahul Verma",
        phone: "9876543210",
        branch_id: branchId,
        status: "active",
        branches: { gym_id: gymId },
      },
      {
        id: memberBId,
        full_name: "Pooja Sharma",
        phone: "9876543211",
        branch_id: branchId,
        status: "active",
        branches: { gym_id: gymId },
      },
      {
        id: memberCId,
        full_name: "Vikram Malhotra",
        phone: "9876543212",
        branch_id: foreignBranchId, // different branch!
        status: "active",
        branches: { gym_id: gymId },
      },
    ];

    mockMemberships = [];
  });

  // ==========================================================================
  // 1. Unassigned Queue Filtering Rule
  // ==========================================================================
  describe("1. Unassigned Queue Classification Rule", () => {
    // The exact predicate used in v2/app/app/[gymId]/memberships/page.tsx:
    // !m.memberships || m.memberships.length === 0
    function isUnassigned(member: { memberships?: Array<{ id: string; status?: string }> | null }) {
      return !member.memberships || member.memberships.length === 0;
    }

    it("identifies members with 0 membership rows as strictly unassigned", () => {
      expect(isUnassigned({ memberships: [] })).toBe(true);
      expect(isUnassigned({ memberships: null })).toBe(true);
      expect(isUnassigned({ memberships: undefined })).toBe(true);
    });

    it("excludes members with active contracts from the unassigned queue", () => {
      const activeMember = { memberships: [{ id: "mem-1", status: "active" }] };
      expect(isUnassigned(activeMember)).toBe(false);
    });

    it("excludes members with expired contracts from the unassigned queue (retains in expired tab)", () => {
      const expiredMember = { memberships: [{ id: "mem-2", status: "expired" }] };
      expect(isUnassigned(expiredMember)).toBe(false);
    });

    it("excludes members with cancelled contracts from the unassigned queue", () => {
      const cancelledMember = { memberships: [{ id: "mem-3", status: "cancelled" }] };
      expect(isUnassigned(cancelledMember)).toBe(false);
    });
  });

  // ==========================================================================
  // 2. IST Expiry Calculation Parity
  // ==========================================================================
  describe("2. IST Expiry Date Calculation Parity", () => {
    it("calculates exact 30-day inclusive bounds matching single assignment (Nov 1 -> Nov 30)", () => {
      // 30 days starting Nov 1 = Nov 30 (1st through 30th inclusive = 30 days)
      const end = calculateMembershipEndDate("2026-11-01", 30);
      expect(end).toBe("2026-11-30");
    });

    it("calculates exact 1-day plan ending on same start date", () => {
      const end = calculateMembershipEndDate("2026-11-14", 1);
      expect(end).toBe("2026-11-14");
    });

    it("calculates 90-day plan crossing month boundaries accurately", () => {
      // Jan 1: 31 in Jan + 28 in Feb 2026 + 31 in Mar = 90 days -> ends Mar 31
      const end = calculateMembershipEndDate("2026-01-01", 90);
      expect(end).toBe("2026-03-31");
    });

    it("calculates 365-day annual pass accurately", () => {
      const end = calculateMembershipEndDate("2026-01-01", 365);
      expect(end).toBe("2026-12-31");
    });

    it("handles month rollover across year boundary (Dec 1, 60 days)", () => {
      // Dec has 31 days (31 days). Jan has 29 days needed (total 60) -> ends Jan 29
      const end = calculateMembershipEndDate("2026-12-01", 60);
      expect(end).toBe("2027-01-29");
    });
  });

  // ==========================================================================
  // 3. Schema & Validation Directives
  // ==========================================================================
  describe("3. Schema & Validation Directives", () => {
    it("accepts valid bulk assignment input", () => {
      const input = {
        gymId,
        branchId,
        memberIds: [memberAId, memberBId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      };
      const res = bulkAssignMembershipsSchema.safeParse(input);
      expect(res.success).toBe(true);
    });

    it("rejects empty memberIds array", () => {
      const input = {
        gymId,
        branchId,
        memberIds: [],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      };
      const res = bulkAssignMembershipsSchema.safeParse(input);
      expect(res.success).toBe(false);
      if (!res.success) {
        const issues = res.error.issues || [];
        expect(issues[0]?.message).toContain("Select at least 1 member");
      }
    });

    it("rejects invalid date format", () => {
      const input = {
        gymId,
        branchId,
        memberIds: [memberAId],
        planId: plan1MonthId,
        startDate: "01-11-2026",
      };
      const res = bulkAssignMembershipsSchema.safeParse(input);
      expect(res.success).toBe(false);
    });

    it("rejects non-uuid identifiers", () => {
      const badGym = bulkAssignMembershipsSchema.safeParse({
        gymId: "not-a-uuid",
        branchId,
        memberIds: [memberAId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });
      expect(badGym.success).toBe(false);

      const badMember = bulkAssignMembershipsSchema.safeParse({
        gymId,
        branchId,
        memberIds: ["not-a-uuid"],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });
      expect(badMember.success).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Execution: Happy Path & Payment Invariant
  // ==========================================================================
  describe("4. Execution: Happy Path & Zero Payment Invariant", () => {
    it("assigns active memberships to eligible members and creates ZERO payment records", async () => {
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId, memberBId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(true);
      expect(res.assignedCount).toBe(2);
      expect(res.skippedMembers).toHaveLength(0);

      // Verify memberships inserted
      expect(mockMemberships).toHaveLength(2);
      expect(mockMemberships[0]).toMatchObject({
        gym_id: gymId,
        branch_id: branchId,
        member_id: memberAId,
        plan_id: plan1MonthId,
        start_date: "2026-11-01",
        end_date: "2026-11-30",
        notes: "Bulk assigned: 1 Month Standard",
      });
      expect(mockMemberships[1].member_id).toBe(memberBId);

      // INVARIANT: Zero payment rows inserted. Pending dues will reflect full plan price.
      expect(mockPayments).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 5. Tenant & Branch Isolation Safeguards
  // ==========================================================================
  describe("5. Tenant & Branch Isolation Safeguards", () => {
    it("rejects assignment if plan belongs to a foreign gym", async () => {
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId],
        planId: planForeignGymId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized plan access across gym boundary");
      expect(mockMemberships).toHaveLength(0);
    });

    it("rejects assignment if plan belongs to a different branch than target branch", async () => {
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId],
        planId: planForeignBranchId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Plan belongs to a different branch than the target assignment branch");
      expect(mockMemberships).toHaveLength(0);
    });

    it("rejects assignment of inactive / archived plan", async () => {
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId],
        planId: planInactiveId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Cannot assign an inactive membership plan");
      expect(mockMemberships).toHaveLength(0);
    });

    it("skips members belonging to a different branch than target assignment branch", async () => {
      // memberC is at foreignBranchId
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId, memberCId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(true);
      expect(res.assignedCount).toBe(1); // Only memberA assigned
      expect(res.skippedMembers).toHaveLength(1);
      expect(res.skippedMembers[0]).toMatchObject({
        memberId: memberCId,
        fullName: "Vikram Malhotra",
        reason: "Member belongs to a different branch than the target assignment branch",
      });
      expect(mockMemberships).toHaveLength(1);
      expect(mockMemberships[0].member_id).toBe(memberAId);
    });

    it("skips non-existent or foreign gym member IDs gracefully", async () => {
      const ghostId = "77777777-7777-4777-a777-777777777777";
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [ghostId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(true);
      expect(res.assignedCount).toBe(0);
      expect(res.skippedMembers).toHaveLength(1);
      expect(res.skippedMembers[0].reason).toContain("Member not found or unauthorized");
    });
  });

  // ==========================================================================
  // 6. Date Overlap Protection
  // ==========================================================================
  describe("6. Date Overlap Protection", () => {
    it("skips members with overlapping contracts while assigning non-overlapping members", async () => {
      // Existing active contract for Member A: Nov 15 to Dec 15
      mockMemberships.push({
        id: "mem-existing-1",
        gym_id: gymId,
        branch_id: branchId,
        member_id: memberAId,
        plan_id: plan1MonthId,
        start_date: "2026-11-15",
        end_date: "2026-12-15",
        status: "active",
      });

      // Try bulk assigning Nov 1 to Nov 30 (overlaps with Nov 15 - Dec 15)
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId, memberBId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(true);
      expect(res.assignedCount).toBe(1); // Member B assigned
      expect(res.skippedMembers).toHaveLength(1);
      expect(res.skippedMembers[0]).toMatchObject({
        memberId: memberAId,
        fullName: "Rahul Verma",
        reason: "Overlaps with existing contract (2026-11-15 to 2026-12-15)",
      });

      // Exactly 1 new membership added (Member B)
      expect(mockMemberships.filter((m) => m.member_id === memberBId)).toHaveLength(1);
    });

    it("ignores cancelled contracts when evaluating date overlaps", async () => {
      // Existing CANCELLED contract for Member A: Nov 15 to Dec 15
      mockMemberships.push({
        id: "mem-cancelled-1",
        gym_id: gymId,
        branch_id: branchId,
        member_id: memberAId,
        plan_id: plan1MonthId,
        start_date: "2026-11-15",
        end_date: "2026-12-15",
        status: "cancelled",
      });

      // Assigning Nov 1 to Nov 30 should succeed for Member A because cancelled contracts don't block
      const res = await bulkAssignMembershipsAction({
        gymId,
        branchId,
        memberIds: [memberAId],
        planId: plan1MonthId,
        startDate: "2026-11-01",
      });

      expect(res.success).toBe(true);
      expect(res.assignedCount).toBe(1);
      expect(res.skippedMembers).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 7. Cross-Module Hardening: Phone Uniqueness on Member Update
  // ==========================================================================
  describe("7. Cross-Module Hardening: Member Update Phone Collision", () => {
    it("rejects phone update if another member in the gym already has that normalized phone", async () => {
      // Member B already has phone "9876543211"
      // Attempt to update Member A's phone to "+91 98765-43211" (matches Member B after normalization)
      const res = await updateMemberAction({
        gymId,
        branchId,
        memberId: memberAId,
        fullName: "Rahul Verma",
        phone: "+91 98765-43211",
        status: "active",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("A member with phone number 9876543211 already exists (Pooja Sharma).");
    });

    it("permits member update when retaining their own existing normalized phone", async () => {
      // Member A updates their name or notes, keeping their same phone "9876543210"
      const res = await updateMemberAction({
        gymId,
        branchId,
        memberId: memberAId,
        fullName: "Rahul Verma Updated",
        phone: "+91 98765 43210",
        notes: "Updated note",
        status: "active",
      });

      expect(res.success).toBe(true);
      const updated = mockMembers.find((m) => m.id === memberAId);
      expect(updated?.full_name).toBe("Rahul Verma Updated");
      expect(updated?.phone).toBe("9876543210");
    });

    it("rejects invalid phone string formats during member update", async () => {
      const res = await updateMemberAction({
        gymId,
        branchId,
        memberId: memberAId,
        fullName: "Rahul Verma",
        phone: "invalid-phone",
        status: "active",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Phone number contains invalid characters");
    });
  });
});
