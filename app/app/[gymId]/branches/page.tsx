import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { getTodayIST } from "@/lib/utils";
import {
  BranchManagerClient,
  BranchItem,
} from "@/components/branches/branch-manager-client";

interface PageProps {
  params: Promise<{ gymId: string }>;
}

export default async function BranchesPage({ params }: PageProps) {
  const [{ gymId }, cookieStore] = await Promise.all([params, cookies()]);
  const authContext = await getAuthorizedActionContext({ gymId });

  const supabase = await createClient();
  const branches = authContext.branches || [];
  const authorizedBranchIds = branches.map((b) => b.id);
  const canManageBranches = hasCapability(authContext.role, "branches:manage");
  const canViewFinancials = hasCapability(authContext.role, "financial:view");

  const todayStr = getTodayIST();
  const currentMonthPrefix = todayStr.slice(0, 7);

  // Scoped member query
  let membersQuery = supabase
    .from("members")
    .select("branch_id, status")
    .eq("gym_id", gymId);
  if (authorizedBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", authorizedBranchIds);
  }

  // Scoped staff query
  const staffQuery = supabase
    .from("gym_users")
    .select("id, role, status, profiles(full_name), user_branch_access(branch_id)")
    .eq("gym_id", gymId)
    .eq("status", "active");

  // Scoped payments query only when user has financial:view capability
  const paymentsPromise = canViewFinancials
    ? (() => {
        let q = supabase
          .from("payments")
          .select("branch_id, amount, payment_status, payment_date")
          .eq("gym_id", gymId);
        if (authorizedBranchIds.length > 0) {
          q = q.in("branch_id", authorizedBranchIds);
        }
        return q;
      })()
    : Promise.resolve({ data: [] as Array<{ branch_id: string; amount: number; payment_status: string; payment_date: string }> });

  const [membersRes, staffRes, paymentsRes] = await Promise.all([
    membersQuery,
    staffQuery,
    paymentsPromise,
  ]);

  const activeMemberCountByBranch = new Map<string, number>();
  const totalMemberCountByBranch = new Map<string, number>();
  (membersRes.data || []).forEach((m) => {
    if (!m.branch_id) return;
    totalMemberCountByBranch.set(
      m.branch_id,
      (totalMemberCountByBranch.get(m.branch_id) || 0) + 1
    );
    if (m.status === "active") {
      activeMemberCountByBranch.set(
        m.branch_id,
        (activeMemberCountByBranch.get(m.branch_id) || 0) + 1
      );
    }
  });

  // Compute staff count and assigned manager per branch
  interface StaffRow {
    id: string;
    role: string;
    profiles?: { full_name?: string | null } | null;
    user_branch_access?: Array<{ branch_id: string }> | null;
  }
  const staffCountByBranch = new Map<string, number>();
  const managerByBranch = new Map<string, string>();
  const rawStaff = (staffRes.data || []) as unknown as StaffRow[];

  rawStaff.forEach((s) => {
    const access = s.user_branch_access || [];
    const targetBranchIds =
      access.length > 0
        ? access.map((a) => a.branch_id)
        : s.role === "owner" || s.role === "partner" || s.role === "manager"
        ? authorizedBranchIds
        : [];

    targetBranchIds.forEach((bid) => {
      staffCountByBranch.set(bid, (staffCountByBranch.get(bid) || 0) + 1);
      if (
        !managerByBranch.has(bid) &&
        (s.role === "manager" || s.role === "owner" || s.role === "partner") &&
        s.profiles?.full_name
      ) {
        managerByBranch.set(bid, s.profiles.full_name);
      }
    });
  });

  // Compute financial stats per branch only if authorized
  const monthlyCollectionsByBranch = new Map<string, number>();
  const pendingVerificationsByBranch = new Map<string, number>();
  if (canViewFinancials) {
    (paymentsRes.data || []).forEach((p) => {
      if (!p.branch_id) return;
      if (
        (p.payment_status === "paid" || p.payment_status === "partial") &&
        p.payment_date?.startsWith(currentMonthPrefix)
      ) {
        monthlyCollectionsByBranch.set(
          p.branch_id,
          (monthlyCollectionsByBranch.get(p.branch_id) || 0) +
            Number(p.amount || 0)
        );
      } else if (p.payment_status === "pending") {
        pendingVerificationsByBranch.set(
          p.branch_id,
          (pendingVerificationsByBranch.get(p.branch_id) || 0) + 1
        );
      }
    });
  }

  const branchList: BranchItem[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    phone: b.phone,
    isActive: b.is_active,
    isMain: Boolean(b.is_main),
    memberCount: totalMemberCountByBranch.get(b.id) || 0,
    activeMemberCount: activeMemberCountByBranch.get(b.id) || 0,
    staffCount: staffCountByBranch.get(b.id) || 0,
    managerName: managerByBranch.get(b.id) || null,
    monthlyCollections: canViewFinancials
      ? Math.round((monthlyCollectionsByBranch.get(b.id) || 0) * 100) / 100
      : null,
    pendingVerificationsCount: canViewFinancials
      ? pendingVerificationsByBranch.get(b.id) || 0
      : 0,
  }));

  const currentBranchId =
    cookieStore.get(`gymapra_branch_${gymId}`)?.value || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <BranchManagerClient
        gymId={gymId}
        branches={branchList}
        currentBranchId={currentBranchId}
        canManageBranches={canManageBranches}
        canViewFinancials={canViewFinancials}
      />
    </div>
  );
}
