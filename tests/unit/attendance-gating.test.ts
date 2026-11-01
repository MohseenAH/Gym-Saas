import { describe, it, expect } from "vitest";
import { z } from "zod";
import { isMembershipValidForAttendance, getTodayIST, getISTDateString } from "@/lib/utils";

// Replicate action input schemas for unit testing input invariants
const staffCheckInSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  memberId: z.string().uuid("Invalid member ID"),
});

const memberSelfCheckInSchema = z.object({
  gymId: z.string().uuid("Invalid gym ID"),
  memberId: z.string().uuid("Invalid member ID").optional(),
});

describe("Phase 2: Attendance Gating & Check-in Invariant Suite", () => {
  const gymId = "11111111-1111-4111-a111-111111111111";
  const branchId = "22222222-2222-4222-a222-222222222222";
  const memberId = "33333333-3333-4333-a333-333333333333";
  const todayIST = getTodayIST();

  // ==========================================================================
  // 1. Input Validation Schemas
  // ==========================================================================
  describe("Attendance Action Input Schemas", () => {
    it("accepts valid staff check-in payload with proper UUIDs", () => {
      const res = staffCheckInSchema.safeParse({ gymId, branchId, memberId });
      expect(res.success).toBe(true);
    });

    it("rejects non-UUID parameters in staff check-in", () => {
      const res = staffCheckInSchema.safeParse({
        gymId: "invalid-id",
        branchId,
        memberId,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain("Invalid gym ID");
      }
    });

    it("accepts valid member self check-in with optional memberId", () => {
      const resWithoutMember = memberSelfCheckInSchema.safeParse({ gymId });
      expect(resWithoutMember.success).toBe(true);

      const resWithMember = memberSelfCheckInSchema.safeParse({ gymId, memberId });
      expect(resWithMember.success).toBe(true);
    });

    it("rejects invalid memberId UUID in member self check-in if provided", () => {
      const res = memberSelfCheckInSchema.safeParse({ gymId, memberId: "not-a-uuid" });
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Active Contract Gating Rules
  // ==========================================================================
  describe("Active Contract Gating (isMembershipValidForAttendance)", () => {
    it("allows attendance check-in when contract is active and future end_date", () => {
      const futureDate = "2099-12-31";
      const membership = {
        status: "active",
        end_date: futureDate,
      };

      const result = isMembershipValidForAttendance(membership, todayIST);
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it("allows attendance check-in on the exact day of expiry (end_date === todayIST)", () => {
      const membership = {
        status: "active",
        end_date: todayIST,
      };

      const result = isMembershipValidForAttendance(membership, todayIST);
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it("blocks attendance check-in when contract expired yesterday (end_date < todayIST)", () => {
      const yesterday = "2020-01-01";
      const membership = {
        status: "active",
        end_date: yesterday,
      };

      const result = isMembershipValidForAttendance(membership, todayIST);
      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.reason).toContain("expired");
    });

    it("blocks attendance check-in when contract status is not 'active' (e.g. paused/cancelled/completed)", () => {
      const futureDate = "2099-12-31";
      const statuses = ["paused", "cancelled", "completed", "expired", "pending"];

      for (const st of statuses) {
        const membership = {
          status: st,
          end_date: futureDate,
        };
        const result = isMembershipValidForAttendance(membership, todayIST);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(`Membership status is ${st}`);
      }
    });

    it("blocks attendance check-in when no membership record exists (null or undefined)", () => {
      const resultNull = isMembershipValidForAttendance(null, todayIST);
      expect(resultNull.isValid).toBe(false);
      expect(resultNull.isExpired).toBe(true);
      expect(resultNull.reason).toContain("No active membership");

      const resultUndef = isMembershipValidForAttendance(undefined, todayIST);
      expect(resultUndef.isValid).toBe(false);
      expect(resultUndef.isExpired).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Daily Idempotency & Unique Constraint (Postgres 23505) Resolution
  // ==========================================================================
  describe("Daily Check-in Idempotency & Conflict Handling", () => {
    it("simulates pre-check preventing duplicate insert on same day", () => {
      const existingRecord = {
        id: "att-101",
        member_id: memberId,
        check_in_date: todayIST,
        check_in_time: "2026-11-01T08:30:00+05:30",
      };

      // Model logic executed before insert in attendance actions
      function evaluateCheckInPreCondition(
        existing: typeof existingRecord | null,
        targetMemberId: string,
        targetDate: string
      ) {
        if (existing && existing.member_id === targetMemberId && existing.check_in_date === targetDate) {
          return {
            success: false,
            error: "Member has already checked in today",
            alreadyCheckedIn: true,
            checkInTime: existing.check_in_time,
          };
        }
        return { success: true };
      }

      const res = evaluateCheckInPreCondition(existingRecord, memberId, todayIST);
      expect(res.success).toBe(false);
      expect(res.alreadyCheckedIn).toBe(true);
      expect(res.checkInTime).toBe("2026-11-01T08:30:00+05:30");
    });

    it("simulates graceful resolution of Postgres 23505 unique constraint violation", () => {
      const postgresError = {
        code: "23505",
        message: 'duplicate key value violates unique constraint "attendance_member_id_check_in_date_key"',
      };

      const existingRecord = {
        id: "att-102",
        check_in_time: "2026-11-01T09:15:00+05:30",
      };

      function handleInsertError(err: { code?: string; message?: string }, existing: typeof existingRecord | null) {
        if (
          err.code === "23505" ||
          err.message?.toLowerCase().includes("duplicate") ||
          err.message?.toLowerCase().includes("unique")
        ) {
          return {
            success: true,
            alreadyCheckedIn: true,
            checkInId: existing?.id,
            checkInTime: existing?.check_in_time,
            message: "Member is already checked in for today",
          };
        }
        return { success: false, error: err.message };
      }

      const outcome = handleInsertError(postgresError, existingRecord);
      expect(outcome.success).toBe(true);
      expect(outcome.alreadyCheckedIn).toBe(true);
      expect(outcome.checkInId).toBe("att-102");
      expect(outcome.checkInTime).toBe("2026-11-01T09:15:00+05:30");
    });
  });

  // ==========================================================================
  // 4. Member Portal Self-Check-in User Identity Invariant
  // ==========================================================================
  describe("Member Portal Self-Check-in Anti-Tampering", () => {
    const authUserId = "usr-auth-777";
    const authorizedMember = {
      id: "mem-authorized-888",
      user_id: authUserId,
      gym_id: gymId,
      status: "active",
    };

    function resolveSelfCheckInMember(
      authenticatedUser: { id: string } | null,
      workspaceGymId: string,
      providedMemberId?: string
    ) {
      if (!authenticatedUser) {
        return { success: false, error: "Authentication required to check in" };
      }

      // Check user binding to gym
      if (authorizedMember.user_id !== authenticatedUser.id || authorizedMember.gym_id !== workspaceGymId) {
        return { success: false, error: "Active member record not found or unauthorized" };
      }

      // If user supplied a different memberId, block tampering
      if (providedMemberId && providedMemberId !== authorizedMember.id) {
        return { success: false, error: "Unauthorized check-in attempt for another member" };
      }

      return { success: true, memberId: authorizedMember.id };
    }

    it("permits self-check-in when user ID matches the member profile for that gym", () => {
      const res = resolveSelfCheckInMember({ id: authUserId }, gymId);
      expect(res.success).toBe(true);
      expect(res.memberId).toBe(authorizedMember.id);
    });

    it("blocks self-check-in when user is unauthenticated", () => {
      const res = resolveSelfCheckInMember(null, gymId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Authentication required to check in");
    });

    it("blocks self-check-in if caller attempts to impersonate another member ID", () => {
      const res = resolveSelfCheckInMember({ id: authUserId }, gymId, "mem-victim-999");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized check-in attempt for another member");
    });

    it("blocks self-check-in if authenticated user does not belong to the requested gym", () => {
      const res = resolveSelfCheckInMember({ id: authUserId }, "diff-gym-0000-0000-000000000000");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Active member record not found or unauthorized");
    });
  });
});
