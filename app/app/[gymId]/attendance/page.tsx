import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { getTodayIST, isMembershipValidForAttendance } from "@/lib/utils";
import { StaffCheckInClient, AttendanceMember } from "@/components/attendance/staff-checkin-client";

interface AttendancePageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string }>;
}

export default async function AttendancePage({ params, searchParams }: AttendancePageProps) {
  const { gymId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "attendance:record",
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

  const todayStr = getTodayIST();

  // Prepare members query across gym branches
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, branch_id, status, branches(name)")
    .order("full_name");

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // Prepare today's check-ins query with branch filtering
  let attendanceQuery = supabase
    .from("attendance")
    .select("member_id, check_in_time")
    .eq("check_in_date", todayStr);

  if (branchContext.selectedBranchId) {
    attendanceQuery = attendanceQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    attendanceQuery = attendanceQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  const [membersRes, todayAttendanceRes, membershipsRes] = await Promise.all([
    membersQuery,
    attendanceQuery,
    supabase
      .from("memberships")
      .select("member_id, status, end_date, membership_plans(name)")
      .eq("status", "active")
      .order("end_date", { ascending: false }),
  ]);

  const branchList = authContext.branches;
  const primaryBranch =
    branchList.find((b) => b.id === branchContext.selectedBranchId) || branchList[0];
  const branchId = primaryBranch?.id || "";

  const members = membersRes.data || [];
  const todayAttendance = todayAttendanceRes.data || [];
  const memberships = membershipsRes.data || [];

  const membershipMap = new Map<string, { status: string; end_date: string; membership_plans?: { name?: string } | null }>();
  (memberships || []).forEach((m) => {
    if (!membershipMap.has(m.member_id)) {
      membershipMap.set(m.member_id, m as unknown as { status: string; end_date: string; membership_plans?: { name?: string } | null });
    }
  });

  const checkedInMap = new Map<string, string>();
  (todayAttendance || []).forEach((a) => {
    checkedInMap.set(a.member_id, a.check_in_time);
  });

  const formattedMembers: AttendanceMember[] = (members || []).map((m) => {
    const mem = membershipMap.get(m.id);
    let daysLeft: number | undefined;

    if (mem && mem.end_date) {
      const todayDate = new Date(todayStr + "T00:00:00+05:30");
      const expDate = new Date(mem.end_date + "T00:00:00+05:30");
      const diffTime = expDate.getTime() - todayDate.getTime();
      daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    const validation = isMembershipValidForAttendance(mem, todayStr);
    const branchInfo = m.branches as unknown as { name?: string } | null;

    return {
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      branchId: m.branch_id,
      branchName: branchInfo?.name || "Main Branch",
      status: m.status,
      hasActiveMembership: validation.isValid,
      planName: mem?.membership_plans?.name,
      planEndDate: mem?.end_date,
      daysLeft,
      isExpired: validation.isExpired,
      checkedInToday: checkedInMap.has(m.id),
      checkInTime: checkedInMap.get(m.id),
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Attendance & Front Desk Kiosk
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tap to record daily member workout check-ins with automatic plan validation
          </p>
        </div>
      </div>

      <StaffCheckInClient
        gymId={gymId}
        branchId={branchId}
        branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
        initialMembers={formattedMembers}
        todayCheckInCount={todayAttendance.length}
      />
    </div>
  );
}
