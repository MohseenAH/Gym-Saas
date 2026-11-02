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
import { BranchSelector } from "@/components/dashboard/branch-selector";
import { ExpiringSoonAlerts, ExpiringMember } from "@/components/dashboard/expiring-soon-alerts";
import { getTodayIST } from "@/lib/utils";

interface PageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function DashboardPage({ params, searchParams }: PageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const authContext = await getAuthorizedActionContext({ gymId });
  const cookieStore = await cookies();
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
  let membersQuery = supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (isValidBranchFilter) {
    membersQuery = membersQuery.eq("branch_id", selectedBranchId);
  } else if (gymBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", gymBranchIds);
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
    membersRes,
    attendanceCountRes,
    paymentsRes,
    expensesRes,
    membershipsRes,
    noticesRes,
    recentAttendanceRes,
  ] = await Promise.all([
    membersQuery,
    attendanceCountQuery,
    paymentsQuery,
    expensesQuery,
    membershipsQuery,
    noticesQuery,
    recentAttendanceQuery,
  ]);

  const gym = authContext.gym;
  const pilotStatus = authContext.trialStatus;
  const branchList = authContext.branches;

  const membersCount = membersRes.count;
  const todayCheckIns = attendanceCountRes.count;
  const allPayments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const noticesCount = noticesRes.count;
  const recentCheckIns = recentAttendanceRes.data || [];

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
      {/* Welcome Banner & Pilot Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 sm:p-6 rounded-3xl border border-border shadow-xs text-card-foreground">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {gym?.name || "GymApra Command Center"}
            </h1>
            {pilotStatus.isPilot && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                {pilotStatus.badgeText}
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
            Real-time daily collections, outstanding member dues, attendance, and Indian gym operations
          </p>
        </div>

        {/* Action Header on Mobile: compact 2-column grid or flex on desktop */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <BranchSelector
            gymId={gymId}
            branches={branchList}
            currentBranchId={selectedBranchId || undefined}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
            <Link
              href={`/app/${gymId}/attendance`}
              className="h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs sm:text-sm font-semibold shadow-xs transition-opacity"
            >
              <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Check-In</span>
            </Link>
            <Link
              href={`/app/${gymId}/members`}
              className="h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs sm:text-sm font-semibold border border-border transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Enroll</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Row 1: Priority Cash & Financial Metrics (Strict 2-Column Mobile Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Today's Collections */}
        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs relative overflow-hidden text-card-foreground flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Today&apos;s Collections
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 text-lg sm:text-2xl font-bold text-emerald-600 tracking-tight truncate">
            ₹{todayCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 sm:mt-2.5 flex items-center gap-1 sm:gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60">
              Cash: ₹{todayCash.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60">
              UPI: ₹{todayUpi.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Outstanding Member Dues */}
        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Pending Dues
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 text-lg sm:text-2xl font-bold text-amber-600 tracking-tight truncate">
            ₹{totalOutstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] text-muted-foreground truncate">
            Uncollected balance
          </div>
        </div>

        {/* Net Cash Flow (P&L) */}
        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Net Cash Flow
            </span>
            <div
              className={`h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                isProfitable ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div
            className={`mt-2 sm:mt-3 text-lg sm:text-2xl font-bold tracking-tight truncate ${
              isProfitable ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {isProfitable ? "+" : ""}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] text-muted-foreground truncate">
            Rev ₹{totalRevenue.toLocaleString("en-IN")} &minus; Exp ₹{totalExpenses.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Total Revenue Collected */}
        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Total Revenue
            </span>
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 text-lg sm:text-2xl font-bold text-foreground tracking-tight truncate">
            ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 sm:mt-2 text-[10px] text-muted-foreground truncate">
            {validPayments.length} recorded receipts
          </div>
        </div>
      </div>

      {/* Row 2: Operational Stats Grid (Strict 2-Column Mobile Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-7 w-7 sm:h-9 sm:w-9 bg-primary/10 text-primary rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-foreground truncate">{membersCount || 0}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">Active Members</div>
          </div>
        </div>

        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-7 w-7 sm:h-9 sm:w-9 bg-emerald-500/10 text-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
            <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-foreground truncate">{todayCheckIns || 0}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">Check-Ins Today</div>
          </div>
        </div>

        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-7 w-7 sm:h-9 sm:w-9 bg-amber-500/10 text-amber-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-foreground truncate">{noticesCount || 0}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">Active Notices</div>
          </div>
        </div>

        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-7 w-7 sm:h-9 sm:w-9 bg-blue-500/10 text-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-2xs">
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-foreground truncate">{branchList.length}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">Facilities</div>
          </div>
        </div>
      </div>

      {/* Row 3: Expiring Soon Alert Roster (next 7 days) */}
      <ExpiringSoonAlerts
        gymId={gymId}
        gymName={gym?.name || "Our Gym"}
        expiringMembers={expiringMembers}
      />

      {/* Row 4: Today's Live Attendance Feed & Quick Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Live Stream */}
        <div className="bg-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground">Today&apos;s Live Check-Ins</h2>
            <Link
              href={`/app/${gymId}/attendance`}
              className="text-xs font-bold text-primary hover:underline"
            >
              Full Roster →
            </Link>
          </div>

          {!recentCheckIns || recentCheckIns.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No members have checked in today yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentCheckIns.map((ci) => (
                <div key={ci.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-foreground">
                      {(ci.members as unknown as { full_name?: string } | null)?.full_name || "Member"}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
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

        {/* Quick Operations Hub (2-Column Mobile Grid) */}
        <div className="bg-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <h2 className="text-sm font-bold text-foreground mb-4">Quick Operations Hub</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Link
              href={`/app/${gymId}/payments`}
              className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all flex flex-col justify-between"
            >
              <div className="p-2 sm:p-2.5 w-fit rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 mb-2 sm:mb-3 shadow-2xs">
                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground group-hover:text-emerald-600 transition-colors truncate">Record Payment</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Collect fees & receipts</div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/expenses`}
              className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border hover:border-rose-500/40 hover:bg-rose-500/5 transition-all flex flex-col justify-between"
            >
              <div className="p-2 sm:p-2.5 w-fit rounded-lg sm:rounded-xl bg-rose-500/10 text-rose-600 mb-2 sm:mb-3 shadow-2xs">
                <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground group-hover:text-rose-600 transition-colors truncate">Track Expense</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Log bills & payroll</div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/notices`}
              className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border hover:border-amber-500/40 hover:bg-amber-500/5 transition-all flex flex-col justify-between"
            >
              <div className="p-2 sm:p-2.5 w-fit rounded-lg sm:rounded-xl bg-amber-500/10 text-amber-600 mb-2 sm:mb-3 shadow-2xs">
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground group-hover:text-amber-600 transition-colors truncate">Post Notice</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Member alerts</div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/members`}
              className="group p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col justify-between"
            >
              <div className="p-2 sm:p-2.5 w-fit rounded-lg sm:rounded-xl bg-primary/10 text-primary mb-2 sm:mb-3 shadow-2xs">
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">Manage Members</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Roster & WhatsApp</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}