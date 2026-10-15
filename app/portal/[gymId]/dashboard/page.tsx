import { createClient, getCachedUser } from "@/lib/supabase/server";
import { UserCheck, Dumbbell, Calendar, CreditCard, Bell, ArrowRight } from "lucide-react";
import Link from "next/link";
import { MemberCheckInButton } from "@/components/portal/member-checkin-button";
import { PayDuesModal } from "@/components/portal/pay-dues-modal";

interface BranchRelation {
  name: string;
  gyms: { name: string } | null;
}

interface PlanRelation {
  name: string;
  price: number;
  duration_days: number;
}

interface PageProps {
  params: Promise<{ gymId: string }>;
}

export default async function MemberPortalDashboardPage({ params }: PageProps) {
  const { gymId } = await params;
  const user = await getCachedUser();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, email, status, branch_id, branches(name, gyms(name))")
    .eq("user_id", user?.id)
    .single();

  if (!member) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Member record not found. Please contact gym administration.
      </div>
    );
  }

  const branchData = member.branches as unknown as BranchRelation | null;
  const gymName = branchData?.gyms?.name || "Gym";
  const branchName = branchData?.name || "Main Branch";

  // Fetch today's check-in status, active membership, and active notices in parallel
  const today = new Date().toISOString().split("T")[0];
  const [todayCheckInRes, membershipRes, noticesRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, check_in_time")
      .eq("member_id", member.id)
      .eq("check_in_date", today)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, start_date, end_date, status, membership_plans(name, price, duration_days)")
      .eq("member_id", member.id)
      .eq("status", "active")
      .order("end_date", { ascending: false })
      .maybeSingle(),
    supabase
      .from("notices")
      .select("id, title, content, priority, published_at")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const todayCheckIn = todayCheckInRes.data;
  const membership = membershipRes.data;
  const notices = noticesRes.data;

  // Calculate days remaining
  let daysRemaining = 0;
  if (membership?.end_date) {
    const end = new Date(membership.end_date);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, diff);
  }

  const planData = membership?.membership_plans as unknown as PlanRelation | null;
  const planName = planData?.name || "No Active Plan";
  const planPrice = Number(planData?.price || 0);

  return (
    <div className="space-y-6">
      {/* Member Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl border border-emerald-100 shrink-0">
            {member.full_name ? member.full_name[0].toUpperCase() : "M"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {member.full_name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {branchName} &bull; {member.phone}
            </p>
          </div>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3.5 h-3.5" /> Active Member
          </span>
        </div>
      </div>

      {/* 1-Tap Attendance Check-In Widget */}
      <MemberCheckInButton
        gymId={gymId}
        memberId={member.id}
        initialCheckedIn={!!todayCheckIn}
        checkInTime={todayCheckIn?.check_in_time}
      />

      {/* Digital Membership Pass Card */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <Dumbbell className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
              {gymName} Pass
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
              membership ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" : "bg-white/10 text-slate-400"
            }`}
          >
            {membership ? "Active" : "Expired"}
          </span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400 uppercase font-medium">Plan Name</div>
            <div className="text-xl font-black tracking-tight text-white mt-0.5">
              {planName}
            </div>
            {membership && (
              <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                <span>Valid until: {membership.end_date}</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{daysRemaining} days left</span>
              </div>
            )}
          </div>

          <div>
            <PayDuesModal
              gymName={gymName}
              planName={planName}
              amount={planPrice > 0 ? planPrice : 1500}
            />
          </div>
        </div>
      </div>

      {/* Gym Notice Board Announcements */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Gym Notice Board</h2>
          </div>
          <Link
            href={`/portal/${gymId}/notices`}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!notices || notices.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No notices posted right now. Have a great workout!
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border text-xs ${
                  n.priority === "urgent"
                    ? "bg-red-50/40 border-red-200 text-red-900"
                    : n.priority === "important"
                    ? "bg-amber-50/40 border-amber-200 text-amber-900"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{n.title}</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {new Date(n.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href={`/portal/${gymId}/attendance`}
          className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/10 transition-all flex items-center gap-3"
        >
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Attendance Log</div>
            <div className="text-[11px] text-slate-400">View workout streaks</div>
          </div>
        </Link>

        <Link
          href={`/portal/${gymId}/payments`}
          className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/10 transition-all flex items-center gap-3"
        >
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Payment Receipts</div>
            <div className="text-[11px] text-slate-400">Invoices & dues status</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
