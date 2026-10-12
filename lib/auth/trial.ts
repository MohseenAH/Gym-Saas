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

export function evaluatePilotStatus(
  trialEndsAtStr?: string | null,
  tier: string = "starter",
  now: Date = new Date()
): {
  isPilot: boolean;
  isActive: boolean;
  daysRemaining: number;
  badgeText: string;
} {
  if (!trialEndsAtStr) {
    return {
      isPilot: false,
      isActive: true,
      daysRemaining: 0,
      badgeText: tier.toUpperCase(),
    };
  }

  const trialEnd = new Date(trialEndsAtStr);
  const diffMs = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isActive = diffMs > 0;

  return {
    isPilot: true,
    isActive,
    daysRemaining,
    badgeText: isActive ? `Pilot Access (${daysRemaining}d left)` : "Pilot Expired",
  };
}
