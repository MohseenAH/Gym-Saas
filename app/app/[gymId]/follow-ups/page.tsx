import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { getTodayIST } from "@/lib/utils";
import { FollowUpsClient, FollowUpMember } from "@/components/follow-ups/follow-ups-client";

interface FollowUpsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d} ${months[m - 1]}`;
}

export default async function FollowUpsPage({ params, searchParams }: FollowUpsPageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { branchId?: string }),
    cookies(),
    params.then(({ gymId: id }) =>
      getAuthorizedActionContext({ gymId: id, capability: "members:view" })
    ),
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

  // Prepare members query with branch filtering
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, email, status, branch_id, branches(id, name)")
    .order("full_name");

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Active / Expired memberships query with branch filtering
  let membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, member_id, plan_id, start_date, end_date, status, notes, created_at, membership_plans(id, name, price, duration_days)"
    )
    .in("status", ["active", "expired"]);

  // Active plans list query with gym/branch scoping
  let plansQuery = supabase
    .from("membership_plans")
    .select("id, name, price, duration_days, branches!inner(gym_id)")
    .eq("branches.gym_id", gymId)
    .eq("is_active", true);

  // Payments query
  let paymentsQuery = supabase
    .from("payments")
    .select("id, member_id, membership_id, amount, payment_status, payment_date")
    .eq("gym_id", gymId)
    .in("payment_status", ["paid", "partial"]);

  if (branchContext.selectedBranchId) {
    membershipsQuery = membershipsQuery.eq("branch_id", branchContext.selectedBranchId);
    plansQuery = plansQuery.eq("branch_id", branchContext.selectedBranchId);
    paymentsQuery = paymentsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membershipsQuery = membershipsQuery.in("branch_id", branchContext.effectiveBranchIds);
    plansQuery = plansQuery.in("branch_id", branchContext.effectiveBranchIds);
    paymentsQuery = paymentsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Fetch active/expired memberships, members, plans, and payments for the gym/branch in parallel
  const [membershipsRes, membersRes, plansRes, paymentsRes] = await Promise.all([
    membershipsQuery,
    membersQuery,
    plansQuery,
    paymentsQuery,
  ]);

  const rawMembers = membersRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const rawPlans = plansRes.data || [];
  const rawPayments = paymentsRes.data || [];

  const todayStr = getTodayIST();
  const todayDate = new Date(todayStr + "T00:00:00+05:30");
  const currentMonthStart = todayStr.slice(0, 7) + "-01";

  // Map payments by membership and by member
  const paymentSumByMembership = new Map<string, number>();
  const paymentSumByMember = new Map<string, number>();

  rawPayments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (p.membership_id) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + amt
      );
    }
    if (p.member_id) {
      paymentSumByMember.set(
        p.member_id,
        (paymentSumByMember.get(p.member_id) || 0) + amt
      );
    }
  });

  // Calculate total dues recovered this month
  const recoveredThisMonth = rawPayments
    .filter((p) => p.payment_date >= currentMonthStart && p.payment_date <= todayStr)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Tenant / branch filtered members
  const membersMap = new Map(rawMembers.map((m) => [m.id, m]));

  interface MembershipRow {
    id: string;
    member_id: string;
    plan_id: string;
    start_date: string;
    end_date: string;
    status: string;
    notes?: string | null;
    created_at: string;
    membership_plans?: {
      id?: string;
      name?: string;
      price?: number;
      duration_days?: number;
    } | null;
  }

  // Group memberships by member_id
  const membershipsByMember = new Map<string, MembershipRow[]>();
  (rawMemberships as unknown as MembershipRow[]).forEach((m) => {
    if (!membersMap.has(m.member_id)) return;
    const list = membershipsByMember.get(m.member_id) || [];
    list.push(m);
    membershipsByMember.set(m.member_id, list);
  });

  const followUpMembers: FollowUpMember[] = [];

  rawMembers.forEach((member) => {
    const memberMemberships = membershipsByMember.get(member.id);
    if (!memberMemberships || memberMemberships.length === 0) {
      return;
    }

    // Pick most relevant membership: sort active first, then end_date descending
    const sortedMemberships = [...memberMemberships].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return b.end_date.localeCompare(a.end_date);
    });

    const m = sortedMemberships[0];
    const planName = m.membership_plans?.name || "Standard Plan";
    const planPrice = Number(m.membership_plans?.price || 0);

    const paidForMembership =
      paymentSumByMembership.get(m.id) ?? (paymentSumByMember.get(m.member_id) ?? 0);
    const unpaidBalance = Math.max(0, planPrice - paidForMembership);

    const endDate = m.end_date;
    const startDate = m.start_date;

    const endDateObj = new Date(endDate + "T00:00:00+05:30");
    const diffDays = Math.round(
      (endDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const startDateObj = new Date(startDate + "T00:00:00+05:30");
    const daysSinceStart = Math.round(
      (todayDate.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    let dueAmount = 0;
    let isOverdue = false;
    let isDueSoon = false;
    let isUpcoming = false;
    let daysOverdue = 0;
    let daysUntilDue = 0;
    let dueDate = endDate;

    if (unpaidBalance > 0) {
      dueAmount = unpaidBalance;
      if (diffDays < 0) {
        // Expired with unpaid balance
        isOverdue = true;
        daysOverdue = Math.abs(diffDays);
        dueDate = endDate;
      } else if (daysSinceStart > 0) {
        // Active plan, but joined in past and still has partial unpaid balance
        isOverdue = true;
        daysOverdue = daysSinceStart;
        dueDate = startDate;
      } else if (diffDays <= 7) {
        isDueSoon = true;
        daysUntilDue = Math.max(0, diffDays);
        dueDate = endDate;
      } else {
        isUpcoming = true;
        daysUntilDue = diffDays;
        dueDate = endDate;
      }
    } else {
      // Fully paid for current term. Renewal fee due on/near expiry
      dueAmount = planPrice;
      if (diffDays < 0) {
        isOverdue = true;
        daysOverdue = Math.abs(diffDays);
        dueDate = endDate;
      } else if (diffDays <= 7) {
        isDueSoon = true;
        daysUntilDue = diffDays;
        dueDate = endDate;
      } else {
        isUpcoming = true;
        daysUntilDue = diffDays;
        dueDate = endDate;
      }
    }

    if (dueAmount <= 0) return;

    const branchName =
      (member.branches as unknown as { name?: string })?.name || "Main Branch";

    const memberCode = `#${member.id.slice(0, 4).toUpperCase()}`;

    followUpMembers.push({
      id: member.id,
      memberId: member.id,
      membershipId: m.id,
      code: memberCode,
      fullName: member.full_name,
      phone: member.phone || "",
      email: member.email || null,
      branchId: member.branch_id,
      branchName,
      planId: m.plan_id,
      planName,
      planPrice,
      totalPaid: unpaidBalance > 0 ? paidForMembership : planPrice,
      dueAmount,
      dueDate,
      formattedDueDate: formatShortDate(dueDate),
      daysDiff: diffDays,
      daysOverdue,
      daysUntilDue,
      isOverdue,
      isDueSoon,
      isUpcoming,
      membershipStatus: m.status,
    });
  });

  // Calculate overview metrics
  const overdueMembers = followUpMembers.filter((m) => m.isOverdue);
  const overdueTotal = overdueMembers.reduce((sum, m) => sum + m.dueAmount, 0);
  const overdueCount = overdueMembers.length;

  const dueSoonMembers = followUpMembers.filter((m) => m.isDueSoon);
  const dueSoonTotal = dueSoonMembers.reduce((sum, m) => sum + m.dueAmount, 0);
  const dueSoonCount = dueSoonMembers.length;

  const upcomingMembers = followUpMembers.filter((m) => m.isUpcoming);
  const upcomingTotal = upcomingMembers.reduce((sum, m) => sum + m.dueAmount, 0);
  const upcomingCount = upcomingMembers.length;

  const totalOutstanding = overdueTotal + dueSoonTotal;

  const monthlyTarget = Math.max(50000, Math.round(recoveredThisMonth + totalOutstanding));

  // Serialize active plans for dropdown
  const serializedPlans = rawPlans.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price) || 0,
  }));

  // Serialize branches
  const branches = authContext.branches.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  // All gym members for RecordPaymentModal selector
  const allMembersForPayment = rawMembers.map((m) => ({
    id: m.id,
    fullName: m.full_name,
    phone: m.phone || "",
    branchId: m.branch_id,
  }));

  return (
    <FollowUpsClient
      gymId={gymId}
      gymName={authContext.gym.name || "Gym"}
      members={followUpMembers}
      allMembersForPayment={allMembersForPayment}
      plans={serializedPlans}
      branches={branches}
      totalOutstanding={totalOutstanding}
      overdueTotal={overdueTotal}
      overdueCount={overdueCount}
      dueSoonTotal={dueSoonTotal}
      dueSoonCount={dueSoonCount}
      upcomingTotal={upcomingTotal}
      upcomingCount={upcomingCount}
      recoveredThisMonth={recoveredThisMonth}
      monthlyTarget={monthlyTarget}
    />
  );
}
