import { createClient } from "@/lib/supabase/server";
import {
  Users,
  CalendarCheck,
  CreditCard,
  Receipt,
  Bell,
  Sparkles,
  Wallet,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { ExpiringSoonAlerts, ExpiringMember } from "@/components/dashboard/expiring-soon-alerts";
import { LifecycleStageBanner } from "@/components/dashboard/lifecycle-stage-banner";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { getTodayIST, resolveGymLifecycleStage } from "@/lib/utils";

interface PageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
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

  // Prepare all independent queries simultaneously
  let allMembersQuery = supabase
    .from("members")
    .select("id, branch_id, status, memberships(id)")
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

  let paymentsQuery = supabase
    .from("payments")
    .select("id, membership_id, amount, payment_method, payment_status, payment_date")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    paymentsQuery = paymentsQuery.eq("branch_id", selectedBranchId);
  }

  let expensesQuery = supabase
    .from("expenses")
    .select("amount, created_at")
    .eq("gym_id", gymId);
  if (isValidBranchFilter) {
    expensesQuery = expensesQuery.eq("branch_id", selectedBranchId);
  }

  const membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, member_id, end_date, status, membership_plans(name, price), members(id, full_name, phone, branch_id, branches(name))"
    )
    .eq("status", "active");

  let noticesQuery = supabase
    .from("notices")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .eq("is_active", true);
  if (isValidBranchFilter) {
    noticesQuery = noticesQuery.eq("branch_id", selectedBranchId);
  }

  let recentAttendanceQuery = supabase
    .from("attendance")
    .select("id, check_in_time, check_in_method, members(full_name, branch_id, branches(name))")
    .eq("check_in_date", todayStr)
    .order("check_in_time", { ascending: false })
    .limit(6);
  if (isValidBranchFilter) {
    recentAttendanceQuery = recentAttendanceQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    recentAttendanceQuery = recentAttendanceQuery.in("branch_id", gymBranchIds);
  }

  // Execute all dashboard queries concurrently in parallel
  const [
    allMembersRes,
    attendanceCountRes,
    paymentsRes,
    expensesRes,
    membershipsRes,
    noticesRes,
    recentAttendanceRes,
    plansRes,
  ] = await Promise.all([
    allMembersQuery,
    attendanceCountQuery,
    paymentsQuery,
    expensesQuery,
    membershipsQuery,
    noticesQuery,
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
  const expenses = expensesRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const recentCheckIns = recentAttendanceRes.data || [];

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

  const todayCollections = Math.round(todayPayments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
  const todayCash = Math.round(todayPayments
    .filter((p) => p.payment_method === "cash")
    .reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
  const todayUpi = Math.round(todayPayments
    .filter((p) => p.payment_method === "upi")
    .reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

  const totalRevenue = Math.round(validPayments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;
  const totalExpenses = Math.round((expenses || []).reduce((sum, e) => sum + Number(e.amount), 0) * 100) / 100;

  // Net Cash Flow
  const netCashFlow = Math.round((totalRevenue - totalExpenses) * 100) / 100;
  const isProfitable = netCashFlow >= 0;

  // Active memberships & Outstanding Dues
  let totalOutstandingDues = 0;
  const memberIdsWithDues = new Set<string>();
  const expiringMembers: ExpiringMember[] = [];

  const paymentSumByMembership = new Map<string, number>();
  validPayments.forEach((p) => {
    if (p.membership_id) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + Number(p.amount)
      );
    }
  });

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

  ((rawMemberships as unknown as RawMembershipItem[]) || []).forEach((m) => {
    const member = m.members;
    if (!member) return;

    // Strict tenant isolation: verify member belongs to this gym's branches
    if (!gymBranchIds.includes(member.branch_id)) {
      return;
    }

    if (isValidBranchFilter && member.branch_id !== selectedBranchId) {
      return;
    }

    const planPrice = Number(m.membership_plans?.price || 0);
    const paid = paymentSumByMembership.get(m.id) || 0;
    const dues = Math.max(0, planPrice - paid);
    if (dues > 0) {
      totalOutstandingDues += dues;
      memberIdsWithDues.add(member.id);
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
        phone: member.phone,
        planName: m.membership_plans?.name || "Active Plan",
        endDate: m.end_date,
        daysLeft,
        branchName: member.branches?.name || "Main Branch",
      });
    }
  });

  totalOutstandingDues = Math.round(totalOutstandingDues * 100) / 100;
  const membersWithDuesCount = memberIdsWithDues.size;
  expiringMembers.sort((a, b) => a.daysLeft - b.daysLeft);

  const formattedNetCashFlow =
    netCashFlow < 0
      ? `-₹${Math.abs(netCashFlow).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
      : `₹${netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const formatCompactRupees = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1000) {
      const formatted = (abs / 1000).toFixed(1).replace(/\.0$/, "");
      return `${formatted}k`;
    }
    return abs.toLocaleString("en-IN");
  };

  // Operational metrics
  const attendanceRate = membersCount > 0 ? Math.round((todayCheckIns / membersCount) * 100) : 0;
  const healthyActiveCount = Math.max(0, membersCount - expiringMembers.length);
  const expiringCount = expiringMembers.length;
  const inactiveOrUnassignedCount = Math.max(0, totalMembersCount - membersCount);

  const healthyPct = totalMembersCount > 0 ? Math.round((healthyActiveCount / totalMembersCount) * 100) : 0;
  const expiringPct = totalMembersCount > 0 ? Math.round((expiringCount / totalMembersCount) * 100) : 0;
  const inactivePct = totalMembersCount > 0 ? Math.max(0, 100 - healthyPct - expiringPct) : 0;

  // Financial Split Metrics
  const revVsExpTotal = totalRevenue + totalExpenses;
  const revPct = revVsExpTotal > 0 ? Math.round((totalRevenue / revVsExpTotal) * 100) : 100;
  const expPct = 100 - revPct;

  const todayCashUpiTotal = todayCash + todayUpi;
  const todayCashPct = todayCashUpiTotal > 0 ? Math.round((todayCash / todayCashUpiTotal) * 100) : 50;
  const todayUpiPct = 100 - todayCashPct;

  const todayFormatted = new Date(todayStr + "T00:00:00+05:30").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const currentBranchName =
    branchList.find((b) => b.id === selectedBranchId)?.name ||
    (branchList.length === 1 ? branchList[0]?.name : "All Branches");

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-foreground">
      {/* 1. Hero Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 sm:p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {gym?.name || "GymApra Command Center"}
            </h1>
            {pilotStatus.isPilot && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {pilotStatus.badgeText}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1 flex-wrap">
            <span className="font-medium text-foreground">{todayFormatted}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {currentBranchName}
            </span>
            <span>•</span>
            <span>Live Operations</span>
          </div>
        </div>

        {/* Primary Action Buttons: Solid Emerald Check-In & Solid Indigo/Blue + Enroll */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5 w-full sm:w-auto shrink-0">
          <Link
            href={`/app/${gymId}/attendance`}
            className="h-11 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Check-In</span>
          </Link>
          <QuickEnrollModal
            gymId={gymId}
            branchId={selectedBranchId || gymBranchIds[0] || ""}
            plans={modalPlans}
            triggerLabel="+ Enroll"
            triggerClassName="h-11 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer w-full sm:w-auto"
          />
        </div>
      </div>

      {/* 2. Compact Setup Checklist Strip / Lifecycle Banner */}
      <LifecycleStageBanner
        gymId={gymId}
        stage={lifecycleStage}
        plansCount={plansCount}
        membersCount={totalMembersCount}
        unassignedCount={unassignedCount}
        userRole={authContext.role}
      />

      {/* 3. Four Vibrant Financial KPI Cards (Separated Elevated Cards) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Today's Collection (Emerald accent + Wallet badge) */}
        <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border border-t-2 border-t-emerald-500 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Today&apos;s Collection
            </span>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight truncate tabular-nums">
            ₹{todayCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
              Cash: ₹{todayCash.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
              UPI: ₹{todayUpi.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Metric 2: Pending Dues (Amber accent + AlertCircle badge, links to /payments) */}
        <Link
          href={`/app/${gymId}/payments`}
          className="bg-card p-4 sm:p-5 rounded-2xl border border-border border-t-2 border-t-amber-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate group-hover:text-amber-600 transition-colors">
              Pending Dues
            </span>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight truncate tabular-nums">
            ₹{totalOutstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-between gap-1 truncate">
            <span className="truncate">
              {membersWithDuesCount} member{membersWithDuesCount === 1 ? "" : "s"} with dues
            </span>
            <span className="text-amber-600 dark:text-amber-400 text-xs font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
              Collect →
            </span>
          </div>
        </Link>

        {/* Metric 3: Net Cash Flow (Dynamic Emerald/Rose + TrendingUp/Down badge) */}
        <div
          className={`bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between ${
            isProfitable ? "border-t-2 border-t-emerald-500" : "border-t-2 border-t-rose-500"
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Net Cash Flow
            </span>
            <div
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 ${
                isProfitable
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              }`}
            >
              {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </div>
          <div
            className={`mt-2 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate tabular-nums ${
              isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formattedNetCashFlow}
          </div>
          <div className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground truncate tabular-nums">
            Rev ₹{formatCompactRupees(totalRevenue)} &minus; Exp ₹{formatCompactRupees(totalExpenses)}
          </div>
        </div>

        {/* Metric 4: Total Revenue (Indigo/Blue accent + Receipt badge) */}
        <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border border-t-2 border-t-indigo-500 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Revenue
            </span>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight truncate tabular-nums">
            ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground truncate tabular-nums">
            {validPayments.length} recorded receipt{validPayments.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* 4. Live Gym Pulse & Membership Health Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 cols: Operational Pulse Tiles */}
        <div className="lg:col-span-7 grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Tile 1: Active Members */}
          <Link
            href={`/app/${gymId}/members`}
            className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border border-l-3 border-l-indigo-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-muted-foreground truncate group-hover:text-indigo-600 transition-colors">
                Active Members
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
                {membersCount}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Roster active
              </div>
            </div>
          </Link>

          {/* Tile 2: Check-Ins Today */}
          <Link
            href={`/app/${gymId}/attendance`}
            className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border border-l-3 border-l-emerald-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-muted-foreground truncate group-hover:text-emerald-600 transition-colors">
                Today&apos;s Check-Ins
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                <CalendarCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {todayCheckIns}
              </div>
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5 truncate tabular-nums">
                {attendanceRate}% of active
              </div>
            </div>
          </Link>

          {/* Tile 3: Expiring in 7 Days */}
          <Link
            href={`/app/${gymId}/memberships?tab=active`}
            className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border border-l-3 border-l-amber-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-muted-foreground truncate group-hover:text-amber-600 transition-colors">
                Expiring Soon
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                {expiringMembers.length}
              </div>
              <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {expiringMembers.length === 0 ? "Healthy retention" : "Renewals due"}
              </div>
            </div>
          </Link>
        </div>

        {/* Right 5 cols: Membership Health Snapshot card */}
        <div className="lg:col-span-5 bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">Membership Health</span>
              <span className="text-[11px] font-semibold text-muted-foreground">Snapshot</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-foreground border border-border tabular-nums">
              {totalMembersCount} Total
            </span>
          </div>

          <div className="my-2">
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden flex">
              <div
                style={{ width: `${healthyPct}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Active: ${healthyActiveCount}`}
              />
              <div
                style={{ width: `${expiringPct}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`Expiring: ${expiringCount}`}
              />
              <div
                style={{ width: `${inactivePct}%` }}
                className="bg-rose-500/70 h-full transition-all"
                title={`Expired/Unassigned: ${inactiveOrUnassignedCount}`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold flex-wrap gap-1 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="tabular-nums font-bold text-foreground">{healthyActiveCount}</span> Active
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="tabular-nums font-bold text-foreground">{expiringCount}</span> Expiring
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500/70" />
              <span className="tabular-nums font-bold text-foreground">{inactiveOrUnassignedCount}</span> Inactive
            </div>
          </div>
        </div>
      </div>

      {/* 5. Actionable Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7 cols): Expiring Radar & Today's Live Check-Ins */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Expiring in 7 Days Radar */}
          <ExpiringSoonAlerts
            gymId={gymId}
            gymName={gym?.name || "Our Gym"}
            expiringMembers={expiringMembers}
          />

          {/* Card 2: Today's Live Check-Ins Feed Card */}
          <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border border-t-2 border-t-indigo-500 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Today&apos;s Live Check-Ins</h2>
                  <p className="text-xs text-muted-foreground">Front desk entry log</p>
                </div>
              </div>
              <Link
                href={`/app/${gymId}/attendance`}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Kiosk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {!recentCheckIns || recentCheckIns.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No members checked in yet today</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Launch the reception kiosk to mark member check-ins
                  </p>
                </div>
                <Link
                  href={`/app/${gymId}/attendance`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Mark First Check-In</span>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentCheckIns.map((ci) => {
                  const memberName =
                    (ci.members as unknown as { full_name?: string } | null)?.full_name || "Member";
                  return (
                    <div key={ci.id} className="py-3 flex items-center justify-between hover:bg-muted/30 px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 font-bold flex items-center justify-center text-xs border border-indigo-500/20 shrink-0">
                          {memberName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-foreground">{memberName}</div>
                          <div className="text-[11px] text-muted-foreground capitalize flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            <span>{ci.check_in_method.replace("_", " ")}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {new Date(ci.check_in_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Quick Actions Hub & Financial Split */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Quick Actions Hub Card */}
          <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Quick Actions</h2>
                <p className="text-xs text-muted-foreground">Daily operations &amp; tools</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border">
                Shortcuts
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Action 1: Record Payment (Emerald) */}
              <Link
                href={`/app/${gymId}/payments`}
                className="group p-3.5 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/25 hover:border-emerald-500/40 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="p-2 w-fit rounded-xl bg-emerald-500/15 text-emerald-600 mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors truncate">
                    Record Payment
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    Collect fees &amp; dues
                  </div>
                </div>
              </Link>

              {/* Action 2: Track Expense (Rose) */}
              <Link
                href={`/app/${gymId}/expenses`}
                className="group p-3.5 rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/25 hover:border-rose-500/40 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="p-2 w-fit rounded-xl bg-rose-500/15 text-rose-600 mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-rose-600 transition-colors truncate">
                    Track Expense
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    Log bills &amp; payroll
                  </div>
                </div>
              </Link>

              {/* Action 3: Post Notice (Amber) */}
              <Link
                href={`/app/${gymId}/notices`}
                className="group p-3.5 rounded-2xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/25 hover:border-amber-500/40 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="p-2 w-fit rounded-xl bg-amber-500/15 text-amber-600 mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-amber-600 transition-colors truncate">
                    Post Notice
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    Member alerts
                  </div>
                </div>
              </Link>

              {/* Action 4: Manage Members (Indigo) */}
              <Link
                href={`/app/${gymId}/members`}
                className="group p-3.5 rounded-2xl bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/25 hover:border-indigo-500/40 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div className="p-2 w-fit rounded-xl bg-indigo-500/15 text-indigo-600 mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground group-hover:text-indigo-600 transition-colors truncate">
                    Manage Members
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    Roster &amp; passes
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Card 2: Financial Split / Cash vs Expense Snapshot Card */}
          <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-xs text-card-foreground space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Cash Flow Breakdown</h2>
                <p className="text-xs text-muted-foreground">Revenue vs. Expenses split</p>
              </div>
              <Link
                href={`/app/${gymId}/reports`}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Split Bar 1: Total Revenue vs Total Expenses */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">
                  Revenue: ₹{totalRevenue.toLocaleString("en-IN")}
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  Expenses: ₹{totalExpenses.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden flex">
                <div
                  style={{ width: `${revPct}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Revenue: ${revPct}%`}
                />
                <div
                  style={{ width: `${expPct}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Expenses: ${expPct}%`}
                />
              </div>
            </div>

            {/* Split Bar 2: Today's Collection Cash vs UPI */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-foreground">
                  Today Cash: ₹{todayCash.toLocaleString("en-IN")} ({todayCashPct}%)
                </span>
                <span className="text-foreground">
                  Today UPI: ₹{todayUpi.toLocaleString("en-IN")} ({todayUpiPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  style={{ width: `${todayCashPct}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Cash: ${todayCashPct}%`}
                />
                <div
                  style={{ width: `${todayUpiPct}%` }}
                  className="bg-indigo-500 h-full transition-all"
                  title={`UPI: ${todayUpiPct}%`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}