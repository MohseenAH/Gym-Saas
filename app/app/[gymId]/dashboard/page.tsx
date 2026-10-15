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
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { BranchSelector } from "@/components/dashboard/branch-selector";
import { ExpiringSoonAlerts, ExpiringMember } from "@/components/dashboard/expiring-soon-alerts";

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

  const todayStr = new Date().toISOString().split("T")[0];

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

    // Check if expiring in next 7 days
    const expDate = new Date(m.end_date);
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner & Pilot Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {gym?.name || "GymApra Command Center"}
            </h1>
            {pilotStatus.isPilot && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                {pilotStatus.badgeText}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time daily collections, outstanding member dues, attendance, and Indian gym operations
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <BranchSelector
            gymId={gymId}
            branches={branchList}
            currentBranchId={selectedBranchId || undefined}
          />
          <Link
            href={`/app/${gymId}/attendance`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Check-In Kiosk
          </Link>
          <Link
            href={`/app/${gymId}/members`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Enroll Member
          </Link>
        </div>
      </div>

      {/* Row 1: Priority Cash & Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Collections */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Today&apos;s Collections
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 tracking-tight">
            ₹{todayCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-slate-500">
            <span className="px-2 py-0.5 rounded-md bg-slate-100">
              Cash: ₹{todayCash.toLocaleString("en-IN")}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100">
              UPI: ₹{todayUpi.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Outstanding Member Dues */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Member Dues
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-600 tracking-tight">
            ₹{totalOutstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Uncollected balance on active contracts
          </div>
        </div>

        {/* Net Cash Flow (P&L) */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Net Cash Flow
            </span>
            <div
              className={`p-2 rounded-xl ${
                isProfitable ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`mt-3 text-2xl font-black tracking-tight ${
              isProfitable ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {isProfitable ? "+" : ""}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Revenue (₹{totalRevenue.toLocaleString("en-IN")}) &minus; Expenses (₹{totalExpenses.toLocaleString("en-IN")})
          </div>
        </div>
      </div>

      {/* Row 2: Operational Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{membersCount || 0}</div>
            <div className="text-xs text-slate-500 font-medium">Active Enrolled Members</div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{todayCheckIns || 0}</div>
            <div className="text-xs text-slate-500 font-medium">Workouts Checked-in Today</div>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{noticesCount || 0}</div>
            <div className="text-xs text-slate-500 font-medium">Active Member Notices</div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Live Stream */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Today&apos;s Live Check-Ins</h2>
            <Link
              href={`/app/${gymId}/attendance`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Full Roster →
            </Link>
          </div>

          {!recentCheckIns || recentCheckIns.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No members have checked in today yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentCheckIns.map((ci) => (
                <div key={ci.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-900">
                      {(ci.members as unknown as { full_name?: string } | null)?.full_name || "Member"}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      ({ci.check_in_method.replace("_", " ")})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
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

        {/* Quick Operations Links */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Quick Operations Hub</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/app/${gymId}/payments`}
              className="group p-3.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all flex flex-col justify-between"
            >
              <div className="p-2 w-fit rounded-lg bg-emerald-50 text-emerald-600 mb-2">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Record Payment</div>
                <div className="text-[11px] text-slate-400">Collect fees & send WhatsApp receipt</div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/expenses`}
              className="group p-3.5 rounded-xl border border-slate-100 hover:border-red-200 hover:bg-red-50/20 transition-all flex flex-col justify-between"
            >
              <div className="p-2 w-fit rounded-lg bg-red-50 text-red-600 mb-2">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Track Expense</div>
                <div className="text-[11px] text-slate-400">Log bills, rent, and salaries</div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/notices`}
              className="group p-3.5 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition-all flex flex-col justify-between"
            >
              <div className="p-2 w-fit rounded-lg bg-amber-50 text-amber-600 mb-2">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Post Notice</div>
                <div className="text-[11px] text-slate-400">Broadcast to member portals</div>
              </div>
            </Link>

            <Link
              href={`/app/${gymId}/members`}
              className="group p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all flex flex-col justify-between"
            >
              <div className="p-2 w-fit rounded-lg bg-indigo-50 text-indigo-600 mb-2">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Manage Members</div>
                <div className="text-[11px] text-slate-400">Directory & WhatsApp invites</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
