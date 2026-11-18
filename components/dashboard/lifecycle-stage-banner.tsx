"use client";

import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  FileSpreadsheet,
  IdCard,
  AlertTriangle,
  CalendarCheck,
  CreditCard,
  Users,
  Compass,
  Zap,
} from "lucide-react";
import { GymLifecycleStage } from "@/lib/utils";

interface LifecycleStageBannerProps {
  gymId: string;
  stage: GymLifecycleStage;
  plansCount: number;
  membersCount: number;
  unassignedCount: number;
  userRole?: string;
}

export function LifecycleStageBanner({
  gymId,
  stage,
  plansCount,
  membersCount,
  unassignedCount,
  userRole,
}: LifecycleStageBannerProps) {
  const isFrontDeskRole = userRole === "trainer" || userRole === "receptionist";

  return (
    <div className="space-y-3">
      {/* Pinned Kiosk Bar for Front Desk Roles (Trainer / Receptionist) */}
      {isFrontDeskRole && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-primary text-primary-foreground shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black tracking-tight">Front Desk Duty Mode</div>
              <div className="text-xs sm:text-sm opacity-90">Verify member check-ins & digital passes at entry</div>
            </div>
          </div>
          <Link
            href={`/app/${gymId}/attendance`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-xs hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
            <span>Launch Attendance Kiosk</span>
          </Link>
        </div>
      )}

      {/* STAGE 1: Compact Setup Checklist Strip */}
      {stage === "STAGE_1_SETUP" && (
        <div className="bg-card rounded-2xl border border-primary/20 shadow-xs p-3 sm:p-4 text-card-foreground">
          {/* Desktop: Single slim horizontal banner */}
          <div className="hidden md:flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-foreground text-sm tracking-tight">
                  Setup Checklist
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Setup Mode
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Step 1: Create Plans */}
              <Link
                href={`/app/${gymId}/memberships?tab=plans`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  plansCount > 0
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-muted/60 text-foreground border-border hover:bg-muted"
                }`}
              >
                {plansCount > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span>1. Create Plans</span>
                <span className="text-[10px] uppercase font-bold opacity-80">
                  {plansCount > 0 ? `(${plansCount} Active)` : "Pending"}
                </span>
              </Link>

              {/* Step 2: Add Members */}
              <Link
                href={`/app/${gymId}/members`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  membersCount > 0
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-muted/60 text-foreground border-border hover:bg-muted"
                }`}
              >
                {membersCount > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span>2. Add Members</span>
                <span className="text-[10px] uppercase font-bold opacity-80">
                  {membersCount > 0 ? `(${membersCount} Enrolled)` : "Pending"}
                </span>
              </Link>

              <Link
                href={`/app/${gymId}/getting-started`}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline ml-1"
              >
                <span>Guide</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Mobile: Compact stacked list container */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-foreground text-xs">15-Minute Gym Setup Checklist</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                Setup
              </span>
            </div>

            <div className="space-y-1.5">
              <Link
                href={`/app/${gymId}/memberships?tab=plans`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 text-xs transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-foreground">
                  {plansCount > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span>Step 1: Create Plans</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {plansCount > 0 ? "✓" : ">"}
                </span>
              </Link>

              <Link
                href={`/app/${gymId}/members`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 text-xs transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-foreground">
                  {membersCount > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span>Step 2: Add Members</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {membersCount > 0 ? "✓" : ">"}
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: High-Visibility Unassigned Members Operational Alert */}
      {stage === "STAGE_2_UNASSIGNED" && (
        <div className="bg-card rounded-2xl sm:rounded-3xl border border-amber-500/40 bg-amber-500/5 shadow-xs p-4 sm:p-5 text-card-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Action Required: {unassignedCount} Member{unassignedCount === 1 ? "" : "s"} Awaiting Plans
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 border border-amber-500/30">
                    Needs Assignment
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Imported members cannot check in or receive automated WhatsApp digital passes until assigned to an active membership plan.
                </p>
              </div>
            </div>

            <Link
              href={`/app/${gymId}/memberships?tab=unassigned`}
              className="h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all shrink-0 active:scale-[0.98] cursor-pointer"
            >
              <IdCard className="w-4 h-4" />
              <span>Assign Plans in Bulk</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* STAGE 3: Operational Habit Card (First Check-In Today) */}
      {stage === "STAGE_3_FIRST_CHECKIN" && (
        <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 text-card-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    Start Today&apos;s Front Desk
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Front Desk Ready
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Members and plans are ready. Open the Attendance Kiosk at reception to verify member check-ins for today.
                </p>
              </div>
            </div>

            <Link
              href={`/app/${gymId}/attendance`}
              className="h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 transition-all shrink-0 active:scale-[0.98] cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Launch Attendance Kiosk</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* STAGE 4: Established Gym — Clean 4-Button Quick Operations Bar */}
      {stage === "STAGE_4_ESTABLISHED" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Attendance Kiosk */}
          <Link
            href={`/app/${gymId}/attendance`}
            className="group p-3.5 sm:p-4 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-3 text-card-foreground cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Attendance Kiosk
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Daily check-ins</div>
            </div>
          </Link>

          {/* 2. Members & Quick Enroll */}
          <Link
            href={`/app/${gymId}/members`}
            className="group p-3.5 sm:p-4 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-3 text-card-foreground cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Member Roster
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Enroll & WhatsApp</div>
            </div>
          </Link>

          {/* 3. Record Payment */}
          <Link
            href={`/app/${gymId}/payments`}
            className="group p-3.5 sm:p-4 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-3 text-card-foreground cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Record Payment
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Fees & Dues</div>
            </div>
          </Link>

          {/* 4. Memberships & Renewals */}
          <Link
            href={`/app/${gymId}/memberships?tab=active`}
            className="group p-3.5 sm:p-4 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-3 text-card-foreground cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <IdCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Memberships
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate">Plans & Renewals</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
