import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import {
  ReportsViewClient,
  ReportPayment,
  ReportExpense,
  ReportAttendance,
  ReportMembership,
} from "@/components/reports/reports-view-client";

interface ReportsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "reports:view",
  });

  const cookieStore = await cookies();
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

  // Build filtered queries
  let paymentsQuery = supabase
    .from("payments")
    .select(
      "id, amount, payment_method, payment_status, payment_date, branch_id, membership_id, members(id, full_name, phone), branches(name)"
    )
    .eq("gym_id", gymId)
    .order("payment_date", { ascending: false });

  if (branchContext.selectedBranchId) {
    paymentsQuery = paymentsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    paymentsQuery = paymentsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  let expensesQuery = supabase
    .from("expenses")
    .select("id, amount, category, expense_date, payment_method, description, branch_id, branches(name)")
    .eq("gym_id", gymId)
    .order("expense_date", { ascending: false });

  if (branchContext.selectedBranchId) {
    expensesQuery = expensesQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    expensesQuery = expensesQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  let attendanceQuery = supabase
    .from("attendance")
    .select("id, check_in_date, check_in_time, branch_id, members(full_name), branches(name)")
    .order("check_in_date", { ascending: false })
    .limit(300);

  if (branchContext.selectedBranchId) {
    attendanceQuery = attendanceQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    attendanceQuery = attendanceQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  const [gymRes, branchesRes, paymentsRes, expensesRes, membershipsRes, attendanceRes] =
    await Promise.all([
      supabase
        .from("gyms")
        .select("name")
        .eq("id", gymId)
        .single(),
      supabase
        .from("branches")
        .select("id, name")
        .eq("gym_id", gymId)
        .eq("is_active", true),
      paymentsQuery,
      expensesQuery,
      supabase
        .from("memberships")
        .select(
          "id, member_id, start_date, end_date, status, membership_plans(name, price), members(id, full_name, phone, branch_id, branches(name))"
        )
        .order("end_date", { ascending: false }),
      attendanceQuery,
    ]);

  const gym = gymRes.data;
  const branches = branchesRes.data || [];

  const payments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const attendance = attendanceRes.data || [];

  interface DbPayment {
    id: string;
    amount: number | string;
    payment_method: string;
    payment_status: string;
    payment_date: string;
    branch_id: string;
    membership_id?: string | null;
    members?: { full_name?: string; phone?: string } | null;
    branches?: { name?: string } | null;
  }

  interface DbExpense {
    id: string;
    amount: number | string;
    category: string;
    expense_date: string;
    payment_method: string;
    description?: string | null;
    branch_id: string;
    branches?: { name?: string } | null;
  }

  interface DbAttendance {
    id: string;
    check_in_date: string;
    check_in_time: string;
    branch_id: string;
    members?: { full_name?: string } | null;
    branches?: { name?: string } | null;
  }

  interface DbMembership {
    id: string;
    member_id: string;
    start_date: string;
    end_date: string;
    status: string;
    members?: {
      id?: string;
      full_name?: string;
      phone?: string;
      branch_id?: string;
      branches?: { name?: string } | null;
    } | null;
    membership_plans?: { name?: string; price?: number } | null;
  }

  const formattedPayments: ReportPayment[] = ((payments as unknown as DbPayment[]) || []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paymentMethod: p.payment_method,
    paymentStatus: p.payment_status,
    paymentDate: p.payment_date,
    memberName: p.members?.full_name || "Unknown Member",
    memberPhone: p.members?.phone || "",
    branchId: p.branch_id,
    branchName: p.branches?.name || "Main Branch",
  }));

  const formattedExpenses: ReportExpense[] = ((expenses as unknown as DbExpense[]) || []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    expenseDate: e.expense_date,
    paymentMethod: e.payment_method,
    description: e.description,
    branchId: e.branch_id,
    branchName: e.branches?.name || "Main Branch",
  }));

  const formattedAttendance: ReportAttendance[] = ((attendance as unknown as DbAttendance[]) || []).map((a) => ({
    id: a.id,
    checkInDate: a.check_in_date,
    checkInTime: a.check_in_time,
    memberName: a.members?.full_name || "Member",
    branchId: a.branch_id,
    branchName: a.branches?.name || "Main Branch",
  }));

  // Dues calculation: only completed/partial payments reduce contract dues
  const paymentSumByMembership = new Map<string, number>();
  ((payments as unknown as DbPayment[]) || []).forEach((p) => {
    if (p.membership_id && (p.payment_status === "paid" || p.payment_status === "partial")) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + Number(p.amount)
      );
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Strict tenant filtering: only include memberships belonging to authorized branch context
  const gymMemberships = ((rawMemberships as unknown as DbMembership[]) || []).filter((m) =>
    branchContext.selectedBranchId
      ? m.members?.branch_id === branchContext.selectedBranchId
      : branchContext.effectiveBranchIds.includes(m.members?.branch_id || "")
  );

  const formattedMemberships: ReportMembership[] = gymMemberships.map((m) => {
    const planPrice = Number(m.membership_plans?.price || 0);
    const paidAmount = paymentSumByMembership.get(m.id) || 0;
    const dueAmount = Math.max(0, planPrice - paidAmount);

    const expDate = new Date(m.end_date);
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      id: m.id,
      memberId: m.member_id,
      memberName: m.members?.full_name || "Member",
      memberPhone: m.members?.phone || "",
      planName: m.membership_plans?.name || "Standard Plan",
      planPrice,
      startDate: m.start_date,
      endDate: m.end_date,
      status: m.status,
      branchId: m.members?.branch_id || "",
      branchName: m.members?.branches?.name || "Main Branch",
      paidAmount,
      dueAmount,
      daysLeft,
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <ReportsViewClient
        gymId={gymId}
        gymName={gym?.name || "GymApra Fitness Club"}
        branches={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
        payments={formattedPayments}
        expenses={formattedExpenses}
        attendance={formattedAttendance}
        memberships={formattedMemberships}
      />
    </div>
  );
}
