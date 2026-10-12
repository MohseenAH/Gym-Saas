import { createClient } from "@/lib/supabase/server";
import { CalendarCheck, Flame, Clock, CheckCircle } from "lucide-react";
import { MemberCheckInButton } from "@/components/portal/member-checkin-button";

interface AttendancePageProps {
  params: Promise<{ gymId: string }>;
}

export default async function MemberAttendancePage({ params }: AttendancePageProps) {
  const { gymId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", user?.id)
    .single();

  if (!member) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Member profile not found.
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch today's check-in
  const { data: todayCheckIn } = await supabase
    .from("attendance")
    .select("id, check_in_time")
    .eq("member_id", member.id)
    .eq("check_in_date", today)
    .maybeSingle();

  // Fetch past attendance history
  const { data: history } = await supabase
    .from("attendance")
    .select("id, check_in_date, check_in_time, check_in_method")
    .eq("member_id", member.id)
    .order("check_in_date", { ascending: false });

  const allAttendance = history || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Workout Attendance</h1>
        <p className="text-xs text-slate-500 mt-1">
          Track your daily workout consistency and gym check-ins
        </p>
      </div>

      {/* 1-Tap Check In Widget */}
      <MemberCheckInButton
        gymId={gymId}
        memberId={member.id}
        initialCheckedIn={!!todayCheckIn}
        checkInTime={todayCheckIn?.check_in_time}
      />

      {/* Streak / Consistency Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{allAttendance.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Workouts Logged</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              {todayCheckIn ? "Checked In Today" : "Not Checked In Yet"}
            </div>
            <div className="text-xs text-slate-500 font-medium">Today&apos;s Status</div>
          </div>
        </div>
      </div>

      {/* Attendance History Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">Past Check-Ins</div>
          <div className="text-xs text-slate-400">{allAttendance.length} sessions</div>
        </div>

        <div className="divide-y divide-slate-100">
          {allAttendance.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No check-ins recorded yet. Tap &quot;1-Tap Check In Now&quot; above when you arrive!
            </div>
          ) : (
            allAttendance.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {new Date(a.check_in_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize">
                      Method: {a.check_in_method.replace("_", " ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {new Date(a.check_in_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
