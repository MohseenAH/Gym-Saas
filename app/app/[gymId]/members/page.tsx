import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { BulkImportModal } from "@/components/members/bulk-import-modal";
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
    .select("id, member_id, start_date, end_date, status, membership_plans(name, duration_days)")
    .eq("status", "active");

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
    plansQuery = plansQuery.eq("branch_id", branchContext.selectedBranchId);
    membershipsQuery = membershipsQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
    plansQuery = plansQuery.in("branch_id", branchContext.effectiveBranchIds);
    membershipsQuery = membershipsQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Fetch plans, invites, members, and memberships in parallel
  const [plansRes, invitesRes, membersRes, membershipsRes] =
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
    ]);

  const branches = authContext.branches;
  const plans = plansRes.data || [];
  const invites = invitesRes.data || [];

  const primaryBranch =
    branches.find((b) => b.id === branchContext.selectedBranchId) || branches[0];
  const branchId = primaryBranch?.id || "";

  const allMembers = membersRes.data || [];
  const memberships = membershipsRes.data || [];

  interface MembershipContract {
    id: string;
    member_id: string;
    end_date: string;
    membership_plans?: { name?: string } | null;
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

      if (isExpiringSoon) {
        expiringSoonCount++;
      }

      activePlan = {
        name: activeContract.membership_plans?.name || "Active Plan",
        endDate: activeContract.end_date,
        daysLeft,
        isExpired,
        isExpiringSoon,
      };
    }

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
      hasPendingInvite: inviteMap.has(m.id),
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-foreground">
      {/* 1. Top Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Members</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 tabular-nums">
              {allMembers.length} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Add individual members, import bulk rosters, and track plan health
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5 w-full sm:w-auto">
          <BulkImportModal
            gymId={gymId}
            branchId={branchId}
            branches={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
            triggerLabel="Import CSV"
            triggerClassName="h-11 min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-card/85 backdrop-blur-md hover:bg-muted text-foreground text-sm font-bold border border-border shadow-xs hover:shadow-sm transition-all cursor-pointer w-full sm:w-auto"
          />
          <QuickEnrollModal
            gymId={gymId}
            branchId={branchId}
            plans={(plans || []).map((p) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
              durationDays: p.duration_days,
            }))}
            triggerLabel="+ Add Member"
            triggerClassName="h-11 min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:opacity-95 active:scale-[0.99] text-primary-foreground text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer w-full sm:w-auto"
          />
        </div>
      </div>

      {/* 2. Interactive Filterable Members Table with 5-Stat Strip */}
      <MembersTableClient
        gymId={gymId}
        members={tableMembers}
        branches={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
