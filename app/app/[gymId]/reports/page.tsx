import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCachedGymAuthContext } from "@/lib/auth/guard";
import { hasCapability } from "@/lib/auth/capabilities";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import {
  ReportsOverviewClient,
  OverviewMember,
  OverviewMembership,
  OverviewAttendance,
} from "@/components/reports/reports-overview-client";

interface ReportsPageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // Financial route lockdown: Floor staff cannot view revenue or activity analytics
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

  // 1. Members Query (filtered by branch)
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, status, branch_id, created_at")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false });

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 2. Memberships Query
  let membershipsQuery = supabase
    .from("memberships")
    .select(
      "id, member_id, plan_id, start_date, end_date, status, created_at, membership_plans(name, price), members(branch_id)"
    )
    .eq("gym_id", gymId)
    .order("end_date", { ascending: false });

  // 3. Attendance Query
  let attendanceQuery = supabase
    .from("attendance")
    .select("id, member_id, branch_id, check_in_date, check_in_time, check_in_method")
    .eq("gym_id", gymId)
    .order("check_in_date", { ascending: false })
    .limit(5000);

  if (branchContext.selectedBranchId) {
    attendanceQuery = attendanceQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    attendanceQuery = attendanceQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  const [membersRes, membershipsRes, attendanceRes] = await Promise.all([
    membersQuery,
    membershipsQuery,
    attendanceQuery,
  ]);

  const rawMembers = membersRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const rawAttendance = attendanceRes.data || [];

  interface DbMember {
    id: string;
    full_name: string;
    phone?: string | null;
    status: string;
    branch_id: string;
    created_at: string;
  }

  interface DbMembership {
    id: string;
    member_id: string;
    plan_id?: string | null;
    start_date: string;
    end_date: string;
    status: string;
    created_at: string;
    membership_plans?: { name?: string; price?: number } | null;
    members?: { branch_id?: string } | null;
  }

  interface DbAttendance {
    id: string;
    member_id: string;
    branch_id: string;
    check_in_date: string;
    check_in_time?: string | null;
    check_in_method?: string | null;
  }

  const members: OverviewMember[] = ((rawMembers as unknown as DbMember[]) || []).map((m) => ({
    id: m.id,
    fullName: m.full_name || "Unknown Member",
    phone: m.phone || "",
    status: m.status || "inactive",
    branchId: m.branch_id,
    createdAt: m.created_at,
  }));

  // Filter memberships strictly by authorized branch context
  const filteredMemberships = ((rawMemberships as unknown as DbMembership[]) || []).filter((m) => {
    const memberBranchId = m.members?.branch_id;
    if (!memberBranchId) return true;
    return branchContext.selectedBranchId
      ? memberBranchId === branchContext.selectedBranchId
      : branchContext.effectiveBranchIds.includes(memberBranchId);
  });

  const memberships: OverviewMembership[] = filteredMemberships.map((m) => ({
    id: m.id,
    memberId: m.member_id,
    planId: m.plan_id,
    planName: m.membership_plans?.name || "Standard Plan",
    planPrice: Number(m.membership_plans?.price || 0),
    startDate: m.start_date,
    endDate: m.end_date,
    status: m.status,
    createdAt: m.created_at,
    branchId: m.members?.branch_id || "",
  }));

  const attendance: OverviewAttendance[] = ((rawAttendance as unknown as DbAttendance[]) || []).map((a) => ({
    id: a.id,
    memberId: a.member_id,
    branchId: a.branch_id,
    checkInDate: a.check_in_date,
    checkInTime: a.check_in_time,
    checkInMethod: a.check_in_method,
  }));

  const activeBranch = authContext.branches.find((b) => b.id === branchContext.selectedBranchId);
  const activeBranchName = activeBranch ? activeBranch.name : "All Branches";

  return (
    <div className="max-w-7xl mx-auto">
      <ReportsOverviewClient
        gymId={gymId}
        gymName={authContext.gym?.name || "GymApra Fitness Club"}
        activeBranchName={activeBranchName}
        members={members}
        memberships={memberships}
        attendance={attendance}
      />
    </div>
  );
}
