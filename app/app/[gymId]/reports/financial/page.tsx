import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCachedGymAuthContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import {
  FinancialReportsClient,
  FinancialPayment,
  FinancialExpense,
  FinancialMembership,
} from "@/components/reports/financial-reports-client";

interface FinancialReportsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function FinancialReportsPage({
  params,
  searchParams,
}: FinancialReportsPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // Financial route lockdown: Floor staff cannot view revenue or expense analytics
  const authContext = await getCachedGymAuthContext(gymId);
  if (!hasCapability(authContext.role, "reports:view")) {
    redirect(`/app/${gymId}/attendance`);
  }

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

  // 1. Payments Query
  let paymentsQuery = supabase
    .from("payments")
    .select(
      "id, amount, payment_method, payment_status, payment_date, membership_id, branch_id, member_id, members(full_name, phone)"
    )
    .eq("gym_id", gymId)
    .order("payment_date", { ascending: false });

  if (branchContext.selectedBranchId) {
    paymentsQuery = paymentsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    paymentsQuery = paymentsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 2. Expenses Query
  let expensesQuery = supabase
    .from("expenses")
    .select("id, amount, category, expense_date, payment_method, description, branch_id")
    .eq("gym_id", gymId)
    .order("expense_date", { ascending: false });

  if (branchContext.selectedBranchId) {
    expensesQuery = expensesQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    expensesQuery = expensesQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 3. Memberships Query
  const membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, member_id, plan_id, start_date, end_date, status, membership_plans(name, price), members(full_name, phone, branch_id)"
    )
    .eq("gym_id", gymId)
    .order("end_date", { ascending: false });

  const [paymentsRes, expensesRes, membershipsRes] = await Promise.all([
    paymentsQuery,
    expensesQuery,
    membershipsQuery,
  ]);

  const rawPayments = paymentsRes.data || [];
  const rawExpenses = expensesRes.data || [];
  const rawMemberships = membershipsRes.data || [];

  interface DbPayment {
    id: string;
    amount: number | string;
    payment_method: string;
    payment_status: string;
    payment_date: string;
    membership_id?: string | null;
    branch_id: string;
    member_id?: string;
    members?: { full_name?: string; phone?: string | null } | null;
  }

  interface DbExpense {
    id: string;
    amount: number | string;
    category: string;
    expense_date: string;
    payment_method: string;
    description?: string | null;
    branch_id: string;
  }

  interface DbMembership {
    id: string;
    member_id: string;
    plan_id?: string | null;
    start_date: string;
    end_date: string;
    status: string;
    members?: {
      full_name?: string;
      phone?: string | null;
      branch_id?: string;
    } | null;
    membership_plans?: { name?: string; price?: number } | null;
  }

  const payments: FinancialPayment[] = ((rawPayments as unknown as DbPayment[]) || []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paymentMethod: p.payment_method,
    paymentStatus: p.payment_status,
    paymentDate: p.payment_date,
    membershipId: p.membership_id,
    memberName: p.members?.full_name || "Unknown Member",
    memberPhone: p.members?.phone || null,
    branchId: p.branch_id,
  }));

  const expenses: FinancialExpense[] = ((rawExpenses as unknown as DbExpense[]) || []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    expenseDate: e.expense_date,
    paymentMethod: e.payment_method,
    description: e.description,
    branchId: e.branch_id,
  }));

  // Track payments per membership to accurately calculate dues
  const paymentSumByMembership = new Map<string, number>();
  payments.forEach((p) => {
    if (p.membershipId) {
      if (p.paymentStatus === "paid" || p.paymentStatus === "partial") {
        paymentSumByMembership.set(
          p.membershipId,
          (paymentSumByMembership.get(p.membershipId) || 0) + p.amount
        );
      } else if (p.paymentStatus === "refunded") {
        paymentSumByMembership.set(
          p.membershipId,
          (paymentSumByMembership.get(p.membershipId) || 0) - p.amount
        );
      }
    }
  });

  // Strict tenant branch filtering for memberships
  const filteredMemberships = ((rawMemberships as unknown as DbMembership[]) || []).filter((m) => {
    const memberBranchId = m.members?.branch_id;
    if (!memberBranchId) return true;
    return branchContext.selectedBranchId
      ? memberBranchId === branchContext.selectedBranchId
      : branchContext.effectiveBranchIds.includes(memberBranchId);
  });

  const memberships: FinancialMembership[] = filteredMemberships.map((m) => {
    const planPrice = Number(m.membership_plans?.price || 0);
    const paidAmount = Math.max(0, paymentSumByMembership.get(m.id) || 0);
    const dueAmount = Math.max(0, planPrice - paidAmount);

    return {
      id: m.id,
      memberId: m.member_id,
      memberName: m.members?.full_name || "Member",
      planId: m.plan_id,
      planName: m.membership_plans?.name || "Standard Plan",
      planPrice,
      startDate: m.start_date,
      endDate: m.end_date,
      status: m.status,
      branchId: m.members?.branch_id || "",
      paidAmount,
      dueAmount,
    };
  });

  const activeBranch = authContext.branches.find((b) => b.id === branchContext.selectedBranchId);
  const activeBranchName = activeBranch ? activeBranch.name : "All Branches";

  return (
    <div className="max-w-7xl mx-auto">
      <FinancialReportsClient
        gymId={gymId}
        gymName={authContext.gym?.name || "GymApra Fitness Club"}
        activeBranchName={activeBranchName}
        payments={payments}
        expenses={expenses}
        memberships={memberships}
      />
    </div>
  );
}
