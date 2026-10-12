"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Dumbbell, Sparkles } from "lucide-react";
import { memberSelfCheckInAction } from "@/lib/actions/attendance";

interface MemberCheckInButtonProps {
  gymId: string;
  memberId: string;
  initialCheckedIn: boolean;
  checkInTime?: string;
}

export function MemberCheckInButton({
  gymId,
  memberId,
  initialCheckedIn,
  checkInTime,
}: MemberCheckInButtonProps) {
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [time, setTime] = useState<string | undefined>(checkInTime);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCheckIn() {
    if (checkedIn || loading) return;

    setLoading(true);
    setMessage(null);

    const res = await memberSelfCheckInAction({
      gymId,
      memberId,
    });

    setLoading(false);
    if (!res.success) {
      setMessage(res.error || "Failed to check in");
    } else {
      setCheckedIn(true);
      setTime(res.checkInTime);
      setMessage(res.message || "Checked in successfully!");
    }
  }

  if (checkedIn) {
    return (
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 text-center shadow-xs">
        <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">You&apos;re Checked In for Today!</h4>
        <p className="text-xs text-emerald-700 font-medium mt-0.5">
          {time
            ? `Recorded at ${new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Workout Attendance Logged"}
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white text-emerald-800 rounded-lg text-[11px] font-semibold border border-emerald-100">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Keep crushing your goals!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 text-center shadow-xs">
      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
        <Dumbbell className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-900">Arrived at the Gym?</h4>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">
        Tap the button below to log your daily attendance
      </p>

      {message && (
        <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {message}
        </div>
      )}

      <button
        onClick={handleCheckIn}
        disabled={loading}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        <span>1-Tap Check In Now</span>
      </button>
    </div>
  );
}
