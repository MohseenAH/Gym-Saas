import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { getTodayIST } from "@/lib/utils";
import {
  FollowUpsClient,
  FollowUpMember,
} from "@/components/follow-ups/follow-ups-client";

interface FollowUpsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "-";
  const [, m, d] = dateStr.split("-").map(Number);
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

export default async function FollowUpsPage({
  params,
  searchParams,
}: FollowUpsPageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] =
    await Promise.all([
      params,
      searchParams
        ? searchParams
        : Promise.resolve({} as { branchId?: string }),
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

  // Confirmed payments query (only paid / partial reduce dues)
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

  // Map confirmed payments by membership_id
  const paymentSumByMembership = new Map<string, number>();
  rawPayments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (p.membership_id) {
      paymentSumByMembership.set(
        p.membership_id,
        (paymentSumByMembership.get(p.membership_id) || 0) + amt
      );
    }
  });

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

    // Most relevant contract: active first, then latest end_date
    const sortedMemberships = [...memberMemberships].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return b.end_date.localeCompare(a.end_date);
    });

    const m = sortedMemberships[0];
    const planName = m.membership_plans?.name || "Standard Plan";
    const planPrice = Number(m.membership_plans?.price || 0);
    const isTrial = planName.toLowerCase().includes("trial");

    const paidForMembership = paymentSumByMembership.get(m.id) || 0;
    const unpaidBalance = Math.max(
      0,
      Math.round((planPrice - paidForMembership) * 100) / 100
    );

    const endDate = m.end_date;
    const startDate = m.start_date;

    const endDateObj = new Date(endDate + "T00:00:00+05:30");
    const diffDays = Math.round(
      (endDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const startDateObj = new Date(startDate + "T00:00:00+05:30");
    const daysSinceStart = Math.max(
      0,
      Math.round(
        (todayDate.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const isActive = m.status === "active" && diffDays >= 0;

    // Non-mutually-exclusive approved categories (Section 6)
    const isExpiring = isActive && diffDays >= 0 && diffDays <= 7;
    const isPending = unpaidBalance > 0;
    const isOverdue = m.status === "expired" || diffDays < 0;
    const isTrialEnding = isActive && isTrial && diffDays >= 0 && diffDays <= 3;

    if (!isExpiring && !isPending && !isOverdue && !isTrialEnding) {
      return;
    }

    const daysOverdue =
      diffDays < 0 ? Math.abs(diffDays) : isPending ? daysSinceStart : 0;

    const branchName =
      (member.branches as unknown as { name?: string })?.name || "Main Branch";
    const memberCode = `#${member.id.slice(0, 8).toUpperCase()}`;

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
      totalPaid: paidForMembership,
      dueAmount: unpaidBalance,
      endDate,
      formattedEndDate: formatShortDate(endDate),
      startDate,
      formattedStartDate: formatShortDate(startDate),
      daysDiff: diffDays,
      daysOverdue,
      isExpiring,
      isPending,
      isOverdue,
      isTrialEnding,
      isTrial,
      membershipStatus: m.status,
    });
  });

  const serializedPlans = rawPlans.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price) || 0,
    durationDays: Number(p.duration_days) || 30,
  }));

  const branches = authContext.branches.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  const allMembersForPayment = rawMembers.map((m) => ({
    id: m.id,
    fullName: m.full_name,
    phone: m.phone || "",
    branchId: m.branch_id,
  }));

  const canRecordPayments = hasCapability(authContext.role, "payments:record");
  const canManageMembers = hasCapability(authContext.role, "members:manage");

  return (
    <div className="max-w-7xl mx-auto">
      <FollowUpsClient
        gymId={gymId}
        gymName={authContext.gym.name || "Gym"}
        todayStr={todayStr}
        members={followUpMembers}
        allMembersForPayment={allMembersForPayment}
        plans={serializedPlans}
        branches={branches}
        canRecordPayments={canRecordPayments}
        canManageMembers={canManageMembers}
      />
    </div>
  );
}
