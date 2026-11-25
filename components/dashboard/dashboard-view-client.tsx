"use client";

import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Users,
  CalendarCheck,
  Wallet,
  AlertTriangle,
  CreditCard,
  QrCode,
  Layers,
  Bell,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Zap,
  Calendar,
  Sparkles,
  CheckCircle2,
  UserPlus,
  RefreshCw,
  PhoneCall,
  FileCheck2,
  PieChart,
  ArrowRight,
} from "lucide-react";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { CreatePlanModal } from "@/components/memberships/create-plan-modal";
import { KpiCard } from "@/components/ui/kpi-card";

export interface AttendanceTrendPoint {
  date: string;
  dayLabel: string;
  count: number;
}

export interface MembershipBreakdownSegment {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface NeedsAttentionSummary {
  expiringCount: number;
  expiringRenewalValue: number;
  unpaidBalancesCount: number;
  pendingDuesTotal: number;
  inactive15PlusCount: number;
  pendingPaymentApprovalsCount: number;
  unassignedCount: number;
}

export interface RecentActivityItem {
  id: string;
  type: "check_in" | "payment" | "membership" | "member" | "plan";
  title: string;
  timestamp: string;
  href: string;
}

export interface DashboardViewProps {
  gymId: string;
  gymName: string;
  branchName: string;
  selectedBranchId: string;
  branches: Array<{ id: string; name: string }>;
  userFirstName: string;
  greeting: string;
  formattedDateIST: string;
  generatedAtIso: string;
  capabilities: {
    canManageMembers: boolean;
    canRecordPayments: boolean;
    canRecordAttendance: boolean;
    canManagePlans: boolean;
    canViewMembers: boolean;
    canViewReports: boolean;
    canViewFinancials: boolean;
  };
  kpis: {
    activeMembersCount: number;
    activeMembersDeltaPct: number;
    presentTodayCount: number;
    presentDeltaPct: number;
    moneyCollectedThisMonth: number;
    moneyCollectedDeltaPct: number;
    todayCollection: number;
    pendingDuesTotal: number;
    unpaidBalancesCount: number;
  };
  attendanceTrend: {
    points7D: AttendanceTrendPoint[];
    points30D: AttendanceTrendPoint[];
  };
  membershipBreakdown: {
    totalMembers: number;
    segments: MembershipBreakdownSegment[];
  };
  needsAttention: NeedsAttentionSummary;
  recentActivities: RecentActivityItem[];
  modalPlans: Array<{
    id: string;
    name: string;
    price: number;
    durationDays: number;
  }>;
  pilotStatus?: {
    isPilot: boolean;
    isActive: boolean;
    daysRemaining: number;
    badgeText: string;
  };
  loadError?: string | null;
  setupBanner?: ReactNode;
}

type TrendRange = "7d" | "30d";

function formatRelativeTime(timestampIso: string, referenceIso: string): string {
  const refMs = new Date(referenceIso).getTime();
  const targetMs = new Date(timestampIso).getTime();
  if (Number.isNaN(targetMs) || Number.isNaN(refMs)) return "Recently";

  const diffMin = Math.max(0, Math.floor((refMs - targetMs) / 60000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestampIso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function DeltaPill({ pct, invertPolarity = false }: { pct: number; invertPolarity?: boolean }) {
  const isPositive = pct >= 0;
  const isGood = invertPolarity ? !isPositive : isPositive;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums border ${
        isGood
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3 shrink-0" />
      ) : (
        <TrendingDown className="w-3 h-3 shrink-0" />
      )}
      <span>
        {isPositive ? "+" : ""}
        {pct}%
      </span>
    </span>
  );
}

// ============================================================================
// INLINE SVG CHARTS (Theme-token compatible, zero external chart bundle)
// ============================================================================

function AttendanceTrendChart({
  points,
  range,
  gymId,
}: {
  points: AttendanceTrendPoint[];
  range: TrendRange;
  gymId: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const hasAnyCheckIns = useMemo(() => points.some((p) => p.count > 0), [points]);

  const { maxY, yTicks } = useMemo(() => {
    const peak = Math.max(0, ...points.map((p) => p.count));
    if (peak <= 4) {
      return { maxY: 4, yTicks: [0, 1, 2, 3, 4] };
    }
    const divisor = 5;
    const rawMax = Math.ceil(peak * 1.15);
    const roughStep = rawMax / divisor;
    const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const norm = roughStep / mag;
    const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const step = Math.max(1, niceNorm * mag);
    const computedMax = step * divisor;
    return {
      maxY: computedMax,
      yTicks: [0, 1, 2, 3, 4, 5].map((i) => Math.round(i * step)),
    };
  }, [points]);

  const plotLeft = 36;
  const plotRight = 484;
  const plotTop = 32;
  const plotBottom = 160;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const coords = useMemo(() => {
    if (points.length === 0) return [];
    const denom = Math.max(1, points.length - 1);
    return points.map((p, i) => {
      const x = plotLeft + (i / denom) * plotWidth;
      const y = plotBottom - (p.count / maxY) * plotHeight;
      return { x, y, ...p };
    });
  }, [points, maxY, plotWidth, plotHeight]);

  const linePath = useMemo(() => {
    if (coords.length === 0) return "";
    return coords.reduce((acc, curr, idx, arr) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = arr[idx - 1];
      const cx = (prev.x + curr.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }, "");
  }, [coords]);

  const areaPath = useMemo(() => {
    if (coords.length === 0) return "";
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${linePath} L ${last.x} ${plotBottom} L ${first.x} ${plotBottom} Z`;
  }, [coords, linePath]);

  const visibleTickIndices = useMemo(() => {
    if (points.length <= 7) return points.map((_, i) => i);
    return [0, 6, 12, 18, 24, points.length - 1];
  }, [points]);

  const activeIdx =
    selectedIdx !== null && coords[selectedIdx]
      ? selectedIdx
      : coords.length > 0
      ? coords.length - 1
      : null;
  const activePoint = activeIdx !== null ? coords[activeIdx] : null;

  if (!hasAnyCheckIns) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-center px-4 rounded-xl bg-muted/30 border border-dashed border-border">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No check-ins recorded yet</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
          Member check-ins for the last {range === "7d" ? "7 days" : "30 days"} will appear here.
        </p>
        <Link
          href={`/app/${gymId}/attendance`}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-opacity"
        >
          <span>Record Check-In</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <svg
        viewBox="0 0 500 186"
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label={`Attendance trend for the last ${range === "7d" ? "7" : "30"} days`}
      >
        <defs>
          <linearGradient id="dashAttTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="85%" stopColor="var(--primary)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines + Y-axis labels */}
        {yTicks.map((tick) => {
          const y = plotBottom - (tick / maxY) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={tick === 0 ? undefined : "3 3"}
                opacity={tick === 0 ? 0.9 : 0.6}
              />
              <text
                x={plotLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                className="fill-muted-foreground font-medium tabular-nums"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area Fill & Smooth Line */}
        <path d={areaPath} fill="url(#dashAttTrendFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Vertical guide + Active Callout Pill */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={plotTop - 4}
              x2={activePoint.x}
              y2={plotBottom}
              stroke="var(--primary)"
              strokeDasharray="3 3"
              opacity="0.45"
            />
            {(() => {
              const boxW = 72;
              const boxH = 38;
              const clampedX = Math.min(
                Math.max(activePoint.x - boxW / 2, plotLeft),
                plotRight - boxW
              );
              const boxY = Math.max(0, activePoint.y - boxH - 10);
              return (
                <g transform={`translate(${clampedX}, ${boxY})`}>
                  <rect
                    width={boxW}
                    height={boxH}
                    rx="8"
                    fill="var(--card)"
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  <text
                    x={boxW / 2}
                    y="16"
                    textAnchor="middle"
                    fontSize="12"
                    className="fill-foreground font-bold tabular-nums"
                  >
                    {activePoint.count}
                  </text>
                  <text
                    x={boxW / 2}
                    y="30"
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-muted-foreground font-medium"
                  >
                    {activePoint.dayLabel}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* Interactive Point Dots (all points in 7D, active/sampled in 30D) */}
        {coords.map((c, idx) => {
          const isActive = idx === activeIdx;
          const showDot = range === "7d" || isActive;
          return (
            <g
              key={c.date}
              onMouseEnter={() => setSelectedIdx(idx)}
              onClick={() => setSelectedIdx(idx)}
              className="cursor-pointer"
            >
              <circle cx={c.x} cy={c.y} r="14" fill="transparent" />
              {showDot && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isActive ? 4.5 : 3.2}
                  fill="var(--primary)"
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}

        {/* X-Axis Date Labels */}
        {coords.map((c, idx) => {
          if (!visibleTickIndices.includes(idx)) return null;
          return (
            <text
              key={`lbl-${c.date}`}
              x={c.x}
              y={plotBottom + 18}
              textAnchor="middle"
              fontSize="11"
              className="fill-muted-foreground font-medium"
            >
              {c.dayLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function MembershipBreakdownDonut({
  totalMembers,
  segments,
}: {
  totalMembers: number;
  segments: MembershipBreakdownSegment[];
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const arcItems = useMemo(() => {
    const gap = segments.length > 1 ? 2.5 : 0;
    return segments.reduce<
      Array<MembershipBreakdownSegment & { dash: number; offset: number }>
    >((acc, seg) => {
      const priorPct = acc.reduce((sum, item) => sum + item.pct, 0);
      const rawLength = (seg.pct / 100) * circumference;
      const dash = Math.max(0, rawLength - gap);
      const offset = -((priorPct / 100) * circumference);
      acc.push({ ...seg, dash, offset });
      return acc;
    }, []);
  }, [segments, circumference]);

  return (
    <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full -rotate-90 transform"
        role="img"
        aria-label={`Membership breakdown across ${totalMembers} active members`}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="var(--muted)"
          strokeWidth="12"
          fill="none"
        />
        {arcItems.map((seg) =>
          seg.dash > 0 ? (
            <circle
              key={seg.key}
              cx="50"
              cy="50"
              r={radius}
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${seg.dash} ${circumference}`}
              strokeDashoffset={seg.offset}
              fill="none"
              strokeLinecap="butt"
            />
          ) : null
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
        <span className="text-xl sm:text-2xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">
          {totalMembers.toLocaleString("en-IN")}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground mt-1 leading-none">
          Members
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD VIEW
// ============================================================================

export function DashboardViewClient(props: DashboardViewProps) {
  const {
    gymId,
    gymName,
    branchName,
    selectedBranchId,
    branches,
    userFirstName,
    greeting,
    formattedDateIST,
    generatedAtIso,
    capabilities,
    kpis,
    attendanceTrend,
    membershipBreakdown,
    needsAttention,
    recentActivities,
    modalPlans,
    pilotStatus,
    loadError,
    setupBanner,
  } = props;

  const router = useRouter();
  const [trendRange, setTrendRange] = useState<TrendRange>("7d");
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [showAllMobileActions, setShowAllMobileActions] = useState(false);

  const activeTrendPoints =
    trendRange === "7d" ? attendanceTrend.points7D : attendanceTrend.points30D;

  const showFinancials = capabilities.canRecordPayments || capabilities.canViewFinancials;

  // Build Needs Attention items from live metrics
  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      href: string;
      tone: "rose" | "amber" | "blue" | "primary";
      icon: "clock" | "alert" | "phone" | "file";
    }> = [];

    if (needsAttention.expiringCount > 0) {
      items.push({
        id: "expiring",
        title: `${needsAttention.expiringCount} membership${
          needsAttention.expiringCount === 1 ? "" : "s"
        } expiring soon`,
        subtitle:
          showFinancials && needsAttention.expiringRenewalValue > 0
            ? `Renewal value: ₹${needsAttention.expiringRenewalValue.toLocaleString("en-IN")}`
            : "Expiring in the next 7 days",
        href: `/app/${gymId}/follow-ups`,
        tone: "rose",
        icon: "clock",
      });
    }

    if (showFinancials && needsAttention.unpaidBalancesCount > 0) {
      items.push({
        id: "dues",
        title: `${needsAttention.unpaidBalancesCount} pending due${
          needsAttention.unpaidBalancesCount === 1 ? "" : "s"
        } (₹${needsAttention.pendingDuesTotal.toLocaleString("en-IN")})`,
        subtitle: "Follow up with members",
        href: `/app/${gymId}/follow-ups`,
        tone: "amber",
        icon: "alert",
      });
    }

    if (needsAttention.inactive15PlusCount > 0) {
      items.push({
        id: "inactive",
        title: `${needsAttention.inactive15PlusCount} inactive member${
          needsAttention.inactive15PlusCount === 1 ? "" : "s"
        } (15+ days)`,
        subtitle: "Check in and re-engage",
        href: capabilities.canViewReports ? `/app/${gymId}/reports` : `/app/${gymId}/members`,
        tone: "blue",
        icon: "phone",
      });
    }

    if (showFinancials && needsAttention.pendingPaymentApprovalsCount > 0) {
      items.push({
        id: "approvals",
        title: `${needsAttention.pendingPaymentApprovalsCount} pending payment approval${
          needsAttention.pendingPaymentApprovalsCount === 1 ? "" : "s"
        }`,
        subtitle: "Review and verify UPI payments",
        href: `/app/${gymId}/payments`,
        tone: "primary",
        icon: "file",
      });
    } else if (capabilities.canManageMembers && needsAttention.unassignedCount > 0) {
      items.push({
        id: "unassigned",
        title: `${needsAttention.unassignedCount} member${
          needsAttention.unassignedCount === 1 ? "" : "s"
        } awaiting a plan`,
        subtitle: "Assign a membership plan",
        href: `/app/${gymId}/memberships?tab=unassigned`,
        tone: "primary",
        icon: "file",
      });
    }

    return items.slice(0, 4);
  }, [
    needsAttention,
    showFinancials,
    capabilities.canViewReports,
    capabilities.canManageMembers,
    gymId,
  ]);

  const toneClasses: Record<"rose" | "amber" | "blue" | "primary", { row: string; icon: string }> = {
    rose: {
      row: "bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20",
      icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    },
    amber: {
      row: "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/20",
      icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    blue: {
      row: "bg-sky-500/10 hover:bg-sky-500/15 border-sky-500/20",
      icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    primary: {
      row: "bg-primary/10 hover:bg-primary/15 border-primary/20",
      icon: "bg-primary/15 text-primary",
    },
  };

  return (
    <div className="space-y-4">
      {/* ====================================================================
          1. HERO GREETING BANNER (No unnecessary descriptive subtitle)
          ==================================================================== */}
      <section className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground lg:bg-card lg:text-card-foreground lg:border lg:border-border p-4 sm:p-5 shadow-xs">
        {/* Subtle Decorative Gym Image Blend (Right side, desktop & mobile) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 h-full w-44 sm:w-64 lg:w-80 select-none">
          <Image
            src="/images/auth-gym-dumbbells.jpg"
            alt=""
            fill
            sizes="(max-width: 1024px) 220px, 320px"
            className="object-cover object-center opacity-15 lg:opacity-25 dark:lg:opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/85 to-primary/25 lg:from-card lg:via-card/85 lg:to-card/15" />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {/* Mobile Eyebrow: Live Dot + Time-aware Greeting */}
            <div className="flex items-center gap-1.5 text-xs font-medium opacity-90 lg:hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">
                {greeting}, {userFirstName}
              </span>
            </div>

            {/* Desktop Workspace Eyebrow Heading */}
            <div className="hidden lg:flex items-center gap-2 mb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary truncate">
                {gymName}
              </h2>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-xs font-semibold text-muted-foreground truncate">
                {branchName}
              </span>
            </div>

            {/* Single Page Heading (Mobile shows Gym Name, Desktop shows Welcome Back) */}
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight leading-tight truncate mt-0.5 lg:mt-0">
              <span className="lg:hidden">{gymName}</span>
              <span className="hidden lg:inline">Welcome back, {userFirstName}!</span>
            </h1>
          </div>

          {/* Right Context: Mobile Trial Pill + Desktop IST Date Box */}
          <div className="flex items-center gap-2.5 shrink-0">
            {pilotStatus?.isPilot && (
              <Link
                href={`/app/${gymId}/settings`}
                className="inline-flex items-center gap-2 rounded-xl bg-card text-card-foreground border border-border px-3 py-1.5 shadow-xs hover:bg-muted/80 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <div className="leading-tight text-left">
                  <div className="text-xs font-bold text-foreground">
                    {pilotStatus.isActive ? "Trial" : "Pilot"}
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {pilotStatus.isActive
                      ? `${pilotStatus.daysRemaining}d left`
                      : "Grace period"}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground lg:hidden" />
              </Link>
            )}

            <div className="hidden lg:flex items-center gap-2.5 rounded-xl bg-card/95 text-card-foreground border border-border px-3.5 py-2 shadow-2xs backdrop-blur-xs">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <div className="leading-tight">
                <div className="text-xs font-bold text-foreground whitespace-nowrap">
                  {formattedDateIST}
                </div>
                <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                  Asia/Kolkata (IST)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Non-blocking Query Error Banner */}
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-foreground text-xs font-bold hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Guided Lifecycle Setup Banner (only when gym is still in setup / unassigned / first check-in) */}
      {setupBanner}

      {/* ====================================================================
          2. KPI CARDS ROW (4-col desktop, 2x2 mobile)
          ==================================================================== */}
      <section
        aria-label="Key metrics"
        className={`grid gap-2.5 sm:gap-3.5 ${
          showFinancials ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"
        }`}
      >
        <KpiCard
          label="Active Members"
          value={kpis.activeMembersCount.toLocaleString("en-IN")}
          variant="green"
          icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={<DeltaPill pct={kpis.activeMembersDeltaPct} />}
          subtext="vs. last month"
          href={`/app/${gymId}/members`}
        />

        <KpiCard
          label="Present Today"
          value={kpis.presentTodayCount.toLocaleString("en-IN")}
          variant="blue"
          icon={<CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={<DeltaPill pct={kpis.presentDeltaPct} />}
          subtext="vs. yesterday"
          href={`/app/${gymId}/attendance`}
        />

        {showFinancials && (
          <KpiCard
            label="Money Collected"
            value={`₹${kpis.moneyCollectedThisMonth.toLocaleString("en-IN")}`}
            variant="purple"
            icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
            trend={<DeltaPill pct={kpis.moneyCollectedDeltaPct} />}
            subtext="This Month"
            href={`/app/${gymId}/payments`}
            title={`Collected today: ₹${kpis.todayCollection.toLocaleString("en-IN")}`}
          />
        )}

        {showFinancials && (
          <KpiCard
            label="Pending Dues"
            value={`₹${kpis.pendingDuesTotal.toLocaleString("en-IN")}`}
            variant="amber"
            icon={<AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />}
            subtext={
              kpis.unpaidBalancesCount > 0
                ? `${kpis.unpaidBalancesCount} unpaid balance${
                    kpis.unpaidBalancesCount === 1 ? "" : "s"
                  }`
                : "All balances settled"
            }
            href={`/app/${gymId}/follow-ups`}
          />
        )}
      </section>

      {/* ====================================================================
          3. QUICK ACTIONS BAR
          ==================================================================== */}
      <section className="bg-card border border-border rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary shrink-0" />
            <span>Quick Actions</span>
          </h2>
          {capabilities.canViewMembers && (
            <button
              type="button"
              onClick={() => setShowAllMobileActions((prev) => !prev)}
              className="lg:hidden inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <span>{showAllMobileActions ? "Show Less" : "View All"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 min-[360px]:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5">
          {/* 1. Add Member */}
          {capabilities.canManageMembers ? (
            <QuickEnrollModal
              gymId={gymId}
              branchId={selectedBranchId}
              plans={modalPlans}
              triggerLabel="Add Member"
              triggerClassName="w-full min-h-[68px] lg:min-h-[44px] px-2 py-2.5 lg:px-3.5 lg:py-2.5 rounded-xl bg-orange-50/90 hover:bg-orange-100/90 active:bg-orange-100 [.dark_&]:bg-orange-500/[0.14] [.dark_&]:hover:bg-orange-500/[0.22] [.dark_&]:active:bg-orange-500/[0.26] border border-orange-200/90 hover:border-orange-300 [.dark_&]:border-orange-500/30 [.dark_&]:hover:border-orange-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 text-center transition-all cursor-pointer [&_svg]:text-orange-600 [.dark_&]:[&_svg]:text-orange-400 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          ) : (
            <Link
              href={`/app/${gymId}/members`}
              className="w-full min-h-[68px] lg:min-h-[44px] px-2 py-2.5 lg:px-3.5 lg:py-2.5 rounded-xl bg-orange-50/90 hover:bg-orange-100/90 active:bg-orange-100 [.dark_&]:bg-orange-500/[0.14] [.dark_&]:hover:bg-orange-500/[0.22] [.dark_&]:active:bg-orange-500/[0.26] border border-orange-200/90 hover:border-orange-300 [.dark_&]:border-orange-500/30 [.dark_&]:hover:border-orange-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Users className="w-4 h-4 text-orange-600 [.dark_&]:text-orange-400 shrink-0" />
              <span className="leading-tight">Members</span>
            </Link>
          )}

          {/* 2. Record Payment */}
          {capabilities.canRecordPayments && (
            <Link
              href={`/app/${gymId}/payments`}
              className="w-full min-h-[68px] lg:min-h-[44px] px-2 py-2.5 lg:px-3.5 lg:py-2.5 rounded-xl bg-emerald-50/90 hover:bg-emerald-100/90 active:bg-emerald-100 [.dark_&]:bg-emerald-500/[0.14] [.dark_&]:hover:bg-emerald-500/[0.22] [.dark_&]:active:bg-emerald-500/[0.26] border border-emerald-200/90 hover:border-emerald-300 [.dark_&]:border-emerald-500/30 [.dark_&]:hover:border-emerald-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <CreditCard className="w-4 h-4 text-emerald-600 [.dark_&]:text-emerald-400 shrink-0" />
              <span className="leading-tight">Record Payment</span>
            </Link>
          )}

          {/* 3. Check-In / Manual Check-In */}
          {capabilities.canRecordAttendance && (
            <Link
              href={`/app/${gymId}/attendance`}
              className="w-full min-h-[68px] lg:min-h-[44px] px-2 py-2.5 lg:px-3.5 lg:py-2.5 rounded-xl bg-amber-50/90 hover:bg-amber-100/90 active:bg-amber-100 [.dark_&]:bg-amber-500/[0.14] [.dark_&]:hover:bg-amber-500/[0.22] [.dark_&]:active:bg-amber-500/[0.26] border border-amber-200/90 hover:border-amber-300 [.dark_&]:border-amber-500/30 [.dark_&]:hover:border-amber-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <QrCode className="w-4 h-4 text-amber-600 [.dark_&]:text-amber-400 shrink-0" />
              <span className="leading-tight lg:hidden">Check-In</span>
              <span className="leading-tight hidden lg:inline">Manual Check-In</span>
            </Link>
          )}

          {/* 4. Create Plan (or Memberships for roles without plans:manage) */}
          {capabilities.canManagePlans ? (
            <button
              type="button"
              onClick={() => setCreatePlanOpen(true)}
              className="w-full min-h-[68px] lg:min-h-[44px] px-2 py-2.5 lg:px-3.5 lg:py-2.5 rounded-xl bg-sky-50/90 hover:bg-sky-100/90 active:bg-sky-100 [.dark_&]:bg-sky-500/[0.14] [.dark_&]:hover:bg-sky-500/[0.22] [.dark_&]:active:bg-sky-500/[0.26] border border-sky-200/90 hover:border-sky-300 [.dark_&]:border-sky-500/30 [.dark_&]:hover:border-sky-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Layers className="w-4 h-4 text-sky-600 [.dark_&]:text-sky-400 shrink-0" />
              <span className="leading-tight">Create Plan</span>
            </button>
          ) : (
            <Link
              href={`/app/${gymId}/memberships`}
              className="w-full min-h-[68px] lg:min-h-[44px] px-2 py-2.5 lg:px-3.5 lg:py-2.5 rounded-xl bg-sky-50/90 hover:bg-sky-100/90 active:bg-sky-100 [.dark_&]:bg-sky-500/[0.14] [.dark_&]:hover:bg-sky-500/[0.22] [.dark_&]:active:bg-sky-500/[0.26] border border-sky-200/90 hover:border-sky-300 [.dark_&]:border-sky-500/30 [.dark_&]:hover:border-sky-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Layers className="w-4 h-4 text-sky-600 [.dark_&]:text-sky-400 shrink-0" />
              <span className="leading-tight">Memberships</span>
            </Link>
          )}

          {/* 5. Follow-ups & Dues (Always visible on lg, toggleable via View All on mobile) */}
          {capabilities.canViewMembers && (
            <Link
              href={`/app/${gymId}/follow-ups`}
              className={`${
                showAllMobileActions
                  ? "col-span-2 min-[360px]:col-span-4 lg:col-span-1 flex"
                  : "hidden lg:flex"
              } w-full min-h-[48px] lg:min-h-[44px] px-3 py-2.5 rounded-xl bg-yellow-50/90 hover:bg-yellow-100/90 active:bg-yellow-100 [.dark_&]:bg-yellow-500/[0.14] [.dark_&]:hover:bg-yellow-500/[0.22] [.dark_&]:active:bg-yellow-500/[0.26] border border-yellow-200/90 hover:border-yellow-300 [.dark_&]:border-yellow-500/30 [.dark_&]:hover:border-yellow-400/50 text-foreground font-semibold text-[12px] lg:text-xs flex-row items-center justify-center gap-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
            >
              <Bell className="w-4 h-4 text-amber-600 [.dark_&]:text-amber-400 shrink-0" />
              <span className="leading-tight">Follow-ups &amp; Dues</span>
            </Link>
          )}
        </div>
      </section>

      {/* ====================================================================
          4. ANALYTICS ROW: ATTENDANCE TREND + MEMBERSHIP BREAKDOWN
          ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Attendance Trend (Left on Desktop, Full-width on Mobile) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <span>Attendance Trend</span>
            </h2>

            <div className="relative">
              <select
                aria-label="Select attendance trend period"
                value={trendRange}
                onChange={(e) => setTrendRange(e.target.value as TrendRange)}
                className="h-8 pl-2.5 pr-7 rounded-lg bg-muted/60 hover:bg-muted border border-border text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/25 appearance-none cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          <AttendanceTrendChart points={activeTrendPoints} range={trendRange} gymId={gymId} />
        </div>

        {/* Membership Breakdown (Right on Desktop, Full-width on Mobile) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary shrink-0" />
              <span>Membership Breakdown</span>
            </h2>
            <Link
              href={`/app/${gymId}/memberships`}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>View</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {membershipBreakdown.totalMembers === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
              <MembershipBreakdownDonut totalMembers={0} segments={[]} />
              <p className="text-xs text-muted-foreground mt-3">
                No active members yet. Add members to see your breakdown.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 sm:gap-5 my-auto py-1">
              <MembershipBreakdownDonut
                totalMembers={membershipBreakdown.totalMembers}
                segments={membershipBreakdown.segments}
              />

              <div className="flex-1 min-w-0 space-y-2">
                {membershipBreakdown.segments.map((seg) => (
                  <div
                    key={seg.key}
                    className="flex items-center justify-between gap-2 text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-medium text-foreground truncate">{seg.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 tabular-nums shrink-0">
                      <span className="font-bold text-foreground">
                        {seg.count.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        ({seg.pct}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          5. LOWER ROW: NEEDS ATTENTION + RECENT ACTIVITY
          ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Needs Attention */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary shrink-0" />
              <span>Needs Attention</span>
            </h2>
            <Link
              href={`/app/${gymId}/follow-ups`}
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {attentionItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center rounded-xl bg-muted/30 border border-dashed border-border px-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No expiring plans, pending dues, or inactive alerts right now.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attentionItems.map((item) => {
                const style = toneClasses[item.tone];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${style.row}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.icon}`}
                      >
                        {item.icon === "clock" && <Clock className="w-4 h-4" />}
                        {item.icon === "alert" && <AlertTriangle className="w-4 h-4" />}
                        {item.icon === "phone" && <PhoneCall className="w-4 h-4" />}
                        {item.icon === "file" && <FileCheck2 className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-6 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>Recent Activity</span>
            </h2>
            <Link
              href={
                capabilities.canViewReports
                  ? `/app/${gymId}/reports`
                  : `/app/${gymId}/attendance`
              }
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center rounded-xl bg-muted/30 border border-dashed border-border px-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">No recent activity yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check-ins, payments, and new enrollments will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentActivities.map((act, idx) => (
                <Link
                  key={act.id}
                  href={act.href}
                  className={`py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 hover:bg-muted/40 -mx-1.5 px-1.5 rounded-lg transition-colors ${
                    idx >= 3 ? "hidden sm:flex" : "flex"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        act.type === "check_in"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : act.type === "payment"
                          ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                          : act.type === "membership"
                          ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                          : act.type === "member"
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {act.type === "check_in" && <CheckCircle2 className="w-4 h-4" />}
                      {act.type === "payment" && <CreditCard className="w-4 h-4" />}
                      {act.type === "membership" && <RefreshCw className="w-4 h-4" />}
                      {act.type === "member" && <UserPlus className="w-4 h-4" />}
                      {act.type === "plan" && <Layers className="w-4 h-4" />}
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {act.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums shrink-0">
                    {formatRelativeTime(act.timestamp, generatedAtIso)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Create Plan Modal (reused from existing memberships component) */}
      {capabilities.canManagePlans && (
        <CreatePlanModal
          gymId={gymId}
          branches={branches}
          defaultBranchId={selectedBranchId}
          isOpen={createPlanOpen}
          onClose={() => setCreatePlanOpen(false)}
        />
      )}
    </div>
  );
}
