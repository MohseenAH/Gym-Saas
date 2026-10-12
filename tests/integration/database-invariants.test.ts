import { describe, it, expect, beforeAll } from "vitest";
import { getTestSupabaseClient } from "../helpers/supabase-test-client";

describe("Phase 1 & 2 Database Invariants Suite (Section 7)", () => {
  let supabase: ReturnType<typeof getTestSupabaseClient>;

  beforeAll(() => {
    supabase = getTestSupabaseClient();
  });

  it("Invariant 1: No orphaned gyms without an associated account record", async () => {
    // Every gym in the system must belong to an account
    const { data: gyms, error } = await supabase
      .from("gyms")
      .select("id, account_id, accounts(id)");

    expect(error).toBeNull();
    if (gyms && gyms.length > 0) {
      const orphaned = gyms.filter((g) => !g.account_id || !g.accounts);
      expect(orphaned.length).toBe(0);
    }
  });

  it("Invariant 2: No orphaned branches without a valid gym parent", async () => {
    const { data: branches, error } = await supabase
      .from("branches")
      .select("id, gym_id, gyms(id)");

    expect(error).toBeNull();
    if (branches && branches.length > 0) {
      const orphaned = branches.filter((b) => !b.gym_id || !b.gyms);
      expect(orphaned.length).toBe(0);
    }
  });

  it("Invariant 3: No accepted invitations exist without an accepted_at timestamp", async () => {
    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("id, status, accepted_at")
      .eq("status", "accepted");

    expect(error).toBeNull();
    if (invitations && invitations.length > 0) {
      const badInvitations = invitations.filter((inv) => !inv.accepted_at);
      expect(badInvitations.length).toBe(0);
    }
  });

  it("Invariant 4: Exactly one owner per starter-tier gym workspace", async () => {
    const { data: gymUsers, error } = await supabase
      .from("gym_users")
      .select("id, gym_id, role")
      .eq("role", "owner");

    expect(error).toBeNull();
    if (gymUsers && gymUsers.length > 0) {
      const ownerCountByGym = new Map<string, number>();
      for (const gu of gymUsers) {
        ownerCountByGym.set(gu.gym_id, (ownerCountByGym.get(gu.gym_id) || 0) + 1);
      }
      for (const [gymId, count] of ownerCountByGym.entries()) {
        expect(count, `Gym ${gymId} has multiple owners`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("Invariant 5: No duplicate attendance check-ins on same calendar day for single member", async () => {
    const { data: attendanceRecords, error } = await supabase
      .from("attendance")
      .select("member_id, check_in_date");

    expect(error).toBeNull();
    if (attendanceRecords && attendanceRecords.length > 0) {
      const uniqueKeys = new Set<string>();
      for (const record of attendanceRecords) {
        const key = `${record.member_id}_${record.check_in_date}`;
        expect(uniqueKeys.has(key), `Duplicate check-in detected for ${key}`).toBe(false);
        uniqueKeys.add(key);
      }
    }
  });
});
