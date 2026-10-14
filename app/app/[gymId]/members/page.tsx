import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { MembersTableClient, MemberListItem } from "@/components/members/members-table-client";
import { Users, UserCheck, ShieldCheck, Clock } from "lucide-react";

interface MembersPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function MembersPage({ params, searchParams }: MembersPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "members:view",
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

  // Prepare members query with branch filtering
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, email, status, created_at, user_id, branches(name)")
    .order("created_at", { ascending: false });

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Fetch branches, plans, invites, members, and memberships in parallel
  const [branchesRes, plansRes, invitesRes, membersRes, membershipsRes] =
    await Promise.all([
      supabase
        .from("branches")
        .select("id, name")
        .eq("gym_id", gymId)
        .eq("is_active", true),
      supabase
        .from("membership_plans")
        .select("id, name, price, duration_days")
        .eq("is_active", true),
      supabase
        .from("invitations")
        .select("member_id, token_hash, status")
        .eq("gym_id", gymId)
        .eq("role", "member")
        .eq("status", "pending"),
      membersQuery,
      supabase
        .from("memberships")
        .select("id, member_id, start_date, end_date, status, membership_plans(name, duration_days)")
        .eq("status", "active"),
    ]);

  const branches = branchesRes.data || [];
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
      branchName: branch?.name || "Main Branch",
      activePlan,
      hasPendingInvite: inviteMap.has(m.id),
    };
  });

  const activeMembersCount = allMembers.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Member Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enroll new members, monitor expiring subscriptions, and access 360&deg; member records
          </p>
        </div>
        <QuickEnrollModal
          gymId={gymId}
          branchId={branchId}
          plans={(plans || []).map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            durationDays: p.duration_days,
          }))}
        />
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{allMembers.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Registered Members</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeMembersCount}</div>
            <div className="text-xs text-slate-500 font-medium">Active Subscriptions</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{expiringSoonCount}</div>
            <div className="text-xs text-slate-500 font-medium">Expiring Within 7 Days</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {allMembers.filter((m) => m.user_id).length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Portal Accounts Claimed</div>
          </div>
        </div>
      </div>

      {/* Interactive Filterable Members Table */}
      <MembersTableClient
        gymId={gymId}
        members={tableMembers}
        branches={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
