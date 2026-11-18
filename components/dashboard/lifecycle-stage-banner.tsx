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
        <div className="bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/20 shadow-2xs text-card-foreground">
          {/* Desktop Stepper Banner (hidden md:flex) */}
          <div className="hidden md:flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-foreground text-sm sm:text-base">
                Setup Checklist
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                Setup Mode
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/app/${gymId}/memberships?tab=plans`}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {plansCount > 0 ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/60 shrink-0" />
                )}
                <span>1. Create Plans</span>
              </Link>

              <div className="w-16 sm:w-20 h-px bg-border" />

              <Link
                href={`/app/${gymId}/members`}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {membersCount > 0 ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/60 shrink-0" />
                )}
                <span>2. Add Members</span>
              </Link>
            </div>
          </div>

          {/* Mobile Stacked Checklist Container (visible on mobile, md:hidden) */}
          <div className="md:hidden divide-y divide-border">
            <div className="p-3.5 flex items-center justify-between">
              <span className="font-bold text-foreground text-sm">
                15-Minute Gym Setup Checklist
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                SETUP MODE
              </span>
            </div>

            <Link
              href={`/app/${gymId}/memberships?tab=plans`}
              className="p-3 flex items-center justify-between text-xs sm:text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <span>Step 1: Create Plans</span>
              {plansCount > 0 ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </Link>

            <Link
              href={`/app/${gymId}/members`}
              className="p-3 flex items-center justify-between text-xs sm:text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <span>Step 2: Add Members</span>
              {membersCount > 0 ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </Link>
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
