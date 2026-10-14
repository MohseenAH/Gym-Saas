import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { MemberProfileClient } from "@/components/members/member-profile-client";

interface MemberDetailPageProps {
  params: Promise<{ gymId: string; memberId: string }>;
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { gymId, memberId } = await params;

  await getAuthorizedActionContext({
    gymId,
    capability: "members:view",
  });

  const supabase = await createClient();

  // Parallel fetch: member dossier, gym info, branches, plans, memberships, payments, and attendance
  const [
    memberRes,
    gymRes,
    branchesRes,
    plansRes,
    membershipsRes,
    paymentsRes,
    attendanceRes,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id, branch_id, user_id, full_name, phone, email, status, notes, created_at, branches(id, name)")
      .eq("id", memberId)
      .single(),
    supabase
      .from("gyms")
      .select("name")
      .eq("id", gymId)
      .single(),
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
      .from("memberships")
      .select("id, plan_id, start_date, end_date, status, notes, created_at, membership_plans(name, price, duration_days)")
      .eq("member_id", memberId)
      .order("start_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id, membership_id, amount, payment_method, payment_status, payment_date, notes, created_at")
      .eq("member_id", memberId)
      .order("payment_date", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, check_in_date, check_in_time, check_in_method, branches(name)")
      .eq("member_id", memberId)
      .order("check_in_date", { ascending: false })
      .order("check_in_time", { ascending: false })
      .limit(50),
  ]);

  const member = memberRes.data;
  if (memberRes.error || !member) {
    notFound();
  }

  const gym = gymRes.data;
  const branches = branchesRes.data || [];
  const plans = plansRes.data || [];
  const rawMemberships = membershipsRes.data || [];
  const rawPayments = paymentsRes.data || [];
  const rawAttendance = attendanceRes.data || [];

  interface RawMemberMembership {
    id: string;
    plan_id: string;
    start_date: string;
    end_date: string;
    status: string;
    notes?: string | null;
    created_at: string;
    membership_plans: { name: string; price: number; duration_days: number } | null;
  }

  const formattedMemberships = ((rawMemberships as unknown as RawMemberMembership[]) || []).map((m) => ({
    id: m.id,
    planName: m.membership_plans?.name || "Standard Membership",
    planPrice: Number(m.membership_plans?.price || 0),
    startDate: m.start_date,
    endDate: m.end_date,
    status: m.status,
    notes: m.notes,
    createdAt: m.created_at,
  }));

  // Find active membership
  const rawActive = formattedMemberships.find((m) => m.status === "active");
  let activeMembership = null;
  if (rawActive) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(rawActive.endDate);
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    activeMembership = {
      ...rawActive,
      daysLeft,
    };
  }

  interface RawMemberPayment {
    id: string;
    membership_id?: string | null;
    amount: number | string;
    payment_method: string;
    payment_status: string;
    payment_date: string;
    notes?: string | null;
  }

  const formattedPayments = ((rawPayments as unknown as RawMemberPayment[]) || []).map((p) => ({
    id: p.id,
    membershipId: p.membership_id,
    amount: Number(p.amount),
    paymentMethod: p.payment_method,
    paymentStatus: p.payment_status,
    paymentDate: p.payment_date,
    notes: p.notes,
  }));

  const totalPaid = formattedPayments.reduce((acc, curr) => acc + curr.amount, 0);

  // Calculate dues for active contract
  let outstandingDues = 0;
  if (activeMembership) {
    const paidForActive = formattedPayments
      .filter((p) => p.membershipId === activeMembership.id)
      .reduce((acc, curr) => acc + curr.amount, 0);
    outstandingDues = Math.max(0, activeMembership.planPrice - paidForActive);
  }

  interface RawMemberAttendance {
    id: string;
    check_in_date: string;
    check_in_time: string;
    check_in_method: string;
    branches?: { name?: string } | null;
  }

  const formattedAttendance = ((rawAttendance as unknown as RawMemberAttendance[]) || []).map((a) => ({
    id: a.id,
    checkInDate: a.check_in_date,
    checkInTime: a.check_in_time,
    checkInMethod: a.check_in_method,
    branchName: a.branches?.name,
  }));

  const memberBranch = member.branches as unknown as { name?: string } | null;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <MemberProfileClient
        gymId={gymId}
        gymName={gym?.name || "GymApra Fitness Club"}
        member={{
          id: member.id,
          fullName: member.full_name,
          phone: member.phone,
          email: member.email,
          branchId: member.branch_id,
          branchName: memberBranch?.name || "Main Branch",
          status: member.status,
          notes: member.notes,
          createdAt: member.created_at,
          userId: member.user_id,
        }}
        branches={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
        plans={(plans || []).map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          durationDays: p.duration_days,
        }))}
        activeMembership={activeMembership}
        memberships={formattedMemberships}
        payments={formattedPayments}
        attendance={formattedAttendance}
        totalPaid={totalPaid}
        outstandingDues={outstandingDues}
        totalWorkouts={formattedAttendance.length}
      />
    </div>
  );
}
