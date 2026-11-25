import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { LifecycleStageBanner } from "@/components/dashboard/lifecycle-stage-banner";
import {
  DashboardViewClient,
  type AttendanceTrendPoint,
  type MembershipBreakdownSegment,
  type NeedsAttentionSummary,
  type RecentActivityItem,
} from "@/components/dashboard/dashboard-view-client";
import { getISTDateString, getTodayIST, resolveGymLifecycleStage } from "@/lib/utils";

interface PageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

function addDaysIST(baseDateStr: string, days: number): string {
  const d = new Date(baseDateStr + "T00:00:00+05:30");
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function calculateDeltaPct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

interface RawMembershipItem {
  id: string;
  member_id: string;
  end_date: string;
  status: string;
  membership_plans: {
    name: string;
    price: number;
    duration_days?: number;
  } | null;
  members: {
    id: string;
    full_name: string;
    phone: string;
    branch_id: string;
    branches?: { name: string } | null;
  } | null;
}

type PlanBucketKey = "monthly" | "quarterly" | "yearly" | "trial" | "other" | "no_plan";

function classifyPlanBucket(planName: string, price: number, durationDays: number): PlanBucketKey {
  const lower = planName.toLowerCase();
  if (price === 0 || lower.includes("trial") || durationDays <= 20) {
    return "trial";
  }
  if (durationDays >= 21 && durationDays <= 45) {
    return "monthly";
  }
  if (durationDays >= 46 && durationDays <= 120) {
    return "quarterly";
  }
  if (durationDays >= 300) {
    return "yearly";
  }
  return "other";
}

export default async function DashboardPage({ params, searchParams }: PageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { branchId?: string }),
    cookies(),
    params.then(({ gymId: id }) => getAuthorizedActionContext({ gymId: id })),
  ]);

  const cookieBranch = cookieStore.get(`gymapra_branch_${gymId}`)?.value;
  const requestedBranchId =
    resolvedSearchParams.branchId !== undefined
      ? resolvedSearchParams.branchId
      : cookieBranch;

  const supabase = await createClient();

  const branchContext = resolveBranchContext({
    role: authContext.role,
    authorizedBranchIds: authContext.branchIds,
    requestedBranchId,
  });

  const selectedBranchId = branchContext.selectedBranchId;
  const gymBranchIds = branchContext.effectiveBranchIds;
  const isValidBranchFilter = !!selectedBranchId;

  const now = new Date();
  const generatedAtIso = now.toISOString();
  const todayStr = getTodayIST();
  const sixtyDaysAgoStr = addDaysIST(todayStr, -60);
  const fifteenDaysAgoStr = addDaysIST(todayStr, -15);
  const yesterdayStr = addDaysIST(todayStr, -1);

  const [currYear, currMonth] = todayStr.split("-").map(Number);
  const currentMonthPrefix = `${currYear}-${String(currMonth).padStart(2, "0")}`;
  const currentMonthStartStr = `${currentMonthPrefix}-01`;
  const prevMonthDate = new Date(Date.UTC(currYear, currMonth - 2, 1));
  const prevMonthPrefix = prevMonthDate.toISOString().slice(0, 7);

  const formattedDateIST = new Date(todayStr + "T12:00:00+05:30").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const istHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10
  );
  const greeting =
    istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";

  // Queries scoped by gym and active branch selection
  let allMembersQuery = supabase
    .from("members")
    .select("id, full_name, branch_id, status, created_at, memberships(id)")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    allMembersQuery = allMembersQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    allMembersQuery = allMembersQuery.in("branch_id", gymBranchIds);
  }

  let plansQuery = supabase
    .from("membership_plans")
    .select("id, name, price, duration_days, branch_id, created_at, branches!inner(gym_id)")
    .eq("branches.gym_id", gymId)
    .eq("is_active", true);
  if (isValidBranchFilter) {
    plansQuery = plansQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    plansQuery = plansQuery.in("branch_id", gymBranchIds);
  }

  let attendanceCountQuery = supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("check_in_date", todayStr);
  if (isValidBranchFilter) {
    attendanceCountQuery = attendanceCountQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    attendanceCountQuery = attendanceCountQuery.in("branch_id", gymBranchIds);
  }

  let attendance60DaysQuery = supabase
    .from("attendance")
    .select("id, member_id, check_in_date")
    .gte("check_in_date", sixtyDaysAgoStr);
  if (isValidBranchFilter) {
    attendance60DaysQuery = attendance60DaysQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    attendance60DaysQuery = attendance60DaysQuery.in("branch_id", gymBranchIds);
  }

  let paymentsQuery = supabase
    .from("payments")
    .select("id, membership_id, amount, payment_method, payment_status, payment_date, created_at")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    paymentsQuery = paymentsQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    paymentsQuery = paymentsQuery.in("branch_id", gymBranchIds);
  }

  let membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, member_id, end_date, status, membership_plans(name, price, duration_days), members(id, full_name, phone, branch_id, branches(name))"
    )
    .eq("gym_id", gymId)
    .eq("status", "active");
  if (isValidBranchFilter) {
    membershipsQuery = membershipsQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    membershipsQuery = membershipsQuery.in("branch_id", gymBranchIds);
  }

  let recentAttendanceQuery = supabase
    .from("attendance")
    .select(
      "id, check_in_time, check_in_method, member_id, members(id, full_name, branch_id, branches(name))"
    )
    .order("check_in_time", { ascending: false })
    .limit(5);
  if (isValidBranchFilter) {
    recentAttendanceQuery = recentAttendanceQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    recentAttendanceQuery = recentAttendanceQuery.in("branch_id", gymBranchIds);
  }

  let recentPaymentsQuery = supabase
    .from("payments")
    .select("id, amount, payment_status, created_at, members(id, full_name), branches(name)")
    .eq("gym_id", gymId)
    .in("payment_status", ["paid", "partial"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (isValidBranchFilter) {
    recentPaymentsQuery = recentPaymentsQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    recentPaymentsQuery = recentPaymentsQuery.in("branch_id", gymBranchIds);
  }

  let recentMembershipsQuery = supabase
    .from("memberships")
    .select("id, created_at, status, members(id, full_name), membership_plans(name)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (isValidBranchFilter) {
    recentMembershipsQuery = recentMembershipsQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    recentMembershipsQuery = recentMembershipsQuery.in("branch_id", gymBranchIds);
  }

  const [
    allMembersRes,
    attendanceCountRes,
    attendance60DaysRes,
    paymentsRes,
    membershipsRes,
    recentAttendanceRes,
    plansRes,
    recentPaymentsRes,
    recentMembershipsRes,
  ] = await Promise.all([
    allMembersQuery,
    attendanceCountQuery,
    attendance60DaysQuery,
    paymentsQuery,
    membershipsQuery,
    recentAttendanceQuery,
    plansQuery,
    recentPaymentsQuery,
    recentMembershipsQuery,
  ]);

  const queryErrors = [
    allMembersRes.error,
    attendanceCountRes.error,
    attendance60DaysRes.error,
    paymentsRes.error,
    membershipsRes.error,
    plansRes.error,
  ].filter(Boolean);

  const loadError =
    queryErrors.length > 0
      ? "Some dashboard metrics could not be loaded. Try refreshing."
      : null;

  const gym = authContext.gym;
  const pilotStatus = authContext.trialStatus;
  const branchList = authContext.branches;

  const capabilities = {
    canManageMembers: hasCapability(authContext.role, "members:manage"),
    canRecordPayments: hasCapability(authContext.role, "payments:record"),
    canRecordAttendance: hasCapability(authContext.role, "attendance:record"),
    canManagePlans: hasCapability(authContext.role, "plans:manage"),
    canViewMembers: hasCapability(authContext.role, "members:view"),
    canViewReports: hasCapability(authContext.role, "reports:view"),
    canViewFinancials: hasCapability(authContext.role, "financial:view"),
  };

  const metadataName =
    typeof authContext.user.user_metadata?.full_name === "string"
      ? authContext.user.user_metadata.full_name
      : "";
  const fullName =
    authContext.profile?.full_name ||
    metadataName ||
    authContext.user.email?.split("@")[0] ||
    "Owner";
  const userFirstName = fullName.trim().split(/\s+/)[0] || "Owner";

  const allMembers = allMembersRes.data || [];
  const activeMembers = allMembers.filter((m) => m.status === "active");
  const activeMembersCount = activeMembers.length;
  const totalMembersCount = allMembers.length;
  const unassignedCount = allMembers.filter(
    (m) => !m.memberships || m.memberships.length === 0
  ).length;

  const prevMonthActiveCount = activeMembers.filter((m) => {
    if (!m.created_at) return false;
    return getISTDateString(m.created_at) < currentMonthStartStr;
  }).length;
  const activeMembersDeltaPct = calculateDeltaPct(activeMembersCount, prevMonthActiveCount);

  const plansList = plansRes.data || [];
  const plansCount = plansList.length;
  const modalPlans = plansList.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price || 0),
    durationDays: Number(p.duration_days || 30),
  }));

  const todayCheckIns = attendanceCountRes.count ?? 0;
  const allPayments = paymentsRes.data || [];
  const rawMemberships = (membershipsRes.data || []) as unknown as RawMembershipItem[];

  const lifecycleStage = resolveGymLifecycleStage({
    membersCount: totalMembersCount,
    plansCount,
    membershipsCount: rawMemberships.length,
    unassignedCount,
    todayCheckinsCount: todayCheckIns,
  });

  // Revenue calculations (only paid / partial payments count as collected)
  const validPayments = allPayments.filter(
    (p) => p.payment_status === "paid" || p.payment_status === "partial"
  );
  const pendingPaymentApprovalsCount = allPayments.filter(
    (p) => p.payment_status === "pending"
  ).length;

  const todayCollection =
    Math.round(
      validPayments
        .filter((p) => p.payment_date === todayStr)
        .reduce((sum, p) => sum + Number(p.amount), 0) * 100
    ) / 100;

  const moneyCollectedThisMonth =
    Math.round(
      validPayments
        .filter((p) => p.payment_date?.startsWith(currentMonthPrefix))
        .reduce((sum, p) => sum + Number(p.amount), 0) * 100
    ) / 100;

  const moneyCollectedPrevMonth =
    Math.round(
      validPayments
        .filter((p) => p.payment_date?.startsWith(prevMonthPrefix))
        .reduce((sum, p) => sum + Number(p.amount), 0) * 100
    ) / 100;

  const moneyCollectedDeltaPct = calculateDeltaPct(
    moneyCollectedThisMonth,
    moneyCollectedPrevMonth
  );

  // Payment totals mapped by membership ID
  const paymentSumByMembership = new Map<string, number>();
  validPayments.forEach((p) => {
    if (p.membership_id) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + Number(p.amount)
      );
    }
  });

  // Active memberships, Pending Dues, Expiring Soon (7d), and Member -> Active Plan map
  let totalOutstandingDues = 0;
  let unpaidBalancesCount = 0;
  let expiringCount = 0;
  let expiringRenewalValue = 0;

  const activeMembershipByMember = new Map<string, RawMembershipItem>();
  const todayDateObj = new Date(todayStr + "T00:00:00+05:30");

  rawMemberships.forEach((m) => {
    const member = m.members;
    if (!member) return;
    if (!gymBranchIds.includes(member.branch_id)) return;
    if (isValidBranchFilter && member.branch_id !== selectedBranchId) return;

    const existing = activeMembershipByMember.get(m.member_id);
    if (!existing || m.end_date > existing.end_date) {
      activeMembershipByMember.set(m.member_id, m);
    }

    const planPrice = Number(m.membership_plans?.price || 0);
    const paid = paymentSumByMembership.get(m.id) || 0;
    const dues = Math.max(0, planPrice - paid);
    if (dues > 0) {
      totalOutstandingDues += dues;
      unpaidBalancesCount += 1;
    }

    const expDateObj = new Date(m.end_date + "T00:00:00+05:30");
    const daysLeft = Math.round(
      (expDateObj.getTime() - todayDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft >= 0 && daysLeft <= 7) {
      expiringCount += 1;
      expiringRenewalValue += planPrice;
    }
  });

  totalOutstandingDues = Math.round(totalOutstandingDues * 100) / 100;
  expiringRenewalValue = Math.round(expiringRenewalValue * 100) / 100;

  // Attendance series (30D + 7D slice) & Inactive 15+ days calculation
  const attendanceByDate = new Map<string, number>();
  const latestCheckInByMember = new Map<string, string>();

  (attendance60DaysRes.data || []).forEach((a) => {
    if (a.check_in_date) {
      attendanceByDate.set(a.check_in_date, (attendanceByDate.get(a.check_in_date) || 0) + 1);
      if (a.member_id) {
        const prevLatest = latestCheckInByMember.get(a.member_id);
        if (!prevLatest || a.check_in_date > prevLatest) {
          latestCheckInByMember.set(a.member_id, a.check_in_date);
        }
      }
    }
  });

  const yesterdayCheckIns = attendanceByDate.get(yesterdayStr) || 0;
  const presentDeltaPct = calculateDeltaPct(todayCheckIns, yesterdayCheckIns);

  const points30D: AttendanceTrendPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const dStr = addDaysIST(todayStr, -i);
    const count = attendanceByDate.get(dStr) || 0;
    const dObj = new Date(dStr + "T12:00:00+05:30");
    const dayLabel = dObj.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
    points30D.push({ date: dStr, dayLabel, count });
  }
  const points7D = points30D.slice(-7);

  // Inactive members (15+ days): active members enrolled > 15 days ago with no check-in in last 15 days
  const inactive15PlusCount = activeMembers.filter((m) => {
    const createdIST = m.created_at ? getISTDateString(m.created_at) : todayStr;
    if (createdIST > fifteenDaysAgoStr) return false;
    const lastCheckIn = latestCheckInByMember.get(m.id);
    return !lastCheckIn || lastCheckIn < fifteenDaysAgoStr;
  }).length;

  // Membership Breakdown by plan bucket across active members
  const bucketMeta: Array<{ key: PlanBucketKey; label: string; color: string }> = [
    { key: "monthly", label: "Monthly", color: "var(--primary)" },
    { key: "quarterly", label: "Quarterly", color: "#0EA5E9" },
    { key: "yearly", label: "Yearly", color: "#8B5CF6" },
    { key: "trial", label: "Trial", color: "#10B981" },
    { key: "other", label: "Other", color: "#F59E0B" },
    { key: "no_plan", label: "No Plan", color: "#94A3B8" },
  ];

  const bucketCounts: Record<PlanBucketKey, number> = {
    monthly: 0,
    quarterly: 0,
    yearly: 0,
    trial: 0,
    other: 0,
    no_plan: 0,
  };

  activeMembers.forEach((m) => {
    const activeMembership = activeMembershipByMember.get(m.id);
    if (!activeMembership || !activeMembership.membership_plans) {
      bucketCounts.no_plan += 1;
      return;
    }
    const bucket = classifyPlanBucket(
      activeMembership.membership_plans.name || "",
      Number(activeMembership.membership_plans.price || 0),
      Number(activeMembership.membership_plans.duration_days || 30)
    );
    bucketCounts[bucket] += 1;
  });

  const membershipBreakdownSegments: MembershipBreakdownSegment[] = bucketMeta
    .filter((b) => bucketCounts[b.key] > 0)
    .map((b) => ({
      key: b.key,
      label: b.label,
      count: bucketCounts[b.key],
      pct: activeMembersCount > 0 ? Math.round((bucketCounts[b.key] / activeMembersCount) * 100) : 0,
      color: b.color,
    }));

  // Normalize rounding drift so percentages sum cleanly to 100 when members exist
  if (membershipBreakdownSegments.length > 0 && activeMembersCount > 0) {
    const pctSum = membershipBreakdownSegments.reduce((s, seg) => s + seg.pct, 0);
    if (pctSum !== 100) {
      membershipBreakdownSegments[0].pct = Math.max(
        0,
        membershipBreakdownSegments[0].pct + (100 - pctSum)
      );
    }
  }

  const needsAttention: NeedsAttentionSummary = {
    expiringCount,
    expiringRenewalValue,
    unpaidBalancesCount,
    pendingDuesTotal: totalOutstandingDues,
    inactive15PlusCount,
    pendingPaymentApprovalsCount,
    unassignedCount,
  };

  // Recent Activity Feed (Check-ins, Payments, Memberships, New Members, New Plans)
  const rawActivityItems: RecentActivityItem[] = [];

  (recentAttendanceRes.data || []).forEach((ci) => {
    const member = ci.members as unknown as {
      id?: string;
      full_name?: string;
      branches?: { name: string } | null;
    } | null;
    if (!ci.check_in_time) return;
    const branchLabel = member?.branches?.name ? ` (${member.branches.name})` : "";
    rawActivityItems.push({
      id: `att-${ci.id}`,
      type: "check_in",
      title: `${member?.full_name || "Member"} checked in${branchLabel}`,
      timestamp: ci.check_in_time,
      href: `/app/${gymId}/attendance`,
    });
  });

  if (capabilities.canRecordPayments || capabilities.canViewFinancials) {
    (recentPaymentsRes.data || []).forEach((p) => {
      const member = p.members as unknown as { id?: string; full_name?: string } | null;
      if (!p.created_at) return;
      const amt = Number(p.amount || 0).toLocaleString("en-IN");
      const memberSuffix = member?.full_name ? ` (${member.full_name})` : "";
      rawActivityItems.push({
        id: `pay-${p.id}`,
        type: "payment",
        title: `Payment of ₹${amt} received${memberSuffix}`,
        timestamp: p.created_at,
        href: `/app/${gymId}/payments`,
      });
    });
  }

  (recentMembershipsRes.data || []).forEach((ms) => {
    const member = ms.members as unknown as { id?: string; full_name?: string } | null;
    const plan = ms.membership_plans as unknown as { name?: string } | null;
    if (!ms.created_at) return;
    const verb = ms.status === "renewed" ? "membership renewed" : "membership assigned";
    const planLabel = plan?.name ? ` (${plan.name})` : "";
    rawActivityItems.push({
      id: `ms-${ms.id}`,
      type: "membership",
      title: `${member?.full_name || "Member"} ${verb}${planLabel}`,
      timestamp: ms.created_at,
      href: `/app/${gymId}/memberships`,
    });
  });

  [...allMembers]
    .filter((m) => !!m.created_at)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5)
    .forEach((m) => {
      rawActivityItems.push({
        id: `mem-${m.id}`,
        type: "member",
        title: `New member added – ${m.full_name || "Member"}`,
        timestamp: m.created_at,
        href: `/app/${gymId}/members/${m.id}`,
      });
    });

  [...plansList]
    .filter((p) => !!p.created_at)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 3)
    .forEach((p) => {
      rawActivityItems.push({
        id: `plan-${p.id}`,
        type: "plan",
        title: `Membership plan created – ${p.name}`,
        timestamp: p.created_at,
        href: `/app/${gymId}/memberships?tab=plans`,
      });
    });

  const recentActivities = rawActivityItems
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const currentBranchName =
    branchList.find((b) => b.id === selectedBranchId)?.name ||
    (branchList.length === 1 ? branchList[0]?.name : "All Branches");

  const showLifecycleBanner =
    lifecycleStage !== "STAGE_4_ESTABLISHED" ||
    authContext.role === "trainer";

  return (
    <div className="space-y-4 max-w-7xl mx-auto text-foreground">
      <DashboardViewClient
        gymId={gymId}
        gymName={gym?.name || "GymApra"}
        branchName={currentBranchName}
        selectedBranchId={selectedBranchId || gymBranchIds[0] || ""}
        branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
        userFirstName={userFirstName}
        greeting={greeting}
        formattedDateIST={formattedDateIST}
        generatedAtIso={generatedAtIso}
        capabilities={capabilities}
        kpis={{
          activeMembersCount,
          activeMembersDeltaPct,
          presentTodayCount: todayCheckIns,
          presentDeltaPct,
          moneyCollectedThisMonth,
          moneyCollectedDeltaPct,
          todayCollection,
          pendingDuesTotal: totalOutstandingDues,
          unpaidBalancesCount,
        }}
        attendanceTrend={{
          points7D,
          points30D,
        }}
        membershipBreakdown={{
          totalMembers: activeMembersCount,
          segments: membershipBreakdownSegments,
        }}
        needsAttention={needsAttention}
        recentActivities={recentActivities}
        modalPlans={modalPlans}
        pilotStatus={pilotStatus}
        loadError={loadError}
        setupBanner={
          showLifecycleBanner ? (
            <LifecycleStageBanner
              gymId={gymId}
              stage={lifecycleStage}
              plansCount={plansCount}
              membersCount={totalMembersCount}
              unassignedCount={unassignedCount}
              userRole={authContext.role}
              showEstablishedQuickBar={false}
            />
          ) : null
        }
      />
    </div>
  );
}
