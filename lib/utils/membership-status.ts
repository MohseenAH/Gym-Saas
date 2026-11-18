export interface MembershipLifecycleStatus {
  status: "active" | "expired" | "upcoming" | "frozen" | "cancelled";
  daysRemaining: number;
  isExpiringSoon: boolean;
  isUpcoming: boolean;
}

/**
 * Computes membership lifecycle status, days remaining, and expiry flags
 * relative to a given reference date (defaults to current system date).
 */
export async function computeMembershipStatus(
  startDateStr: string,
  endDateStr: string,
  rawStatus: "active" | "expired" | "frozen" | "cancelled",
  referenceDate: Date = new Date()
): Promise<MembershipLifecycleStatus> {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - ref.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isUpcoming = start.getTime() > ref.getTime();
  const isPast = end.getTime() < ref.getTime();

  if (rawStatus === "frozen" || rawStatus === "cancelled") {
    return {
      status: rawStatus,
      daysRemaining,
      isExpiringSoon: false,
      isUpcoming,
    };
  }

  if (isUpcoming) {
    return {
      status: "upcoming",
      daysRemaining,
      isExpiringSoon: false,
      isUpcoming: true,
    };
  }

  if (isPast || rawStatus === "expired") {
    return {
      status: "expired",
      daysRemaining,
      isExpiringSoon: false,
      isUpcoming: false,
    };
  }

  // Active status
  const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 7;
  return {
    status: "active",
    daysRemaining,
    isExpiringSoon,
    isUpcoming: false,
  };
}
