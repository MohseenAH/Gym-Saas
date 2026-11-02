import { createClient, getCachedUser } from "@/lib/supabase/server";
import { UserCheck, Dumbbell, Calendar, CreditCard, Bell, ArrowRight } from "lucide-react";
import Link from "next/link";
import { MemberCheckInButton } from "@/components/portal/member-checkin-button";
import { PayDuesModal } from "@/components/portal/pay-dues-modal";
import { getTodayIST } from "@/lib/utils";

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
      <div className="p-8 text-center text-xs text-muted-foreground font-medium">
        Member record not found. Please contact gym administration.
      </div>
    );
  }

  const branchData = member.branches as unknown as BranchRelation | null;
  const gymName = branchData?.gyms?.name || "Gym";
  const branchName = branchData?.name || "Main Branch";

  // Fetch today's check-in status, active membership, and active notices in parallel
  const today = getTodayIST();
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
      <div className="bg-card rounded-3xl border border-border shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl border border-primary/20 shrink-0">
            {member.full_name ? member.full_name[0].toUpperCase() : "M"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {member.full_name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {branchName} &bull; {member.phone}
            </p>
          </div>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
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
      <div className="bg-gradient-to-br from-card via-card to-primary/10 border border-border text-foreground rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-44 h-44 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="text-xs font-black tracking-wider uppercase text-muted-foreground">
              {gymName} Pass
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${
              membership
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {membership ? "Active Contract" : "Expired"}
          </span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Plan Name</div>
            <div className="text-2xl font-black tracking-tight text-foreground mt-0.5">
              {planName}
            </div>
            {membership && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span>Valid until: {membership.end_date}</span>
                <span>•</span>
                <span className="text-primary font-bold">{daysRemaining} days left</span>
              </div>
            )}
          </div>

          <div>
            <PayDuesModal
              gymId={gymId}
              branchId={member.branch_id}
              memberId={member.id}
              membershipId={membership?.id || null}
              gymName={gymName}
              planName={planName}
              amount={planPrice > 0 ? planPrice : 1500}
            />
          </div>
        </div>
      </div>

      {/* Gym Notice Board Announcements */}
      <div className="bg-card rounded-3xl border border-border shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Gym Notice Board</h2>
          </div>
          <Link
            href={`/portal/${gymId}/notices`}
            className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1 transition-opacity"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!notices || notices.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground font-medium">
            No notices posted right now. Have a great workout!
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border text-xs ${
                  n.priority === "urgent"
                    ? "bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 text-rose-500"
                    : n.priority === "important"
                    ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 text-amber-500"
                    : "bg-muted/30 border-border text-foreground"
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{n.title}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {new Date(n.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <Link
          href={`/portal/${gymId}/attendance`}
          className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs hover:border-primary/40 hover:bg-muted/20 transition-all flex items-center gap-2.5 sm:gap-3"
        >
          <div className="h-7 w-7 sm:h-9 sm:w-9 flex items-center justify-center shrink-0 bg-primary/10 text-primary rounded-xl sm:rounded-2xl shadow-2xs">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-foreground truncate">Attendance Log</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Workout streaks</div>
          </div>
        </Link>

        <Link
          href={`/portal/${gymId}/payments`}
          className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs hover:border-primary/40 hover:bg-muted/20 transition-all flex items-center gap-2.5 sm:gap-3"
        >
          <div className="h-7 w-7 sm:h-9 sm:w-9 flex items-center justify-center shrink-0 bg-primary/10 text-primary rounded-xl sm:rounded-2xl shadow-2xs">
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-foreground truncate">Receipts</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Invoices & dues</div>
          </div>
        </Link>
      </div>
    </div>
  );
}