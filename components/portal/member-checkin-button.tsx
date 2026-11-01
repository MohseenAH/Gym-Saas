"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Dumbbell, Sparkles, AlertCircle } from "lucide-react";
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
  const [isExpired, setIsExpired] = useState(false);
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
    if (res.alreadyCheckedIn) {
      setCheckedIn(true);
      if (res.checkInTime) setTime(res.checkInTime);
      setMessage(res.message || "You have already checked in today!");
    } else if (!res.success) {
      if (res.isExpired) {
        setIsExpired(true);
      }
      setMessage(res.error || "Failed to check in");
    } else {
      setCheckedIn(true);
      setTime(res.checkInTime);
      setMessage(res.message || "Checked in successfully!");
    }
  }

  if (checkedIn) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center shadow-xs">
        <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-foreground">You&apos;re Checked In for Today!</h4>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
          {time
            ? `Recorded at ${new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Workout Attendance Logged"}
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-card text-foreground rounded-full text-[11px] font-bold border border-border">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Keep crushing your goals!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-3xl p-6 text-center shadow-xs">
      <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
        <Dumbbell className="w-6 h-6" />
      </div>
      <h4 className="text-base font-bold text-foreground">Arrived at the Gym?</h4>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4">
        Tap the button below to log your daily attendance
      </p>

      {isExpired ? (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-2xl text-left">
          <p className="font-bold flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            Membership Expired or Inactive
          </p>
          <p className="text-muted-foreground">
            Your membership contract is no longer active. Please renew your plan or visit the front desk to restore check-in access.
          </p>
        </div>
      ) : message ? (
        <div className="mb-3 p-3 bg-destructive/10 text-destructive text-xs rounded-2xl border border-destructive/20 font-medium">
          {message}
        </div>
      ) : null}

      <button
        onClick={handleCheckIn}
        disabled={loading}
        className="w-full sm:w-auto h-12 inline-flex items-center justify-center gap-2 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-sm font-black shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
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