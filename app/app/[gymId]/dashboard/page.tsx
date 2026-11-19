import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { LifecycleStageBanner } from "@/components/dashboard/lifecycle-stage-banner";
import {
  DashboardViewClient,
  DashboardFinancialData,
  AttendanceSeriesData,
  MembershipHealthData,
  ExpiringMemberItem,
  LiveCheckInItem,
} from "@/components/dashboard/dashboard-view-client";
import { getTodayIST, resolveGymLifecycleStage } from "@/lib/utils";

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
  return Math.round(((curr - prev) / prev) * 100);
}

interface RawMembershipItem {
  id: string;
  start_date: string;
  end_date: string;
  members: {
    id: string;
    full_name: string;
    phone: string;
    branch_id: string;
    branches?: { name: string } | null;
  } | null;
  membership_plans: { name: string; price: number } | null;
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

  // Resolve branch context immediately using cached authContext
  const branchContext = resolveBranchContext({
    role: authContext.role,
    authorizedBranchIds: authContext.branchIds,
    requestedBranchId,
  });

  const selectedBranchId = branchContext.selectedBranchId;
  const gymBranchIds = branchContext.effectiveBranchIds;
  const isValidBranchFilter = !!selectedBranchId;

  const todayStr = getTodayIST();
  const sixtyDaysAgoStr = addDaysIST(todayStr, -60);

  // Prepare all independent queries simultaneously
  let allMembersQuery = supabase
    .from("members")
    .select("id, branch_id, status, created_at, memberships(id)")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    allMembersQuery = allMembersQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    allMembersQuery = allMembersQuery.in("branch_id", gymBranchIds);
  }

  let plansQuery = supabase
    .from("membership_plans")
    .select("id, name, price, duration_days, branch_id, branches!inner(gym_id)")
    .eq("branches.gym_id", gymId)
    .eq("is_active", true);
  if (isValidBranchFilter) {
    plansQuery = plansQuery.eq("branch_id", selectedBranchId);
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
    .select("id, check_in_date")
    .gte("check_in_date", sixtyDaysAgoStr);
  if (isValidBranchFilter) {
    attendance60DaysQuery = attendance60DaysQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    attendance60DaysQuery = attendance60DaysQuery.in("branch_id", gymBranchIds);
  }

  let paymentsQuery = supabase
    .from("payments")
    .select("id, membership_id, amount, payment_method, payment_status, payment_date")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    paymentsQuery = paymentsQuery.eq("branch_id", selectedBranchId);
  }

  let expensesQuery = supabase
    .from("expenses")
    .select("id, amount, expense_date, created_at")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    expensesQuery = expensesQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    expensesQuery = expensesQuery.in("branch_id", gymBranchIds);
  }

  let membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, member_id, end_date, status, membership_plans(name, price), members(id, full_name, phone, branch_id, branches(name))"
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
    .select("id, check_in_time, check_in_method, member_id, members(id, full_name, branch_id, branches(name))")
    .eq("check_in_date", todayStr)
    .order("check_in_time", { ascending: false })
    .limit(10);
  if (isValidBranchFilter) {
    recentAttendanceQuery = recentAttendanceQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    recentAttendanceQuery = recentAttendanceQuery.in("branch_id", gymBranchIds);
  }

  // Execute all dashboard queries concurrently in parallel
  const [
    allMembersRes,
    attendanceCountRes,
    attendance60DaysRes,
    paymentsRes,
    expensesRes,
    membershipsRes,
    recentAttendanceRes,
    plansRes,
  ] = await Promise.all([
    allMembersQuery,
    attendanceCountQuery,
    attendance60DaysQuery,
    paymentsQuery,
    expensesQuery,
    membershipsQuery,
    recentAttendanceQuery,
    plansQuery,
  ]);

  const gym = authContext.gym;
  const pilotStatus = authContext.trialStatus;
  const branchList = authContext.branches;

  const allMembers = allMembersRes.data || [];
  const membersCount = allMembers.filter((m) => m.status === "active").length;
  const totalMembersCount = allMembers.length;
  const unassignedCount = allMembers.filter((m) => !m.memberships || m.memberships.length === 0).length;

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
  const rawMemberships = membershipsRes.data || [];

  const lifecycleStage = resolveGymLifecycleStage({
    membersCount: totalMembersCount,
    plansCount,
    membershipsCount: rawMemberships.length,
    unassignedCount,
    todayCheckinsCount: todayCheckIns,
  });

  // Business Correctness: Only count completed/partial payments as collected revenue
  const validPayments = allPayments.filter(
    (p) => p.payment_status === "paid" || p.payment_status === "partial"
  );
  const todayPayments = validPayments.filter((p) => p.payment_date === todayStr);

  const todayCollection = Math.round(todayPayments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
  const todayCash = Math.round(todayPayments
    .filter((p) => p.payment_method === "cash")
    .reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
  const todayUpi = Math.round(todayPayments
    .filter((p) => p.payment_method === "upi")
    .reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

  // Active memberships & Outstanding Dues
  let totalOutstandingDues = 0;
  const expiringMembers: ExpiringMemberItem[] = [];

  const paymentSumByMembership = new Map<string, number>();
  validPayments.forEach((p) => {
    if (p.membership_id) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + Number(p.amount)
      );
    }
  });

  ((rawMemberships as unknown as RawMembershipItem[]) || []).forEach((m) => {
    const member = m.members;
    if (!member) return;

    if (!gymBranchIds.includes(member.branch_id)) return;
    if (isValidBranchFilter && member.branch_id !== selectedBranchId) return;

    const planPrice = Number(m.membership_plans?.price || 0);
    const paid = paymentSumByMembership.get(m.id) || 0;
    const dues = Math.max(0, planPrice - paid);
    if (dues > 0) {
      totalOutstandingDues += dues;
    }

    // Check if expiring in next 7 days using strict IST calendar window
    const todayDate = new Date(todayStr + "T00:00:00+05:30");
    const expDate = new Date(m.end_date + "T00:00:00+05:30");
    const diffTime = expDate.getTime() - todayDate.getTime();
    const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft >= 0 && daysLeft <= 7) {
      expiringMembers.push({
        memberId: member.id,
        fullName: member.full_name,
        phone: member.phone || "",
        planName: m.membership_plans?.name || "Active Plan",
        endDate: m.end_date,
        daysLeft,
        branchName: member.branches?.name || "Main Branch",
      });
    }
  });

  totalOutstandingDues = Math.round(totalOutstandingDues * 100) / 100;
  expiringMembers.sort((a, b) => a.daysLeft - b.daysLeft);

  // Membership Health: mutually exclusive segments summing to totalRoster
  const expiringCount = expiringMembers.length;
  const activeCount = Math.max(0, membersCount - expiringCount);
  const atRiskCount = Math.max(0, totalMembersCount - activeCount - expiringCount);

  const activePct = totalMembersCount > 0 ? Math.round((activeCount / totalMembersCount) * 100) : 0;
  const expiringPct = totalMembersCount > 0 ? Math.round((expiringCount / totalMembersCount) * 100) : 0;
  const atRiskPct = totalMembersCount > 0 ? Math.max(0, 100 - activePct - expiringPct) : 0;

  const membershipHealth: MembershipHealthData = {
    totalRoster: totalMembersCount,
    activeCount,
    activePct,
    expiringCount,
    expiringPct,
    atRiskCount,
    atRiskPct,
  };

  // Date lookup maps for financial metrics
  const collectionsByDate = new Map<string, number>();
  validPayments.forEach((p) => {
    if (p.payment_date) {
      collectionsByDate.set(
        p.payment_date,
        (collectionsByDate.get(p.payment_date) || 0) + Number(p.amount)
      );
    }
  });

  const expensesByDate = new Map<string, number>();
  (expensesRes.data || []).forEach((e: { amount: number | string; expense_date?: string; created_at?: string }) => {
    const d = e.expense_date || (e.created_at ? e.created_at.slice(0, 10) : "");
    if (d) {
      expensesByDate.set(
        d,
        (expensesByDate.get(d) || 0) + Number(e.amount)
      );
    }
  });

  // Financial Bars & Windows
  // 7D: 7 daily bars
  const bars7D: Array<{ label: string; collections: number; expenses: number }> = [];
  let col7DTotal = 0;
  let exp7DTotal = 0;
  for (let i = 6; i >= 0; i--) {
    const dStr = addDaysIST(todayStr, -i);
    const c = Math.round((collectionsByDate.get(dStr) || 0) * 100) / 100;
    const e = Math.round((expensesByDate.get(dStr) || 0) * 100) / 100;
    col7DTotal += c;
    exp7DTotal += e;

    const dObj = new Date(dStr + "T00:00:00+05:30");
    const label = i === 0 ? "Today" : dObj.toLocaleDateString("en-IN", { weekday: "short" });
    bars7D.push({ label, collections: c, expenses: e });
  }

  // 30D: 5 6-day intervals
  const bars30D: Array<{ label: string; collections: number; expenses: number }> = [];
  let col30DTotal = 0;
  let exp30DTotal = 0;
  for (let b = 4; b >= 0; b--) {
    let bucketCol = 0;
    let bucketExp = 0;
    const startDayOffset = b * 6 + 5;
    const endDayOffset = b * 6;
    for (let i = startDayOffset; i >= endDayOffset; i--) {
      const dStr = addDaysIST(todayStr, -i);
      bucketCol += collectionsByDate.get(dStr) || 0;
      bucketExp += expensesByDate.get(dStr) || 0;
    }
    bucketCol = Math.round(bucketCol * 100) / 100;
    bucketExp = Math.round(bucketExp * 100) / 100;
    col30DTotal += bucketCol;
    exp30DTotal += bucketExp;

    const endDStr = addDaysIST(todayStr, -endDayOffset);
    const dObj = new Date(endDStr + "T00:00:00+05:30");
    const label = b === 0 ? "Today" : dObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    bars30D.push({ label, collections: bucketCol, expenses: bucketExp });
  }

  // 90D: 3 30-day monthly intervals
  const bars90D: Array<{ label: string; collections: number; expenses: number }> = [];
  let col90DTotal = 0;
  let exp90DTotal = 0;
  for (let b = 2; b >= 0; b--) {
    let bucketCol = 0;
    let bucketExp = 0;
    const startDayOffset = b * 30 + 29;
    const endDayOffset = b * 30;
    for (let i = startDayOffset; i >= endDayOffset; i--) {
      const dStr = addDaysIST(todayStr, -i);
      bucketCol += collectionsByDate.get(dStr) || 0;
      bucketExp += expensesByDate.get(dStr) || 0;
    }
    bucketCol = Math.round(bucketCol * 100) / 100;
    bucketExp = Math.round(bucketExp * 100) / 100;
    col90DTotal += bucketCol;
    exp90DTotal += bucketExp;

    const midDStr = addDaysIST(todayStr, -endDayOffset - 15);
    const dObj = new Date(midDStr + "T00:00:00+05:30");
    const label = dObj.toLocaleDateString("en-IN", { month: "short" });
    bars90D.push({ label, collections: bucketCol, expenses: bucketExp });
  }

  const financialData: DashboardFinancialData = {
    "7D": {
      collections: Math.round(col7DTotal * 100) / 100,
      expenses: Math.round(exp7DTotal * 100) / 100,
      netCashFlow: Math.round((col7DTotal - exp7DTotal) * 100) / 100,
      pendingDues: totalOutstandingDues,
      chartBars: bars7D,
    },
    "30D": {
      collections: Math.round(col30DTotal * 100) / 100,
      expenses: Math.round(exp30DTotal * 100) / 100,
      netCashFlow: Math.round((col30DTotal - exp30DTotal) * 100) / 100,
      pendingDues: totalOutstandingDues,
      chartBars: bars30D,
    },
    "90D": {
      collections: Math.round(col90DTotal * 100) / 100,
      expenses: Math.round(exp90DTotal * 100) / 100,
      netCashFlow: Math.round((col90DTotal - exp90DTotal) * 100) / 100,
      pendingDues: totalOutstandingDues,
      chartBars: bars90D,
    },
  };

  // Attendance 30-Day Series & 7-Day Moving Average
  const attendanceByDate = new Map<string, number>();
  (attendance60DaysRes.data || []).forEach((a) => {
    if (a.check_in_date) {
      attendanceByDate.set(
        a.check_in_date,
        (attendanceByDate.get(a.check_in_date) || 0) + 1
      );
    }
  });

  const attendancePoints = [];
  let curr30DayAttTotal = 0;
  for (let i = 29; i >= 0; i--) {
    const dStr = addDaysIST(todayStr, -i);
    const count = attendanceByDate.get(dStr) || 0;
    curr30DayAttTotal += count;

    let sum7 = 0;
    for (let j = 0; j < 7; j++) {
      const prevDStr = addDaysIST(dStr, -j);
      sum7 += attendanceByDate.get(prevDStr) || 0;
    }
    const movingAvg = Math.round((sum7 / 7) * 10) / 10;

    const dObj = new Date(dStr + "T00:00:00+05:30");
    const dayLabel = dObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    attendancePoints.push({
      date: dStr,
      dayLabel,
      count,
      movingAvg,
    });
  }

  let prev30DayAttTotal = 0;
  for (let i = 59; i >= 30; i--) {
    const dStr = addDaysIST(todayStr, -i);
    prev30DayAttTotal += attendanceByDate.get(dStr) || 0;
  }

  const attDeltaPct = calculateDeltaPct(curr30DayAttTotal, prev30DayAttTotal);

  let last7DaysAttSum = 0;
  for (let i = 6; i >= 0; i--) {
    const dStr = addDaysIST(todayStr, -i);
    last7DaysAttSum += attendanceByDate.get(dStr) || 0;
  }
  const avg7Day = Math.round((last7DaysAttSum / 7) * 10) / 10;

  const attendanceSeries: AttendanceSeriesData = {
    points: attendancePoints,
    currTotal: curr30DayAttTotal,
    prevTotal: prev30DayAttTotal,
    deltaPct: attDeltaPct,
    avg7Day,
  };

  // Weekly Pulse (7-Day Sparklines & % Deltas)
  let prev7DaysRev = 0;
  for (let i = 13; i >= 7; i--) {
    const dStr = addDaysIST(todayStr, -i);
    prev7DaysRev += collectionsByDate.get(dStr) || 0;
  }
  const revDeltaPct = calculateDeltaPct(col7DTotal, prev7DaysRev);

  let prev7DaysExp = 0;
  for (let i = 13; i >= 7; i--) {
    const dStr = addDaysIST(todayStr, -i);
    prev7DaysExp += expensesByDate.get(dStr) || 0;
  }
  const expDeltaPct = calculateDeltaPct(exp7DTotal, prev7DaysExp);

  const memberJoinDateMap = new Map<string, number>();
  allMembers.forEach((m: { created_at?: string }) => {
    if (m.created_at) {
      const istDate = new Date(m.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      memberJoinDateMap.set(istDate, (memberJoinDateMap.get(istDate) || 0) + 1);
    }
  });

  const memberGrowthPoints: number[] = [];
  let curr7DaysMembers = 0;
  for (let i = 6; i >= 0; i--) {
    const dStr = addDaysIST(todayStr, -i);
    const count = memberJoinDateMap.get(dStr) || 0;
    memberGrowthPoints.push(count);
    curr7DaysMembers += count;
  }

  let prev7DaysMembers = 0;
  for (let i = 13; i >= 7; i--) {
    const dStr = addDaysIST(todayStr, -i);
    prev7DaysMembers += memberJoinDateMap.get(dStr) || 0;
  }
  const memberDeltaPct = calculateDeltaPct(curr7DaysMembers, prev7DaysMembers);

  const weeklyPulse = {
    revenue: {
      title: "Revenue",
      currentValueFormatted: `₹${col7DTotal.toLocaleString("en-IN")}`,
      deltaPct: revDeltaPct,
      points: bars7D.map((b) => b.collections),
      color: "#10B981",
    },
    expenses: {
      title: "Expenses",
      currentValueFormatted: `₹${exp7DTotal.toLocaleString("en-IN")}`,
      deltaPct: expDeltaPct,
      points: bars7D.map((b) => b.expenses),
      color: "#F43F5E",
    },
    memberGrowth: {
      title: "Member Growth",
      currentValueFormatted: `+${curr7DaysMembers}`,
      deltaPct: memberDeltaPct,
      points: memberGrowthPoints,
      color: "#3B82F6",
    },
  };

  // Live Check-Ins (Today's top entries)
  const liveCheckIns: LiveCheckInItem[] = (recentAttendanceRes.data || []).slice(0, 5).map((ci) => {
    const member = ci.members as unknown as { id?: string; full_name?: string; branches?: { name: string } | null } | null;
    return {
      id: ci.id,
      memberId: ci.member_id || member?.id || "",
      fullName: member?.full_name || "Member",
      method: ci.check_in_method || "manual",
      checkInTime: ci.check_in_time,
      branchName: member?.branches?.name || undefined,
    };
  });

  const currentBranchName =
    branchList.find((b) => b.id === selectedBranchId)?.name ||
    (branchList.length === 1 ? branchList[0]?.name : "All Branches");

  return (
    <div className="space-y-4 max-w-7xl mx-auto text-foreground">
      {/* 1. Setup Checklist Strip / Lifecycle Banner */}
      <LifecycleStageBanner
        gymId={gymId}
        stage={lifecycleStage}
        plansCount={plansCount}
        membersCount={totalMembersCount}
        unassignedCount={unassignedCount}
        userRole={authContext.role}
      />

      {/* 2. Main Dashboard Composition (Desktop 3-Column & Mobile Rhythm) */}
      <DashboardViewClient
        gymId={gymId}
        gymName={gym?.name || "GymApra Command Center"}
        branchName={currentBranchName}
        selectedBranchId={selectedBranchId || gymBranchIds[0] || ""}
        todayStr={todayStr}
        todayCollection={todayCollection}
        todayCash={todayCash}
        todayUpi={todayUpi}
        financialData={financialData}
        attendanceSeries={attendanceSeries}
        weeklyPulse={weeklyPulse}
        membershipHealth={membershipHealth}
        expiringSoon={expiringMembers}
        liveCheckIns={liveCheckIns}
        modalPlans={modalPlans}
        pilotStatus={pilotStatus}
      />
    </div>
  );
}
