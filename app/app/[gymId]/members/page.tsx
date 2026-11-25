import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { Users } from "lucide-react";
import { MembersTableClient, MemberListItem } from "@/components/members/members-table-client";

interface MembersPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function MembersPage({ params, searchParams }: MembersPageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { branchId?: string }),
    cookies(),
    params.then(({ gymId: id }) => getAuthorizedActionContext({ gymId: id, capability: "members:view" })),
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

  // Prepare members, plans, and memberships queries with index-backed branch filtering
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, email, status, created_at, user_id, branch_id, branches(name)")
    .order("created_at", { ascending: false });

  let plansQuery = supabase
    .from("membership_plans")
    .select("id, name, price, duration_days, branches!inner(gym_id)")
    .eq("branches.gym_id", gymId)
    .eq("is_active", true);

  let membershipsQuery = supabase
    .from("memberships")
    .select("id, member_id, start_date, end_date, status, membership_plans(name, price, duration_days)")
    .eq("status", "active");

  let paymentsQuery = supabase
    .from("payments")
    .select("membership_id, amount, payment_status")
    .eq("gym_id", gymId);

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
    plansQuery = plansQuery.eq("branch_id", branchContext.selectedBranchId);
    membershipsQuery = membershipsQuery.eq("branch_id", branchContext.selectedBranchId);
    paymentsQuery = paymentsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
    plansQuery = plansQuery.in("branch_id", branchContext.effectiveBranchIds);
    membershipsQuery = membershipsQuery.in("branch_id", branchContext.effectiveBranchIds);
    paymentsQuery = paymentsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Fetch plans, invites, members, memberships, and payments in parallel
  const [plansRes, invitesRes, membersRes, membershipsRes, paymentsRes] =
    await Promise.all([
      plansQuery,
      supabase
        .from("invitations")
        .select("member_id, token_hash, status")
        .eq("gym_id", gymId)
        .eq("role", "member")
        .eq("status", "pending"),
      membersQuery,
      membershipsQuery,
      paymentsQuery,
    ]);

  const branches = authContext.branches;
  const plans = plansRes.data || [];
  const invites = invitesRes.data || [];

  const primaryBranch =
    branches.find((b) => b.id === branchContext.selectedBranchId) || branches[0];
  const branchId = primaryBranch?.id || "";

  const allMembers = membersRes.data || [];
  const memberships = membershipsRes.data || [];
  const allPayments = paymentsRes.data || [];

  const paidByMembership = new Map<string, number>();
  allPayments.forEach((p) => {
    if (
      p.membership_id &&
      (p.payment_status === "paid" || p.payment_status === "partial")
    ) {
      paidByMembership.set(
        p.membership_id,
        (paidByMembership.get(p.membership_id) || 0) + Number(p.amount || 0)
      );
    }
  });

  interface MembershipContract {
    id: string;
    member_id: string;
    end_date: string;
    membership_plans?: { name?: string; price?: number | string; duration_days?: number } | null;
  }

  const membershipMap = new Map<string, MembershipContract>();
  (memberships as unknown as MembershipContract[]).forEach((m) => {
    membershipMap.set(m.member_id, m);
  });

  interface MemberInvite {
    member_id?: string | null;
  }

  const inviteMap = new Map<string, MemberInvite>();
  (invites as unknown as MemberInvite[]).forEach((inv) => {
    if (inv.member_id) inviteMap.set(inv.member_id, inv);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let expiringSoonCount = 0;

  const tableMembers: MemberListItem[] = allMembers.map((m) => {
    const activeContract = membershipMap.get(m.id);
    let activePlan = null;

    if (activeContract) {
      const expDate = new Date(activeContract.end_date);
      const diffTime = expDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = daysLeft < 0;
      const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7;
      const planName = activeContract.membership_plans?.name || "Active Plan";
      const durationDays = Number(activeContract.membership_plans?.duration_days || 30);
      const isTrial =
        durationDays <= 14 || planName.toLowerCase().includes("trial");

      if (isExpiringSoon) {
        expiringSoonCount++;
      }

      activePlan = {
        name: planName,
        endDate: activeContract.end_date,
        daysLeft,
        isExpired,
        isExpiringSoon,
        isTrial,
      };
    }

    const planPrice = Number(activeContract?.membership_plans?.price || 0);
    const totalPaid = activeContract ? paidByMembership.get(activeContract.id) || 0 : 0;
    const outstandingDues = Math.max(0, Math.round((planPrice - totalPaid) * 100) / 100);

    const branch = m.branches as unknown as { name?: string } | null;

    return {
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      email: m.email,
      status: m.status as "active" | "inactive" | "suspended",
      createdAt: m.created_at,
      userId: m.user_id,
      branchId: (m as unknown as { branch_id?: string }).branch_id || branchId,
      branchName: branch?.name || "Main Branch",
      activePlan,
      outstandingDues,
      hasPendingInvite: inviteMap.has(m.id),
    };
  });

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto text-foreground">
      {/* 1. Simple Page Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          Members
        </h1>
      </div>

      {/* 2. Interactive Filterable Members View */}
      <MembersTableClient
        gymId={gymId}
        branchId={branchId}
        members={tableMembers}
        branches={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
        plans={(plans || []).map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          durationDays: p.duration_days,
        }))}
      />
    </div>
  );
}
