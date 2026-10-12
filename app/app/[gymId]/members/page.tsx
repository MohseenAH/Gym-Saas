import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { MembersTableClient, MemberListItem } from "@/components/members/members-table-client";
import { Users, UserCheck, ShieldCheck, Clock } from "lucide-react";

interface MembersPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { gymId } = await params;

  await getAuthorizedActionContext({
    gymId,
    capability: "members:view",
  });

  const supabase = await createClient();

  // Fetch branches
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true);

  const primaryBranch = branches?.[0];
  const branchId = primaryBranch?.id || "";

  // Fetch membership plans
  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, name, price, duration_days")
    .eq("is_active", true);

  // Fetch members
  const { data: members } = await supabase
    .from("members")
    .select("id, full_name, phone, email, status, created_at, user_id, branches(name)")
    .order("created_at", { ascending: false });

  const allMembers = members || [];

  // Fetch active memberships
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, member_id, start_date, end_date, status, membership_plans(name, duration_days)")
    .eq("status", "active");

  const membershipMap = new Map<string, any>();
  (memberships || []).forEach((m) => {
    membershipMap.set(m.member_id, m);
  });

  // Fetch pending invitations
  const { data: invites } = await supabase
    .from("invitations")
    .select("member_id, token_hash, status")
    .eq("gym_id", gymId)
    .eq("role", "member")
    .eq("status", "pending");

  const inviteMap = new Map<string, any>();
  (invites || []).forEach((inv) => {
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
        name: (activeContract.membership_plans as any)?.name || "Active Plan",
        endDate: activeContract.end_date,
        daysLeft,
        isExpired,
        isExpiringSoon,
      };
    }

    return {
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      email: m.email,
      status: m.status as any,
      createdAt: m.created_at,
      userId: m.user_id,
      branchName: (m.branches as any)?.name || "Main Branch",
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
