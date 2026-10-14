export const DEFAULT_TRIAL_DAYS = 60;

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "expired";

export interface AccountState {
  status: SubscriptionStatus;
  trialEndsAt: Date;
  gracePeriodEndsAt?: Date;
}

/**
 * Evaluates account access during the 60-day free pilot.
 * Hard lockouts are disabled: users are never blocked or redirected out
 * of their workspace during the production pilot phase.
 */
export function evaluateAccountAccess(
  account: AccountState,
  now: Date = new Date()
): { allowed: boolean; isExpired: boolean; daysRemaining: number } {
  const diffMs = account.trialEndsAt ? account.trialEndsAt.getTime() - now.getTime() : 0;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isPast = diffMs <= 0;

  // During 60-day free pilot: NEVER hard lockout the gym workspace
  return {
    allowed: true, // Hard lockout disabled
    isExpired: isPast && account.status !== "active",
    daysRemaining: account.status === "active" ? Infinity : daysRemaining,
  };
}

export function evaluatePilotStatus(
  trialEndsAtStr?: string | null,
  tier: string = "pro",
  now: Date = new Date()
): {
  isPilot: boolean;
  isActive: boolean;
  daysRemaining: number;
  badgeText: string;
} {
  if (!trialEndsAtStr) {
    // Default to active 60-day pilot access if trial date missing
    return {
      isPilot: true,
      isActive: true,
      daysRemaining: DEFAULT_TRIAL_DAYS,
      badgeText: `60-Day Pilot Access (${DEFAULT_TRIAL_DAYS}d left)`,
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
    badgeText: isActive ? `60-Day Pilot (${daysRemaining}d left)` : "Pilot Grace Period",
  };
}
