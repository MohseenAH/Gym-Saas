import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import {
  MembershipsClient,
  MembershipItem,
} from "@/components/memberships/memberships-client";
import { MembershipPlanOption } from "@/components/members/renew-membership-modal";
import { PlanDetailItem } from "@/components/memberships/plans-manager-client";
import { AssignableMember } from "@/components/memberships/assign-membership-modal";

interface MembershipsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string; tab?: string }>;
}

export default async function MembershipsPage({
  params,
  searchParams,
}: MembershipsPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // Server-side authorization check
  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "members:view",
  });

  const canManagePlans = hasCapability(authContext.role, "plans:manage");
  const canManageMembers = hasCapability(authContext.role, "members:manage");

  // Resolve branch context from searchParams or persistent cookie
  const cookieStore = await cookies();
  const cookieBranch = cookieStore.get(`gymapra_branch_${gymId}`)?.value;
  const requestedBranchId =
    resolvedSearchParams.branchId !== undefined
      ? resolvedSearchParams.branchId
      : cookieBranch;

  const branchContext = resolveBranchContext({
    role: authContext.role,
    authorizedBranchIds: authContext.branchIds,
    requestedBranchId,
  });

  const supabase = await createClient();

  // 1. Fetch membership plans, payments, members, and memberships in parallel
  const [plansRes, paymentsRes, membersRes, membershipsRes] =
    await Promise.all([
      supabase
        .from("membership_plans")
        .select(
          "id, name, description, price, duration_days, is_active, branch_id, created_at, branches!inner(id, name, gym_id)"
        )
        .eq("branches.gym_id", gymId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, membership_id, amount, payment_status, branch_id")
        .eq("gym_id", gymId),
      supabase
        .from("members")
        .select("id, full_name, phone, branch_id, branches(name)")
        .eq("status", "active")
        .order("full_name", { ascending: true }),
      supabase
        .from("memberships")
        .select(
          "id, member_id, plan_id, start_date, end_date, status, notes, membership_plans(id, name, price, duration_days), members(id, full_name, phone, email, branch_id, branches(name))"
        )
        .order("end_date", { ascending: false }),
    ]);

  const branches = authContext.branches;
  const rawPlans = (plansRes.data || []) as unknown as Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number | string;
    duration_days: number;
    is_active: boolean;
    branch_id: string;
    created_at: string;
    branches?: { id: string; name: string } | null;
  }>;
  const rawPayments = paymentsRes.data || [];
  const rawMembers = (membersRes.data || []) as unknown as Array<{
    id: string;
    full_name: string;
    phone: string;
    branch_id: string;
    branches?: { name?: string } | null;
  }>;

  const selectedBranch = branches.find(
    (b) => b.id === branchContext.selectedBranchId
  );
  const branchName = selectedBranch ? selectedBranch.name : undefined;

  // 2. Compute payments per membership
  const paymentsByMembership = new Map<string, number>();
  rawPayments.forEach((p) => {
    if (
      p.membership_id &&
      (p.payment_status === "paid" || p.payment_status === "partial")
    ) {
      const current = paymentsByMembership.get(p.membership_id) || 0;
      paymentsByMembership.set(p.membership_id, current + Number(p.amount));
    }
  });

  // 3. Format and apply branch filtering to memberships
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  interface RawPlanItem {
    id: string;
    name: string;
    price: number | string;
    duration_days: number;
  }

  interface RawMemberItem {
    id: string;
    full_name: string;
    phone: string;
    email?: string | null;
    branch_id: string;
    branches?: { name?: string } | null;
  }

  interface RawMembershipRow {
    id: string;
    member_id: string;
    plan_id: string;
    start_date: string;
    end_date: string;
    status: "active" | "expired" | "frozen" | "cancelled";
    notes?: string | null;
    membership_plans: RawPlanItem | null;
    members: RawMemberItem | null;
  }

  const membershipRows = (membershipsRes.data || []) as unknown as RawMembershipRow[];

  // Plan subscriber & usage counters
  const planUsageCounts = new Map<string, number>();
  const planActiveSubscribers = new Map<string, number>();

  const formattedMemberships: MembershipItem[] = [];

  membershipRows.forEach((m) => {
    // Increment plan usage counters
    if (m.plan_id) {
      const currentTotal = planUsageCounts.get(m.plan_id) || 0;
      planUsageCounts.set(m.plan_id, currentTotal + 1);

      if (m.status === "active") {
        const currentActive = planActiveSubscribers.get(m.plan_id) || 0;
        planActiveSubscribers.set(m.plan_id, currentActive + 1);
      }
    }

    const member = m.members;
    if (!member) return;

    // Strict tenant & branch authorization filtering
    if (branchContext.selectedBranchId) {
      if (member.branch_id !== branchContext.selectedBranchId) return;
    } else if (branchContext.effectiveBranchIds.length > 0) {
      if (!branchContext.effectiveBranchIds.includes(member.branch_id)) return;
    }

    const plan = m.membership_plans;
    const planPrice = Number(plan?.price || 0);
    const paidAmount = paymentsByMembership.get(m.id) || 0;
    const dueAmount = Math.max(0, planPrice - paidAmount);

    const expDate = new Date(m.end_date);
    const diffTime = expDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpiringSoon =
      m.status === "active" && daysRemaining >= 0 && daysRemaining <= 7;

    formattedMemberships.push({
      id: m.id,
      memberId: m.member_id,
      memberName: member.full_name,
      memberPhone: member.phone,
      memberEmail: member.email,
      branchId: member.branch_id,
      branchName: member.branches?.name || "Main Branch",
      planId: plan?.id || "",
      planName: plan?.name || "Standard Plan",
      planPrice,
      durationDays: Number(plan?.duration_days || 30),
      startDate: m.start_date,
      endDate: m.end_date,
      status: m.status,
      daysRemaining,
      isExpiringSoon,
      totalPaid: Math.round(paidAmount * 100) / 100,
      totalDue: Math.round(dueAmount * 100) / 100,
      notes: m.notes,
    });
  });

  // 4. Format detailed plans for Plans Manager
  const detailedPlans: PlanDetailItem[] = rawPlans.map((p) => {
    return {
      id: p.id,
      branchId: p.branch_id,
      branchName: p.branches?.name || "Main Branch",
      name: p.name,
      description: p.description,
      durationDays: Number(p.duration_days),
      price: Number(p.price),
      isActive: p.is_active,
      usageCount: planUsageCounts.get(p.id) || 0,
      activeSubscribersCount: planActiveSubscribers.get(p.id) || 0,
      createdAt: p.created_at,
    };
  });

  // 5. Format available plans for Renew Membership modal (active only)
  const availablePlans: MembershipPlanOption[] = detailedPlans
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      durationDays: p.durationDays,
    }));

  // 6. Format members list for Assign Membership modal
  const filteredMembersList: AssignableMember[] = rawMembers
    .filter((m) => {
      if (branchContext.selectedBranchId) {
        return m.branch_id === branchContext.selectedBranchId;
      }
      if (branchContext.effectiveBranchIds.length > 0) {
        return branchContext.effectiveBranchIds.includes(m.branch_id);
      }
      return true;
    })
    .map((m) => ({
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      branchId: m.branch_id,
      branchName: m.branches?.name || "Main Branch",
    }));

  const initialTab = resolvedSearchParams.tab === "plans" ? "plans" : "contracts";

  return (
    <MembershipsClient
      gymId={gymId}
      memberships={formattedMemberships}
      plans={availablePlans}
      detailedPlans={detailedPlans}
      branches={branches}
      membersList={filteredMembersList}
      canManagePlans={canManagePlans}
      canManageMembers={canManageMembers}
      selectedBranchId={branchContext.selectedBranchId || undefined}
      branchName={branchName}
      initialTab={initialTab}
    />
  );
}
