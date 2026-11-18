import { createClient } from "@/lib/supabase/server";
import {
  Users,
  CalendarCheck,
  CreditCard,
  Receipt,
  TrendingUp,
  Bell,
  UserPlus,
  IndianRupee,
  Sparkles,
  Zap,
  Building2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { ExpiringSoonAlerts, ExpiringMember } from "@/components/dashboard/expiring-soon-alerts";
import { LifecycleStageBanner } from "@/components/dashboard/lifecycle-stage-banner";
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
    .select("id, branch_id, branches!inner(gym_id)", { count: "exact", head: true })
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
    .select("id, check_in_time, check_in_method, members(full_name)")
    .eq("check_in_date", todayStr)
    .order("check_in_time", { ascending: false })
    .limit(5);
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
  const plansCount = plansRes.count ?? 0;
  const todayCheckIns = attendanceCountRes.count ?? 0;
  const allPayments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const noticesCount = noticesRes.count;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalOutstandingDues = 0;
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
    totalOutstandingDues += dues;

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
  expiringMembers.sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-foreground">
      {/* 1. Header & Primary Actions Hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {gym?.name || "GymApra Command Center"}
            </h1>
            {pilotStatus.isPilot && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                {pilotStatus.badgeText}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time daily collections, outstanding member dues, attendance, and gym operations
          </p>
        </div>

        {/* Primary Action Buttons: 2-column full width on mobile, aligned right on desktop */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5 w-full sm:w-auto shrink-0">
          <Link
            href={`/app/${gymId}/attendance`}
            className="h-10 sm:h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-sm font-bold shadow-xs transition-opacity cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Check-In</span>
          </Link>
          <Link
            href={`/app/${gymId}/members`}
            className="h-10 sm:h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-sm font-bold border border-border shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">+ Enroll</span>
          </Link>
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

      {/* 3. Unified Financial & Operational KPI Block */}
      <div className="rounded-2xl sm:rounded-3xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden">
        {/* Desktop: 4-column horizontal grid with vertical dividers (grid-cols-4 divide-x)
            Mobile: 2x2 grid with horizontal and vertical dividers (grid-cols-2 divide-x divide-y) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
          {/* Metric 1: Today's Collection */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground truncate">
                Today&apos;s Collection
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 tracking-tight truncate">
              ₹{todayCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                Cash: ₹{todayCash.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                UPI: ₹{todayUpi.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Metric 2: Pending Dues */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground truncate">
                Pending Dues
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-amber-600 tracking-tight truncate">
              ₹{totalOutstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Uncollected balance
            </div>
          </div>

          {/* Metric 3: Net Cash Flow */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground truncate">
                Net Cash Flow
              </span>
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isProfitable ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-2 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate ${
                isProfitable ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isProfitable ? "+" : ""}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Rev ₹{totalRevenue.toLocaleString("en-IN")} &minus; Exp ₹{totalExpenses.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Metric 4: Total Revenue */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground truncate">
                Total Revenue
              </span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight truncate">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {validPayments.length} recorded receipts
            </div>
          </div>
        </div>

        {/* Attached single full-width footer strip showing operational pulse */}
        <div className="border-t border-border px-4 py-2.5 bg-muted/30 text-center text-xs sm:text-sm font-semibold text-muted-foreground">
          <span className="text-foreground font-bold">{membersCount || 0}</span> Active Members
          <span className="mx-2 text-border">•</span>
          <span className="text-foreground font-bold">{todayCheckIns || 0}</span> Check-Ins Today
          <span className="mx-2 text-border">•</span>
          <span className="text-foreground font-bold">{branchList.length}</span> {branchList.length === 1 ? "Branch" : "Branches"}
        </div>
      </div>

      {/* 4. Balanced Lower Workspace Grid */}

      {/* Desktop View (visible on lg:grid) */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Columns: Expiring Members & Today's Live Check-Ins */}
        <div className="lg:col-span-7 space-y-5">
          <ExpiringSoonAlerts
            gymId={gymId}
            gymName={gym?.name || "Our Gym"}
            expiringMembers={expiringMembers}
          />

          {/* Today's Live Check-Ins Card */}
          <div className="bg-card p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Today&apos;s Live Check-Ins</h2>
              <Link
                href={`/app/${gymId}/attendance`}
                className="text-xs sm:text-sm font-bold text-primary hover:underline cursor-pointer"
              >
                Full Roster →
              </Link>
            </div>

            {!recentCheckIns || recentCheckIns.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground font-medium">
                No members have checked in today yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentCheckIns.map((ci) => (
                  <div key={ci.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-sm font-bold text-foreground">
                        {(ci.members as unknown as { full_name?: string } | null)?.full_name || "Member"}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        ({ci.check_in_method.replace("_", " ")})
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {new Date(ci.check_in_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Quick Actions 2x2 Grid Card */}
        <div className="lg:col-span-5 bg-card p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/app/${gymId}/payments`}
              className="group p-3.5 rounded-2xl border border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 mb-2.5 shadow-2xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground group-hover:text-emerald-600 transition-colors truncate">
                  Record Payment
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Collect fees & dues
                </div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/expenses`}
              className="group p-3.5 rounded-2xl border border-border hover:border-rose-500/40 hover:bg-rose-500/5 transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="p-2.5 w-fit rounded-xl bg-rose-500/10 text-rose-600 mb-2.5 shadow-2xs">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground group-hover:text-rose-600 transition-colors truncate">
                  Track Expense
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Log bills & payroll
                </div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/notices`}
              className="group p-3.5 rounded-2xl border border-border hover:border-amber-500/40 hover:bg-amber-500/5 transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 text-amber-600 mb-2.5 shadow-2xs">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground group-hover:text-amber-600 transition-colors truncate">
                  Post Notice
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Member broadcast
                </div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/members`}
              className="group p-3.5 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="p-2.5 w-fit rounded-xl bg-primary/10 text-primary mb-2.5 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  Manage Members
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Roster & enrollment
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile View (visible on lg:hidden) */}
      <div className="lg:hidden space-y-4">
        {/* Merged Divided Vertical Container for Expiring + Today's Check-Ins */}
        <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-xs divide-y divide-border overflow-hidden">
          {/* Section 1: Expiring in 7 Days */}
          <ExpiringSoonAlerts
            gymId={gymId}
            gymName={gym?.name || "Our Gym"}
            expiringMembers={expiringMembers}
            isEmbedded={true}
          />

          {/* Section 2: Today's Live Check-Ins */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Today&apos;s Live Check-Ins</h2>
              <Link
                href={`/app/${gymId}/attendance`}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Full Roster →
              </Link>
            </div>

            {!recentCheckIns || recentCheckIns.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground font-medium">
                No members have checked in today yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentCheckIns.map((ci) => (
                  <div key={ci.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-foreground">
                        {(ci.members as unknown as { full_name?: string } | null)?.full_name || "Member"}
                      </span>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        ({ci.check_in_method.replace("_", " ")})
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {new Date(ci.check_in_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile 2x2 Grid of Compact Horizontal Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/app/${gymId}/payments`}
            className="p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2.5 cursor-pointer shadow-xs"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">Record Payment</div>
              <div className="text-[10px] text-muted-foreground truncate">Collect dues</div>
            </div>
          </Link>

          <Link
            href={`/app/${gymId}/expenses`}
            className="p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2.5 cursor-pointer shadow-xs"
          >
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">Track Expense</div>
              <div className="text-[10px] text-muted-foreground truncate">Log bills</div>
            </div>
          </Link>

          <Link
            href={`/app/${gymId}/notices`}
            className="p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2.5 cursor-pointer shadow-xs"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">Post Notice</div>
              <div className="text-[10px] text-muted-foreground truncate">Broadcast</div>
            </div>
          </Link>

          <Link
            href={`/app/${gymId}/members`}
            className="p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2.5 cursor-pointer shadow-xs"
          >
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">Manage Members</div>
              <div className="text-[10px] text-muted-foreground truncate">Roster</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}