import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { resolveBranchContext } from "@/lib/auth/branch-context";
import { getTodayIST, getISTDateString, isMembershipValidForAttendance } from "@/lib/utils";
import {
  StaffCheckInClient,
  AttendanceMember,
  LiveCheckInItem,
  AttendanceKPIs,
} from "@/components/attendance/staff-checkin-client";

interface AttendancePageProps {
  params: Promise<{ gymId: string }>;
  searchParams?: Promise<{ branchId?: string; date?: string }>;
}

export default async function AttendancePage({ params, searchParams }: AttendancePageProps) {
  const [{ gymId }, resolvedSearchParams, cookieStore, authContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve({} as { branchId?: string; date?: string }),
    cookies(),
    params.then(({ gymId: id }) => getAuthorizedActionContext({ gymId: id, capability: "attendance:record" })),
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

  const gymTimezone = "Asia/Kolkata";
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: gymTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const selectedDateStr =
    resolvedSearchParams.date && dateRegex.test(resolvedSearchParams.date)
      ? resolvedSearchParams.date
      : todayStr;

  // Compute yesterday and 14 days ago using pure calendar math (zero timezone drift)
  const [sy, sm, sd] = selectedDateStr.split("-").map(Number);
  const yesterdayDate = new Date(Date.UTC(sy, sm - 1, sd - 1));
  const yesterdayDateStr = yesterdayDate.toISOString().slice(0, 10);

  const fourteenDaysAgoDate = new Date(Date.UTC(sy, sm - 1, sd - 14));
  const fourteenDaysAgoStr = fourteenDaysAgoDate.toISOString().slice(0, 10);

  // 1. Members query across gym branches
  let membersQuery = supabase
    .from("members")
    .select("id, full_name, phone, branch_id, status, branches(name)")
    .order("full_name");

  if (branchContext.selectedBranchId) {
    membersQuery = membersQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    membersQuery = membersQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 2. Selected date attendance query
  let attendanceQuery = supabase
    .from("attendance")
    .select("id, branch_id, member_id, check_in_date, check_in_time, check_in_method, verified_by, branches(name)")
    .eq("check_in_date", selectedDateStr)
    .order("check_in_time", { ascending: false });

  if (branchContext.selectedBranchId) {
    attendanceQuery = attendanceQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    attendanceQuery = attendanceQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 3. Yesterday's attendance count query for delta calculation
  let yesterdayQuery = supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("check_in_date", yesterdayDateStr);

  if (branchContext.selectedBranchId) {
    yesterdayQuery = yesterdayQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    yesterdayQuery = yesterdayQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 4. Frequent regulars: attendance in last 14 days
  let recentAttendanceQuery = supabase
    .from("attendance")
    .select("member_id")
    .gte("check_in_date", fourteenDaysAgoStr);

  if (branchContext.selectedBranchId) {
    recentAttendanceQuery = recentAttendanceQuery.eq("branch_id", branchContext.selectedBranchId);
  } else if (branchContext.effectiveBranchIds.length > 0) {
    recentAttendanceQuery = recentAttendanceQuery.in("branch_id", branchContext.effectiveBranchIds);
  }

  // 5. Memberships query for active validation
  const membershipsQuery = supabase
    .from("memberships")
    .select("member_id, status, end_date, membership_plans(name)")
    .order("end_date", { ascending: false });

  // 6. Profiles query for staff names
  const profilesQuery = supabase
    .from("profiles")
    .select("id, full_name");

  // Execute all 6 queries concurrently
  const [
    membersRes,
    attendanceRes,
    yesterdayRes,
    recentRes,
    membershipsRes,
    profilesRes,
  ] = await Promise.all([
    membersQuery,
    attendanceQuery,
    yesterdayQuery,
    recentAttendanceQuery,
    membershipsQuery,
    profilesQuery,
  ]);

  const branchList = authContext.branches;
  const primaryBranch =
    branchList.find((b) => b.id === branchContext.selectedBranchId) || branchList[0];
  const branchId = primaryBranch?.id || "";

  const members = membersRes.data || [];
  const attendanceList = attendanceRes.data || [];
  const memberships = membershipsRes.data || [];
  const profiles = profilesRes.data || [];
  const recentAttendance = recentRes.data || [];

  // Staff profile map
  const staffMap = new Map<string, string>();
  profiles.forEach((p) => {
    staffMap.set(p.id, p.full_name);
  });

  // Latest membership per member
  const membershipMap = new Map<
    string,
    { status: string; end_date: string; membership_plans?: { name?: string } | null }
  >();
  memberships.forEach((m) => {
    if (!membershipMap.has(m.member_id)) {
      membershipMap.set(
        m.member_id,
        m as unknown as { status: string; end_date: string; membership_plans?: { name?: string } | null }
      );
    }
  });

  // Member basic lookup map
  const memberMap = new Map<string, { fullName: string; phone: string; branchName?: string }>();
  members.forEach((m) => {
    const branchInfo = m.branches as unknown as { name?: string } | null;
    memberMap.set(m.id, {
      fullName: m.full_name,
      phone: m.phone,
      branchName: branchInfo?.name || "Main Branch",
    });
  });

  // Attendance lookup for selected date
  const checkedInMap = new Map<string, { time: string; attendanceId: string }>();
  attendanceList.forEach((a) => {
    checkedInMap.set(a.member_id, { time: a.check_in_time, attendanceId: a.id });
  });

  // Frequency map from last 14 days
  const frequencyMap = new Map<string, number>();
  recentAttendance.forEach((r) => {
    frequencyMap.set(r.member_id, (frequencyMap.get(r.member_id) || 0) + 1);
  });

  // Construct Live Check-ins list
  const liveCheckIns: LiveCheckInItem[] = attendanceList.map((a) => {
    const memData = memberMap.get(a.member_id);
    const membership = membershipMap.get(a.member_id);
    const validation = isMembershipValidForAttendance(membership, selectedDateStr);
    const isOverride = !validation.isValid;
    const staffName = a.verified_by ? staffMap.get(a.verified_by) || "Staff" : "Reception Desk";
    const branchInfo = a.branches as unknown as { name?: string } | null;

    return {
      id: a.id,
      memberId: a.member_id,
      memberName: memData?.fullName || "Gym Member",
      memberPhone: memData?.phone || "",
      checkInTime: a.check_in_time,
      checkInMethod: (a.check_in_method || "staff_manual") as
        | "staff_manual"
        | "member_portal"
        | "kiosk_qr"
        | "biometric",
      isOverride,
      verifiedBy: a.verified_by,
      verifiedByName: a.check_in_method === "member_portal" ? "Member Self-Scan" : staffName,
      branchName: branchInfo?.name || memData?.branchName || "Main Branch",
    };
  });

  // Construct Formatted Members
  const formattedMembers: AttendanceMember[] = members.map((m) => {
    const mem = membershipMap.get(m.id);
    let daysLeft: number | undefined;

    if (mem && mem.end_date) {
      const targetDate = new Date(selectedDateStr + "T00:00:00+05:30");
      const expDate = new Date(mem.end_date + "T00:00:00+05:30");
      const diffTime = expDate.getTime() - targetDate.getTime();
      daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    const validation = isMembershipValidForAttendance(mem, selectedDateStr);
    const branchInfo = m.branches as unknown as { name?: string } | null;
    const checkedInInfo = checkedInMap.get(m.id);

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
      checkedInToday: !!checkedInInfo,
      checkInTime: checkedInInfo?.time,
      attendanceId: checkedInInfo?.attendanceId,
      frequency: frequencyMap.get(m.id) || 0,
    };
  });

  // Calculate Last Hour check-ins
  const nowMs = Date.now();
  const oneHourAgoMs = nowMs - 60 * 60 * 1000;
  const isViewingToday = selectedDateStr === todayStr;

  const lastHourCount = isViewingToday
    ? liveCheckIns.filter((item) => new Date(item.checkInTime).getTime() >= oneHourAgoMs).length
    : 0;

  const overrideCount = liveCheckIns.filter((item) => item.isOverride).length;
  const yesterdayCount = yesterdayRes.count || 0;

  const initialKpis: AttendanceKPIs = {
    totalCheckIns: liveCheckIns.length,
    yesterdayCount,
    lastHourCount,
    overrideCount,
  };

  const canOverride = ["owner", "partner", "manager"].includes(authContext.role);
  const rawMetaName = authContext.user.user_metadata?.full_name;
  const metadataName =
    typeof rawMetaName === "string" && rawMetaName.trim().length > 0
      ? rawMetaName.trim()
      : null;
  const profileName =
    typeof authContext.profile?.full_name === "string" && authContext.profile.full_name.trim().length > 0
      ? authContext.profile.full_name.trim()
      : null;
  const currentUserName: string = metadataName || profileName || "Staff";

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-foreground">
      <StaffCheckInClient
        gymId={gymId}
        branchId={branchId}
        branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
        initialMembers={formattedMembers}
        initialLiveCheckIns={liveCheckIns}
        initialKpis={initialKpis}
        canOverride={canOverride}
        userRole={authContext.role}
        currentUserName={currentUserName}
        selectedDate={selectedDateStr}
        todayDate={todayStr}
      />
    </div>
  );
}
