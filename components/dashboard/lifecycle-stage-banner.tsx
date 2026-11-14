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

      {/* STAGE 1: 15-Minute Gym Setup Command Card */}
      {stage === "STAGE_1_SETUP" && (
        <div className="bg-card rounded-2xl sm:rounded-3xl border border-primary/30 ring-1 ring-primary/10 shadow-xs p-4 sm:p-5 text-card-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-foreground">
                    15-Minute Gym Setup Checklist
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    Setup Mode
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Complete these 2 quick steps to start daily operations and automated front desk check-ins.
                </p>
              </div>
            </div>

            <Link
              href={`/app/${gymId}/getting-started`}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline shrink-0 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Full Onboarding Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Setup Steps Grid (Strict 2-Column Mobile Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Step 1: Pricing Plans */}
            <div className="p-4 rounded-xl sm:rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      plansCount > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {plansCount > 0 ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Step 1
                    </div>
                    <div className="text-sm sm:text-base font-bold text-foreground">
                      Membership Pricing Plans
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                    plansCount > 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {plansCount > 0 ? `${plansCount} Active` : "Pending"}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground mt-2 mb-3">
                Configure your monthly, quarterly, or annual plans with custom durations and pricing.
              </p>

              <Link
                href={`/app/${gymId}/memberships?tab=plans`}
                className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  plansCount > 0
                    ? "bg-card hover:bg-muted text-foreground border border-border"
                    : "bg-primary hover:opacity-95 text-primary-foreground shadow-xs"
                }`}
              >
                <IdCard className="w-4 h-4" />
                <span>{plansCount > 0 ? "Manage Plans" : "1. Create Plans"}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto" />
              </Link>
            </div>

            {/* Step 2: Import / Add Members */}
            <div className="p-4 rounded-xl sm:rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      membersCount > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {membersCount > 0 ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Step 2
                    </div>
                    <div className="text-sm sm:text-base font-bold text-foreground">
                      Build Member Roster
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                    membersCount > 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {membersCount > 0 ? `${membersCount} Enrolled` : "Pending"}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground mt-2 mb-3">
                Quick-enroll walk-ins or import your entire existing gym Excel/CSV sheet in 1 click.
              </p>

              <Link
                href={`/app/${gymId}/members`}
                className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  membersCount > 0
                    ? "bg-card hover:bg-muted text-foreground border border-border"
                    : "bg-primary hover:opacity-95 text-primary-foreground shadow-xs"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{membersCount > 0 ? "Manage Members" : "2. Import Members CSV"}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto" />
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
