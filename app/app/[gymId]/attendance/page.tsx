import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { StaffCheckInClient, AttendanceMember } from "@/components/attendance/staff-checkin-client";

interface AttendancePageProps {
  params: Promise<{ gymId: string }>;
}

export default async function AttendancePage({ params }: AttendancePageProps) {
  const { gymId } = await params;

  await getAuthorizedActionContext({
    gymId,
    capability: "attendance:record",
  });

  const supabase = await createClient();

  // Fetch branches
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true);

  const branchList = branches || [];
  const primaryBranch = branchList[0];
  const branchId = primaryBranch?.id || "";

  const todayStr = new Date().toISOString().split("T")[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch members across gym branches
  const { data: members } = await supabase
    .from("members")
    .select("id, full_name, phone, branch_id, status, branches(name)")
    .order("full_name");

  // Fetch today's check-ins
  const { data: todayAttendance } = await supabase
    .from("attendance")
    .select("member_id, check_in_time")
    .eq("check_in_date", todayStr);

  const checkedInMap = new Map<string, string>();
  (todayAttendance || []).forEach((a) => {
    checkedInMap.set(a.member_id, a.check_in_time);
  });

  // Fetch memberships to compute plan name and validity
  const { data: memberships } = await supabase
    .from("memberships")
    .select("member_id, status, end_date, membership_plans(name)")
    .eq("status", "active");

  const membershipMap = new Map<string, any>();
  (memberships || []).forEach((m) => {
    membershipMap.set(m.member_id, m);
  });

  const formattedMembers: AttendanceMember[] = (members || []).map((m) => {
    const mem = membershipMap.get(m.id);
    let daysLeft: number | undefined;
    let isExpired = false;

    if (mem && mem.end_date) {
      const expDate = new Date(mem.end_date);
      const diffTime = expDate.getTime() - today.getTime();
      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isExpired = daysLeft < 0;
    }

    return {
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      branchId: m.branch_id,
      branchName: (m.branches as any)?.name || "Main Branch",
      status: m.status,
      hasActiveMembership: !!mem,
      planName: mem ? (mem.membership_plans as any)?.name || "Active Plan" : undefined,
      planEndDate: mem?.end_date,
      daysLeft,
      isExpired,
      checkedInToday: checkedInMap.has(m.id),
      checkInTime: checkedInMap.get(m.id),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Front-Desk Attendance Kiosk</h1>
        <p className="text-xs text-slate-500 mt-1">
          Rapid 1-tap check-in, real-time membership validation, and front-desk roster
        </p>
      </div>

      <StaffCheckInClient
        gymId={gymId}
        branchId={branchId}
        branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
        initialMembers={formattedMembers}
        todayCheckInCount={checkedInMap.size}
      />
    </div>
  );
}
