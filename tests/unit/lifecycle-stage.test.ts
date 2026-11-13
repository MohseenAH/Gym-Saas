import { describe, it, expect } from "vitest";
import {
  resolveGymLifecycleStage,
  resolveInitialMembershipsTab,
  LifecycleMetrics,
} from "@/lib/utils";

describe("Gym Operational Lifecycle Stage Engine", () => {
  // ==========================================================================
  // 1. Stage 1: Setup Mode
  // ==========================================================================
  describe("STAGE_1_SETUP Transitions", () => {
    it("returns STAGE_1_SETUP when both plans and members are 0", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 0,
        membersCount: 0,
        unassignedCount: 0,
        membershipsCount: 0,
        todayCheckinsCount: 0,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_1_SETUP");
    });

    it("returns STAGE_1_SETUP when members exist but plans are 0", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 0,
        membersCount: 25,
        unassignedCount: 25,
        membershipsCount: 0,
        todayCheckinsCount: 0,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_1_SETUP");
    });

    it("returns STAGE_1_SETUP when plans exist but members count is 0", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 3,
        membersCount: 0,
        unassignedCount: 0,
        membershipsCount: 0,
        todayCheckinsCount: 0,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_1_SETUP");
    });
  });

  // ==========================================================================
  // 2. Stage 2: Unassigned Members Pending Plan Assignment
  // ==========================================================================
  describe("STAGE_2_UNASSIGNED Transitions", () => {
    it("returns STAGE_2_UNASSIGNED when plans and members exist with unassigned members", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 2,
        membersCount: 50,
        unassignedCount: 50,
        membershipsCount: 0,
        todayCheckinsCount: 0,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_2_UNASSIGNED");
    });

    it("prioritizes STAGE_2_UNASSIGNED even if some contracts already exist", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 4,
        membersCount: 100,
        unassignedCount: 12, // 12 members still need plans
        membershipsCount: 88,
        todayCheckinsCount: 15,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_2_UNASSIGNED");
    });
  });

  // ==========================================================================
  // 3. Stage 3: First Check-In Habit
  // ==========================================================================
  describe("STAGE_3_FIRST_CHECKIN Transitions", () => {
    it("returns STAGE_3_FIRST_CHECKIN when all members have plans but 0 check-ins occurred today", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 3,
        membersCount: 30,
        unassignedCount: 0,
        membershipsCount: 30,
        todayCheckinsCount: 0,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_3_FIRST_CHECKIN");
    });
  });

  // ==========================================================================
  // 4. Stage 4: Established Daily Operations
  // ==========================================================================
  describe("STAGE_4_ESTABLISHED Transitions", () => {
    it("returns STAGE_4_ESTABLISHED when members have contracts and at least 1 check-in occurred today", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 3,
        membersCount: 30,
        unassignedCount: 0,
        membershipsCount: 30,
        todayCheckinsCount: 1,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_4_ESTABLISHED");
    });

    it("returns STAGE_4_ESTABLISHED for high-volume active gym operations", () => {
      const metrics: LifecycleMetrics = {
        plansCount: 6,
        membersCount: 250,
        unassignedCount: 0,
        membershipsCount: 240,
        todayCheckinsCount: 85,
      };
      expect(resolveGymLifecycleStage(metrics)).toBe("STAGE_4_ESTABLISHED");
    });
  });
});

describe("Memberships Deep-Link Initial Tab Resolver", () => {
  // ==========================================================================
  // 1. Explicit Tab Parameter Precedence
  // ==========================================================================
  describe("Explicit Query Parameter Handling", () => {
    it("honors 'plans' tab deep-link regardless of member counts", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: "plans",
          unassignedCount: 50,
          activeCount: 0,
        })
      ).toBe("plans");
    });

    it("honors 'unassigned' tab deep-link", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: "unassigned",
          unassignedCount: 0,
          activeCount: 100,
        })
      ).toBe("unassigned");
    });

    it("honors 'expired' tab deep-link", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: "expired",
          unassignedCount: 5,
          activeCount: 20,
        })
      ).toBe("expired");
    });

    it("honors 'active' tab deep-link", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: "active",
          unassignedCount: 15,
          activeCount: 0,
        })
      ).toBe("active");
    });
  });

  // ==========================================================================
  // 2. Smart-Default Routing
  // ==========================================================================
  describe("Smart-Default Tab Routing", () => {
    it("defaults to 'unassigned' when unassignedCount > 0 and activeCount === 0", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: null,
          unassignedCount: 45,
          activeCount: 0,
        })
      ).toBe("unassigned");

      expect(
        resolveInitialMembershipsTab({
          tabParam: undefined,
          unassignedCount: 1,
          activeCount: 0,
        })
      ).toBe("unassigned");
    });

    it("defaults to 'active' when activeCount > 0 even if unassigned members exist", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: null,
          unassignedCount: 5,
          activeCount: 40,
        })
      ).toBe("active");
    });

    it("defaults to 'active' for brand new gym with 0 unassigned and 0 active", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: undefined,
          unassignedCount: 0,
          activeCount: 0,
        })
      ).toBe("active");
    });

    it("falls back to smart-defaults when tabParam is an unrecognized string", () => {
      expect(
        resolveInitialMembershipsTab({
          tabParam: "random_tab",
          unassignedCount: 20,
          activeCount: 0,
        })
      ).toBe("unassigned");

      expect(
        resolveInitialMembershipsTab({
          tabParam: "settings",
          unassignedCount: 0,
          activeCount: 10,
        })
      ).toBe("active");
    });
  });
});
