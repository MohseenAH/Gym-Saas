import { describe, it, expect } from "vitest";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";

export interface AccountState {
  status: SubscriptionStatus;
  trialEndsAt: Date;
  gracePeriodEndsAt?: Date;
}

export function evaluateAccountAccess(
  account: AccountState,
  now: Date = new Date()
): { allowed: boolean; isExpired: boolean; daysRemaining: number } {
  if (account.status === "active") {
    return { allowed: true, isExpired: false, daysRemaining: Infinity };
  }

  if (account.status === "trial") {
    const diffMs = account.trialEndsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    if (diffMs > 0) {
      return { allowed: true, isExpired: false, daysRemaining };
    }
    return { allowed: false, isExpired: true, daysRemaining: 0 };
  }

  if (account.status === "past_due" && account.gracePeriodEndsAt) {
    const inGrace = account.gracePeriodEndsAt.getTime() > now.getTime();
    return { allowed: inGrace, isExpired: !inGrace, daysRemaining: 0 };
  }

  return { allowed: false, isExpired: true, daysRemaining: 0 };
}

describe("Phase 1 Trial State Machine & Time-Boundary Tests", () => {
  const baseTime = new Date("2026-09-01T00:00:00.000Z");
  const fourteenDaysLater = new Date("2026-09-15T00:00:00.000Z");

  it("TEST-P1-030: Day 0 - Newly signed-up account has 14 full days remaining", () => {
    const account: AccountState = {
      status: "trial",
      trialEndsAt: fourteenDaysLater,
    };
    const access = evaluateAccountAccess(account, baseTime);
    expect(access.allowed).toBe(true);
    expect(access.isExpired).toBe(false);
    expect(access.daysRemaining).toBe(14);
  });

  it("TEST-P1-031: Day 13 (23h 59m remaining) - Access is fully allowed with 1 day remaining", () => {
    const day13 = new Date("2026-09-14T00:00:01.000Z");
    const account: AccountState = {
      status: "trial",
      trialEndsAt: fourteenDaysLater,
    };
    const access = evaluateAccountAccess(account, day13);
    expect(access.allowed).toBe(true);
    expect(access.isExpired).toBe(false);
    expect(access.daysRemaining).toBe(1);
  });

  it("TEST-P1-032: 1 second before expiration - Access is still strictly valid", () => {
    const oneSecondBefore = new Date("2026-09-14T23:59:59.000Z");
    const account: AccountState = {
      status: "trial",
      trialEndsAt: fourteenDaysLater,
    };
    const access = evaluateAccountAccess(account, oneSecondBefore);
    expect(access.allowed).toBe(true);
    expect(access.isExpired).toBe(false);
  });

  it("TEST-P1-033: Exact expiration timestamp - Trial status switches to expired", () => {
    const exactExpiry = new Date("2026-09-15T00:00:00.000Z");
    const account: AccountState = {
      status: "trial",
      trialEndsAt: fourteenDaysLater,
    };
    const access = evaluateAccountAccess(account, exactExpiry);
    expect(access.allowed).toBe(false);
    expect(access.isExpired).toBe(true);
  });

  it("TEST-P1-034: 1 second after expiration - Access is strictly blocked", () => {
    const oneSecondAfter = new Date("2026-09-15T00:00:01.000Z");
    const account: AccountState = {
      status: "trial",
      trialEndsAt: fourteenDaysLater,
    };
    const access = evaluateAccountAccess(account, oneSecondAfter);
    expect(access.allowed).toBe(false);
    expect(access.isExpired).toBe(true);
    expect(access.daysRemaining).toBe(0);
  });

  it("Grace Period: Past Due status allows access within grace window, blocks after", () => {
    const graceEnd = new Date("2026-09-18T00:00:00.000Z");
    const account: AccountState = {
      status: "past_due",
      trialEndsAt: fourteenDaysLater,
      gracePeriodEndsAt: graceEnd,
    };

    // Within grace
    const withinGrace = evaluateAccountAccess(account, new Date("2026-09-16T00:00:00.000Z"));
    expect(withinGrace.allowed).toBe(true);

    // After grace
    const afterGrace = evaluateAccountAccess(account, new Date("2026-09-19T00:00:00.000Z"));
    expect(afterGrace.allowed).toBe(false);
  });
});
