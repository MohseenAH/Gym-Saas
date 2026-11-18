"use client";

import { useState, useEffect } from "react";
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
  Check,
  ChevronRight,
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
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isFrontDeskRole = userRole === "trainer" || userRole === "receptionist";

  return (
    <div className="space-y-2.5">
      {/* Pinned Kiosk Bar for Front Desk Roles (Trainer / Receptionist) */}
      {isFrontDeskRole && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 sm:py-3 rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Front Desk Duty Mode</div>
              <div className="text-xs opacity-90">Verify member check-ins & digital passes at entry</div>
            </div>
          </div>
          <Link
            href={`/app/${gymId}/attendance`}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs rounded-xl bg-white text-slate-900 font-bold shadow-xs hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
            <span>Launch Attendance Kiosk</span>
          </Link>
        </div>
      )}

      {/* STAGE 1: Compact Setup Checklist Strip */}
      {stage === "STAGE_1_SETUP" && (() => {
        const completedSteps = (plansCount > 0 ? 1 : 0) + (membersCount > 0 ? 1 : 0);
        const progressPct = Math.round((completedSteps / 2) * 100);

        return (
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 rounded-2xl border border-emerald-500/25 shadow-xs px-4 py-2.5 sm:py-3 text-card-foreground">
            {/* Desktop Stepper Banner (hidden md:flex) */}
            <div className="hidden md:flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs sm:text-sm">
                      Gym Launch Checklist
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      Setup Mode
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-24 h-1.5 rounded-full bg-emerald-500/20 overflow-hidden" suppressHydrationWarning>
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" suppressHydrationWarning>
                      {completedSteps} of 2 complete ({progressPct}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href={`/app/${gymId}/memberships?tab=plans`}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    plansCount > 0
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  }`}
                >
                  {plansCount > 0 ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>1. Create Plans</span>
                </Link>

                <div className="w-6 h-px bg-emerald-500/30" />

                <Link
                  href={`/app/${gymId}/members`}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    membersCount > 0
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  }`}
                >
                  {membersCount > 0 ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>2. Add Members</span>
                </Link>
              </div>
            </div>

            {/* Mobile Stacked Checklist Container (visible on mobile, md:hidden) */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground text-xs sm:text-sm">
                    Gym Launch Checklist
                  </div>
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    {completedSteps} of 2 steps complete ({progressPct}%)
                  </div>
                </div>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  SETUP MODE
                </span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-emerald-500/20 overflow-hidden" suppressHydrationWarning>
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <Link
                  href={`/app/${gymId}/memberships?tab=plans`}
                  className={`p-2 rounded-xl flex items-center justify-between text-xs font-bold border transition-colors ${
                    plansCount > 0
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  <span>1. Create Plans</span>
                  {plansCount > 0 ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </Link>

                <Link
                  href={`/app/${gymId}/members`}
                  className={`p-2 rounded-xl flex items-center justify-between text-xs font-bold border transition-colors ${
                    membersCount > 0
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  <span>2. Add Members</span>
                  {membersCount > 0 ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </Link>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STAGE 2: High-Visibility Unassigned Members Operational Alert */}
      {stage === "STAGE_2_UNASSIGNED" && (
        <div className="bg-card rounded-2xl border border-amber-500/40 bg-amber-500/5 shadow-xs px-4 py-2.5 sm:py-3 text-card-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-foreground">
                    Action Required: {unassignedCount} Member{unassignedCount === 1 ? "" : "s"} Awaiting Plans
                  </h2>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 border border-amber-500/30">
                    Needs Assignment
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Imported members cannot check in or receive automated WhatsApp digital passes until assigned to an active membership plan.
                </p>
              </div>
            </div>

            <Link
              href={`/app/${gymId}/memberships?tab=unassigned`}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-xs transition-all shrink-0 active:scale-[0.98] cursor-pointer"
            >
              <IdCard className="w-3.5 h-3.5" />
              <span>Assign Plans in Bulk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* STAGE 3: Operational Habit Card (First Check-In Today) */}
      {stage === "STAGE_3_FIRST_CHECKIN" && (
        <div className="bg-card rounded-2xl border border-border shadow-xs px-4 py-2.5 sm:py-3 text-card-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-foreground">
                    Start Today&apos;s Front Desk
                  </h2>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Front Desk Ready
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Members and plans are ready. Open the Attendance Kiosk at reception to verify member check-ins for today.
                </p>
              </div>
            </div>

            <Link
              href={`/app/${gymId}/attendance`}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-xs transition-all shrink-0 active:scale-[0.98] cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Launch Attendance Kiosk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* STAGE 4: Established Gym — Clean 4-Button Quick Operations Bar */}
      {stage === "STAGE_4_ESTABLISHED" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 1. Attendance Kiosk */}
          <Link
            href={`/app/${gymId}/attendance`}
            className="group p-2.5 sm:p-3 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-2.5 text-card-foreground cursor-pointer"
          >
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Attendance Kiosk
              </div>
              <div className="text-[11px] text-muted-foreground truncate">Daily check-ins</div>
            </div>
          </Link>

          {/* 2. Members & Quick Enroll */}
          <Link
            href={`/app/${gymId}/members`}
            className="group p-2.5 sm:p-3 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-2.5 text-card-foreground cursor-pointer"
          >
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Member Roster
              </div>
              <div className="text-[11px] text-muted-foreground truncate">Enroll & WhatsApp</div>
            </div>
          </Link>

          {/* 3. Record Payment */}
          <Link
            href={`/app/${gymId}/payments`}
            className="group p-2.5 sm:p-3 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-2.5 text-card-foreground cursor-pointer"
          >
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Record Payment
              </div>
              <div className="text-[11px] text-muted-foreground truncate">Fees & Dues</div>
            </div>
          </Link>

          {/* 4. Memberships & Renewals */}
          <Link
            href={`/app/${gymId}/memberships?tab=active`}
            className="group p-2.5 sm:p-3 rounded-2xl bg-card hover:bg-muted/60 border border-border hover:border-primary/40 shadow-xs transition-all flex items-center gap-2.5 text-card-foreground cursor-pointer"
          >
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <IdCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Memberships
              </div>
              <div className="text-[11px] text-muted-foreground truncate">Plans & Renewals</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
