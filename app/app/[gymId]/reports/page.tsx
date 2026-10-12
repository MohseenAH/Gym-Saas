import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import {
  ReportsViewClient,
  ReportPayment,
  ReportExpense,
  ReportAttendance,
  ReportMembership,
} from "@/components/reports/reports-view-client";

interface ReportsPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { gymId } = await params;

  await getAuthorizedActionContext({
    gymId,
    capability: "reports:view",
  });

  const supabase = await createClient();

  // 1. Fetch Gym
  const { data: gym } = await supabase
    .from("gyms")
    .select("name")
    .eq("id", gymId)
    .single();

  // 2. Fetch Branches
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true);

  // 3. Fetch Payments
  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount, payment_method, payment_status, payment_date, branch_id, membership_id, members(id, full_name, phone), branches(name)"
    )
    .eq("gym_id", gymId)
    .order("payment_date", { ascending: false });

  const formattedPayments: ReportPayment[] = (payments || []).map((p: any) => ({
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

  // 4. Fetch Expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, amount, category, expense_date, payment_method, description, branch_id, branches(name)")
    .eq("gym_id", gymId)
    .order("expense_date", { ascending: false });

  const formattedExpenses: ReportExpense[] = (expenses || []).map((e: any) => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    expenseDate: e.expense_date,
    paymentMethod: e.payment_method,
    description: e.description,
    branchId: e.branch_id,
    branchName: e.branches?.name || "Main Branch",
  }));

  // 5. Fetch Attendance
  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, check_in_date, check_in_time, branch_id, members(full_name), branches(name)")
    .order("check_in_date", { ascending: false })
    .limit(300);

  const formattedAttendance: ReportAttendance[] = (attendance || []).map((a: any) => ({
    id: a.id,
    checkInDate: a.check_in_date,
    checkInTime: a.check_in_time,
    memberName: a.members?.full_name || "Member",
    branchId: a.branch_id,
    branchName: a.branches?.name || "Main Branch",
  }));

  // 6. Fetch Memberships & calculate Dues
  const { data: rawMemberships } = await supabase
    .from("memberships")
    .select(
      "id, member_id, start_date, end_date, status, membership_plans(name, price), members(id, full_name, phone, branch_id, branches(name))"
    )
    .order("end_date", { ascending: false });

  const paymentSumByMembership = new Map<string, number>();
  (payments || []).forEach((p: any) => {
    if (p.membership_id) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + Number(p.amount)
      );
    }
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formattedMemberships: ReportMembership[] = (rawMemberships || []).map((m: any) => {
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
