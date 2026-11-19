"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CreditCard,
  Receipt,
  Bell,
  Sparkles,
  Wallet,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
  Users,
  ChevronRight,
  IndianRupee,
} from "lucide-react";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { DashboardHeaderDate, CheckInTimeBadge } from "./dashboard-live-timestamp";

export type TimeWindow = "7D" | "30D" | "90D";

export interface DashboardFinancialWindowData {
  collections: number;
  expenses: number;
  netCashFlow: number;
  pendingDues: number;
  chartBars: Array<{
    label: string;
    collections: number;
    expenses: number;
  }>;
}

export interface DashboardFinancialData {
  "7D": DashboardFinancialWindowData;
  "30D": DashboardFinancialWindowData;
  "90D": DashboardFinancialWindowData;
}

export interface AttendancePoint {
  date: string;
  dayLabel: string;
  count: number;
  movingAvg: number;
}

export interface AttendanceSeriesData {
  points: AttendancePoint[];
  currTotal: number;
  prevTotal: number;
  deltaPct: number;
  avg7Day: number;
}

export interface SparklineMetric {
  title: string;
  currentValueFormatted: string;
  deltaPct: number;
  points: number[];
  color: string;
}

export interface MembershipHealthData {
  totalRoster: number;
  activeCount: number;
  activePct: number;
  expiringCount: number;
  expiringPct: number;
  atRiskCount: number;
  atRiskPct: number;
}

export interface ExpiringMemberItem {
  memberId: string;
  fullName: string;
  phone: string;
  planName: string;
  endDate: string;
  daysLeft: number;
  branchName: string;
}

export interface LiveCheckInItem {
  id: string;
  memberId: string;
  fullName: string;
  method: string;
  checkInTime: string;
  branchName?: string;
}

export interface DashboardViewProps {
  gymId: string;
  gymName: string;
  branchName: string;
  selectedBranchId: string;
  todayStr: string;
  todayCollection: number;
  todayCash: number;
  todayUpi: number;
  financialData: DashboardFinancialData;
  attendanceSeries: AttendanceSeriesData;
  weeklyPulse: {
    revenue: SparklineMetric;
    expenses: SparklineMetric;
    memberGrowth: SparklineMetric;
  };
  membershipHealth: MembershipHealthData;
  expiringSoon: ExpiringMemberItem[];
  liveCheckIns: LiveCheckInItem[];
  modalPlans: Array<{
    id: string;
    name: string;
    price: number;
    durationDays: number;
  }>;
  pilotStatus?: {
    isPilot: boolean;
    badgeText: string;
  };
}

// ============================================================================
// INLINE CRISP SVG CHARTS
// ============================================================================

/** Smooth Area Chart for Attendance with 7-Day Average Dashed Line */
function AttendanceAreaChart({
  points,
  avg7Day,
  deltaPct,
}: {
  points: AttendancePoint[];
  avg7Day: number;
  deltaPct: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxY = useMemo(() => {
    if (!points || points.length === 0) return 10;
    const maxVal = Math.max(...points.map((p) => Math.max(p.count, p.movingAvg)));
    return Math.max(10, Math.ceil(maxVal * 1.2));
  }, [points]);

  const coords = useMemo(() => {
    if (!points || points.length === 0) return [];
    const count = points.length;
    return points.map((p, i) => {
      const x = 16 + (i / (count - 1)) * 568;
      const y = 125 - (p.count / maxY) * 105;
      const avgY = 125 - (p.movingAvg / maxY) * 105;
      return { x, y, avgY, ...p };
    });
  }, [points, maxY]);

  const linePath = useMemo(() => {
    if (coords.length === 0) return "";
    return coords.reduce((acc, curr, idx, arr) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = arr[idx - 1];
      const cx = (prev.x + curr.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }, "");
  }, [coords]);

  const avgPath = useMemo(() => {
    if (coords.length === 0) return "";
    return coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.avgY}` : `${acc} L ${curr.x} ${curr.avgY}`;
    }, "");
  }, [coords]);

  const areaPath = useMemo(() => {
    if (coords.length === 0) return "";
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${linePath} L ${last.x} 128 L ${first.x} 128 Z`;
  }, [coords, linePath]);

  // Reduced ticks: Desktop ~6, Mobile ~4
  const desktopTickIndices = [0, 6, 12, 18, 24, 29];
  const mobileTickIndices = [0, 10, 20, 29];

  return (
    <div className="w-full relative">
      <svg
        viewBox="0 0 600 148"
        className="w-full h-36 sm:h-40 overflow-visible select-none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="attAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.32" />
            <stop offset="85%" stopColor="#0F766E" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#0F766E" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Subtle Horizontal Grid lines */}
        <line x1="16" y1="20" x2="584" y2="20" stroke="var(--border)" strokeDasharray="3 3" opacity="0.4" />
        <line x1="16" y1="55" x2="584" y2="55" stroke="var(--border)" strokeDasharray="3 3" opacity="0.4" />
        <line x1="16" y1="90" x2="584" y2="90" stroke="var(--border)" strokeDasharray="3 3" opacity="0.4" />
        <line x1="16" y1="125" x2="584" y2="125" stroke="var(--border)" opacity="0.8" />

        {/* Area Fill */}
        <path d={areaPath} fill="url(#attAreaGrad)" />

        {/* 7-Day Moving Average Line (Dashed) */}
        <path
          d={avgPath}
          fill="none"
          stroke="#D49B35"
          strokeWidth="1.75"
          strokeDasharray="4 3"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Main Attendance Curve */}
        <path
          d={linePath}
          fill="none"
          stroke="#0F766E"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Desktop Ticks */}
        {coords.map((c, idx) => {
          if (!desktopTickIndices.includes(idx)) return null;
          return (
            <text
              key={c.date}
              x={c.x}
              y="142"
              textAnchor="middle"
              className="hidden sm:inline fill-muted-foreground text-[10px] font-medium"
            >
              {c.dayLabel}
            </text>
          );
        })}

        {/* Mobile Ticks (Reduced 4 ticks to prevent collision) */}
        {coords.map((c, idx) => {
          if (!mobileTickIndices.includes(idx)) return null;
          return (
            <text
              key={`m-${c.date}`}
              x={c.x}
              y="142"
              textAnchor="middle"
              className="inline sm:hidden fill-muted-foreground text-[9px] font-medium"
            >
              {c.dayLabel}
            </text>
          );
        })}

        {/* Hover / Interactive Focus Dot */}
        {hoveredIdx !== null && coords[hoveredIdx] && (
          <g>
            <line
              x1={coords[hoveredIdx].x}
              y1="16"
              x2={coords[hoveredIdx].x}
              y2="125"
              stroke="#0F766E"
              strokeDasharray="2 2"
              opacity="0.7"
            />
            <circle
              cx={coords[hoveredIdx].x}
              cy={coords[hoveredIdx].y}
              r="4.5"
              fill="#0F766E"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Grouped Dual-Bar SVG Chart for Collections vs Expenses */
function FinancialDualBarChart({
  bars,
}: {
  bars: Array<{ label: string; collections: number; expenses: number }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxY = useMemo(() => {
    if (!bars || bars.length === 0) return 10000;
    const maxVal = Math.max(...bars.flatMap((b) => [b.collections, b.expenses]));
    return Math.max(10000, Math.ceil(maxVal * 1.18));
  }, [bars]);

  const groupWidth = 550 / Math.max(1, bars.length);

  return (
    <div className="w-full relative">
      <svg
        viewBox="0 0 600 152"
        className="w-full h-36 sm:h-40 overflow-visible select-none"
        preserveAspectRatio="none"
      >
        {/* Horizontal reference lines */}
        <line x1="20" y1="20" x2="580" y2="20" stroke="var(--border)" strokeDasharray="3 3" opacity="0.35" />
        <line x1="20" y1="55" x2="580" y2="55" stroke="var(--border)" strokeDasharray="3 3" opacity="0.35" />
        <line x1="20" y1="90" x2="580" y2="90" stroke="var(--border)" strokeDasharray="3 3" opacity="0.35" />
        <line x1="20" y1="125" x2="580" y2="125" stroke="var(--border)" opacity="0.8" />

        {bars.map((bar, i) => {
          const startX = 25 + i * groupWidth;
          const barWidth = Math.min(22, Math.max(6, groupWidth * 0.36));
          const gap = Math.min(4, barWidth * 0.2);

          const cHeight = Math.max(2, (bar.collections / maxY) * 105);
          const cY = 125 - cHeight;
          const cX = startX + (groupWidth - (barWidth * 2 + gap)) / 2;

          const eHeight = Math.max(2, (bar.expenses / maxY) * 105);
          const eY = 125 - eHeight;
          const eX = cX + barWidth + gap;

          const isHovered = hoveredIdx === i;

          return (
            <g
              key={bar.label + i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {/* Collections Bar (Emerald) */}
              <rect
                x={cX}
                y={cY}
                width={barWidth}
                height={cHeight}
                rx="3.5"
                fill="#10B981"
                opacity={isHovered ? 1 : 0.88}
                className="transition-opacity"
              />

              {/* Expenses Bar (Rose) */}
              <rect
                x={eX}
                y={eY}
                width={barWidth}
                height={eHeight}
                rx="3.5"
                fill="#F43F5E"
                opacity={isHovered ? 1 : 0.88}
                className="transition-opacity"
              />

              {/* X-Axis Tick Label */}
              <text
                x={startX + groupWidth / 2}
                y="142"
                textAnchor="middle"
                className={`fill-muted-foreground text-[10px] font-medium transition-colors ${
                  isHovered ? "fill-foreground font-bold" : ""
                }`}
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** SVG Donut Chart with Total Roster Center */
function MembershipDonutChart({
  activePct,
  expiringPct,
  atRiskPct,
  totalRoster,
}: {
  activePct: number;
  expiringPct: number;
  atRiskPct: number;
  totalRoster: number;
}) {
  const r = 35;
  const c = 2 * Math.PI * r; // ≈ 219.91

  const activeDash = (activePct / 100) * c;
  const expiringDash = (expiringPct / 100) * c;
  const atRiskDash = (atRiskPct / 100) * c;

  const activeOffset = 0;
  const expiringOffset = -activeDash;
  const atRiskOffset = -(activeDash + expiringDash);

  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90 transform">
        {/* Background track circle */}
        <circle
          cx="45"
          cy="45"
          r={r}
          stroke="var(--border)"
          strokeWidth="9"
          fill="none"
          opacity="0.35"
        />

        {/* Segment 1: Active (Emerald) */}
        {activePct > 0 && (
          <circle
            cx="45"
            cy="45"
            r={r}
            stroke="#10B981"
            strokeWidth="9"
            strokeDasharray={`${activeDash} ${c}`}
            strokeDashoffset={activeOffset}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Segment 2: Expiring (Amber) */}
        {expiringPct > 0 && (
          <circle
            cx="45"
            cy="45"
            r={r}
            stroke="#F59E0B"
            strokeWidth="9"
            strokeDasharray={`${expiringDash} ${c}`}
            strokeDashoffset={expiringOffset}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Segment 3: At-Risk (Rose) */}
        {atRiskPct > 0 && (
          <circle
            cx="45"
            cy="45"
            r={r}
            stroke="#F43F5E"
            strokeWidth="9"
            strokeDasharray={`${atRiskDash} ${c}`}
            strokeDashoffset={atRiskOffset}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Center Text Container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <span className="text-xl sm:text-2xl font-black text-foreground tabular-nums tracking-tight leading-none">
          {totalRoster}
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
          Roster
        </span>
      </div>
    </div>
  );
}

/** 7-Point Mini Sparkline */
function MiniSparkline({ points, color }: { points: number[]; color: string }) {
  if (!points || points.length === 0) return <div className="w-16 h-6" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);

  const pts = points.map((val, i) => {
    const x = (i / (points.length - 1)) * 58 + 2;
    const y = 20 - ((val - min) / range) * 16;
    return `${x},${y}`;
  });

  const lineString = pts.join(" ");
  const areaString = `${lineString} 60,22 2,22`;

  return (
    <svg viewBox="0 0 62 24" className="w-16 h-6 overflow-visible shrink-0 select-none">
      <polygon points={areaString} fill={color} fillOpacity="0.14" />
      <polyline
        points={lineString}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    todayStr,
    todayCollection,
    financialData,
    attendanceSeries,
    weeklyPulse,
    membershipHealth,
    expiringSoon,
    liveCheckIns,
    modalPlans,
    pilotStatus,
  } = props;

  const [activeWindow, setActiveWindow] = useState<TimeWindow>("30D");
  const [greeting, setGreeting] = useState("Good day!");

  // Compute time-aware greeting
  useEffect(() => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        hour12: false,
      });
      const hour = parseInt(formatter.format(new Date()), 10);
      if (hour < 12) setGreeting("Good morning!");
      else if (hour < 17) setGreeting("Good afternoon!");
      else setGreeting("Good evening!");
    } catch {
      setGreeting("Good day!");
    }
  }, []);

  const activeFin = financialData[activeWindow] || financialData["30D"];

  return (
    <div className="space-y-4 max-w-7xl mx-auto text-foreground">
      {/* ====================================================================
          1. UNIFIED HEADER BAR (Responsive: 1-line desktop, stacked mobile)
          ==================================================================== */}
      <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Gym & Branch Identity + Time-Aware Greeting */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
              {gymName} • {branchName}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </span>
            {pilotStatus?.isPilot && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/25 shrink-0">
                <Sparkles className="w-3 h-3 text-primary" />
                {pilotStatus.badgeText}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{greeting}</span> Here&apos;s your gym&apos;s business overview.
          </p>
        </div>

        {/* Right: Today's Collection Pill & Equal CTAs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold tabular-nums">
            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Today: ₹{todayCollection.toLocaleString("en-IN")}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <Link
              href={`/app/${gymId}/attendance`}
              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Check-In</span>
            </Link>

            <QuickEnrollModal
              gymId={gymId}
              branchId={selectedBranchId}
              plans={modalPlans}
              triggerLabel="+ Enroll"
              triggerClassName="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:opacity-95 active:scale-[0.99] text-primary-foreground text-xs font-bold shadow-2xs transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. DESKTOP COMPOSITION (lg:grid lg:grid-cols-12 lg:gap-4)
          ==================================================================== */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 items-start">
        {/* ==================== LEFT COLUMN (col-span-6) ==================== */}
        {/* Performance & Activity */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card 1: Member Attendance Area Chart */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-600" />
                  Member Attendance
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Daily check-ins • Last 30 days
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                  Avg: {attendanceSeries.avg7Day}/day
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md border tabular-nums ${
                    attendanceSeries.deltaPct >= 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
                  }`}
                >
                  {attendanceSeries.deltaPct >= 0 ? "+" : ""}
                  {attendanceSeries.deltaPct}% vs prev 30d
                </span>
              </div>
            </div>

            <AttendanceAreaChart
              points={attendanceSeries.points}
              avg7Day={attendanceSeries.avg7Day}
              deltaPct={attendanceSeries.deltaPct}
            />

            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                  Daily Check-Ins
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 border-b-2 border-dashed border-amber-500 inline-block" />
                  7-Day Avg
                </span>
              </div>
              <Link
                href={`/app/${gymId}/attendance`}
                className="text-primary font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>Live Kiosk</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Financial Performance Dual-Bar Chart & 4 Metric Tiles */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-primary" />
                  Financial Performance
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Verified collections vs recorded expenses
                </p>
              </div>

              {/* 7D / 30D / 90D Selector */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border">
                {(["7D", "30D", "90D"] as TimeWindow[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setActiveWindow(w)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      activeWindow === w
                        ? "bg-card text-foreground shadow-2xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Grouped Metric Tiles */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {/* Tile 1: Collections */}
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground truncate">
                  Collections
                </div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 truncate">
                  ₹{activeFin.collections.toLocaleString("en-IN")}
                </div>
              </div>

              {/* Tile 2: Expenses */}
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground truncate">
                  Expenses
                </div>
                <div className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums mt-0.5 truncate">
                  ₹{activeFin.expenses.toLocaleString("en-IN")}
                </div>
              </div>

              {/* Tile 3: Net Cash Flow */}
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground truncate">
                  Net Cash Flow
                </div>
                <div
                  className={`text-base font-black tabular-nums mt-0.5 truncate ${
                    activeFin.netCashFlow >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  ₹{activeFin.netCashFlow.toLocaleString("en-IN")}
                </div>
              </div>

              {/* Tile 4: Pending Dues (Separated) */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 truncate">
                  Pending Dues
                </div>
                <div className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums mt-0.5 truncate">
                  ₹{activeFin.pendingDues.toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Grouped Dual-Bar Chart */}
            <FinancialDualBarChart bars={activeFin.chartBars} />

            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                  Collections
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
                  Expenses
                </span>
              </div>
              <Link
                href={`/app/${gymId}/reports`}
                className="text-primary font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>Full Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Weekly Analytics Pulse (vs Previous Week) */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Weekly Analytics Pulse
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  7-day momentum vs previous week
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Pulse 1: Revenue */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Revenue</div>
                  <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                    {weeklyPulse.revenue.currentValueFormatted}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50">
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      weeklyPulse.revenue.deltaPct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {weeklyPulse.revenue.deltaPct >= 0 ? "+" : ""}
                    {weeklyPulse.revenue.deltaPct}%
                  </span>
                  <MiniSparkline points={weeklyPulse.revenue.points} color="#10B981" />
                </div>
              </div>

              {/* Pulse 2: Expenses */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Expenses</div>
                  <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                    {weeklyPulse.expenses.currentValueFormatted}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50">
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      weeklyPulse.expenses.deltaPct <= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {weeklyPulse.expenses.deltaPct >= 0 ? "+" : ""}
                    {weeklyPulse.expenses.deltaPct}%
                  </span>
                  <MiniSparkline points={weeklyPulse.expenses.points} color="#F43F5E" />
                </div>
              </div>

              {/* Pulse 3: Member Growth */}
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Growth</div>
                  <div className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                    {weeklyPulse.memberGrowth.currentValueFormatted}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50">
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      weeklyPulse.memberGrowth.deltaPct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {weeklyPulse.memberGrowth.deltaPct >= 0 ? "+" : ""}
                    {weeklyPulse.memberGrowth.deltaPct}%
                  </span>
                  <MiniSparkline points={weeklyPulse.memberGrowth.points} color="#2563EB" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== MIDDLE COLUMN (col-span-3) ==================== */}
        {/* Membership Health & Renewals */}
        <div className="lg:col-span-3 space-y-4">
          {/* Card 1: Membership Health Donut Ring */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                Membership Health
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                {membershipHealth.totalRoster} Total
              </span>
            </div>

            <div className="flex justify-center my-2">
              <MembershipDonutChart
                activePct={membershipHealth.activePct}
                expiringPct={membershipHealth.expiringPct}
                atRiskPct={membershipHealth.atRiskPct}
                totalRoster={membershipHealth.totalRoster}
              />
            </div>

            {/* Clickable Legend Pills */}
            <div className="space-y-1.5 mt-3 pt-3 border-t border-border">
              <Link
                href={`/app/${gymId}/members?status=active`}
                className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-foreground transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Active</span>
                </div>
                <div className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                  {membershipHealth.activeCount} ({membershipHealth.activePct}%)
                </div>
              </Link>

              <Link
                href={`/app/${gymId}/memberships?status=expiring`}
                className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-foreground transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Expiring (7d)</span>
                </div>
                <div className="tabular-nums font-bold text-amber-700 dark:text-amber-400">
                  {membershipHealth.expiringCount} ({membershipHealth.expiringPct}%)
                </div>
              </Link>

              <Link
                href={`/app/${gymId}/members?status=inactive`}
                className="flex items-center justify-between p-2 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-foreground transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>At-Risk</span>
                </div>
                <div className="tabular-nums font-bold text-rose-700 dark:text-rose-400">
                  {membershipHealth.atRiskCount} ({membershipHealth.atRiskPct}%)
                </div>
              </Link>
            </div>
          </div>

          {/* Card 2: Expiring Soon List */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-foreground">Expiring Soon</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
                {expiringSoon.length} Due
              </span>
            </div>

            {expiringSoon.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  All memberships healthy!
                </p>
                <p className="text-[11px] mt-0.5">0 contracts expiring this week.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {expiringSoon.slice(0, 5).map((m) => (
                  <div key={m.memberId} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {m.fullName}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {m.planName}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 tabular-nums ${
                        m.daysLeft <= 1
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {m.daysLeft === 0
                        ? "Today"
                        : m.daysLeft === 1
                        ? "Tomorrow"
                        : `${m.daysLeft}d left`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-border">
              <Link
                href={`/app/${gymId}/memberships?status=expiring`}
                className="text-xs font-bold text-primary hover:underline flex items-center justify-between"
              >
                <span>View all expiring memberships</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN (col-span-3) ==================== */}
        {/* Operations & Quick Actions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Card 1: Quick Actions (2x2 Grid) */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <h2 className="text-sm font-bold text-foreground mb-2.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-primary" />
              Quick Actions
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {/* Action 1: Record Payment */}
              <Link
                href={`/app/${gymId}/payments`}
                className="p-2.5 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/25 transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div className="p-1.5 w-fit rounded-lg bg-emerald-500/15 text-emerald-600 mb-1">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                    Payment
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Collect fees</div>
                </div>
              </Link>

              {/* Action 2: Log Expense */}
              <Link
                href={`/app/${gymId}/expenses`}
                className="p-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/25 transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div className="p-1.5 w-fit rounded-lg bg-rose-500/15 text-rose-600 mb-1">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground group-hover:text-rose-600 transition-colors">
                    Expense
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Log bills</div>
                </div>
              </Link>

              {/* Action 3: Post Notice */}
              <Link
                href={`/app/${gymId}/notices`}
                className="p-2.5 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/25 transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div className="p-1.5 w-fit rounded-lg bg-amber-500/15 text-amber-600 mb-1">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground group-hover:text-amber-600 transition-colors">
                    Notice
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Post alert</div>
                </div>
              </Link>

              {/* Action 4: Add Member */}
              <Link
                href={`/app/${gymId}/members`}
                className="p-2.5 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/25 transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div className="p-1.5 w-fit rounded-lg bg-primary/15 text-primary mb-1">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Members
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Roster list</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Card 2: Today's Live Check-ins (Latest 5 check-ins) */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs text-card-foreground">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                Today&apos;s Live Check-Ins
              </h2>
              <span className="text-xs font-bold text-muted-foreground">
                {liveCheckIns.length} Today
              </span>
            </div>

            {liveCheckIns.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <p>No check-ins recorded yet today.</p>
                <Link
                  href={`/app/${gymId}/attendance`}
                  className="inline-flex items-center gap-1 text-primary font-bold mt-2 hover:underline"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Launch Kiosk</span>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {liveCheckIns.slice(0, 5).map((ci) => (
                  <div key={ci.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-xs border border-emerald-500/20 shrink-0">
                        {ci.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {ci.fullName}
                        </div>
                        <div className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{ci.method.replace("_", " ")}</span>
                        </div>
                      </div>
                    </div>
                    <CheckInTimeBadge isoTime={ci.checkInTime} fallback="--:--" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 pt-2 border-t border-border">
              <Link
                href={`/app/${gymId}/attendance`}
                className="text-xs font-bold text-primary hover:underline flex items-center justify-between"
              >
                <span>View all check-ins →</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. MOBILE COMPOSITION (< lg — INTENTIONAL PAIRED RHYTHM)
          ==================================================================== */}
      <div className="block lg:hidden space-y-3.5">
        {/* Step 2: Paired Columns (Quick Actions alongside Membership Health) */}
        <div className="grid grid-cols-2 gap-3 items-stretch">
          {/* Left: Quick Actions (2x2 compact tiles) */}
          <div className="bg-card border border-border rounded-xl p-3 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Actions</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Link
                href={`/app/${gymId}/payments`}
                className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex flex-col items-center text-center justify-center"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600 mb-0.5" />
                <span className="text-[10px] font-bold text-foreground">Pay</span>
              </Link>
              <Link
                href={`/app/${gymId}/expenses`}
                className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20 flex flex-col items-center text-center justify-center"
              >
                <Receipt className="w-3.5 h-3.5 text-rose-600 mb-0.5" />
                <span className="text-[10px] font-bold text-foreground">Expense</span>
              </Link>
              <Link
                href={`/app/${gymId}/notices`}
                className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 flex flex-col items-center text-center justify-center"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600 mb-0.5" />
                <span className="text-[10px] font-bold text-foreground">Notice</span>
              </Link>
              <Link
                href={`/app/${gymId}/members`}
                className="p-2 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center text-center justify-center"
              >
                <Users className="w-3.5 h-3.5 text-primary mb-0.5" />
                <span className="text-[10px] font-bold text-foreground">Members</span>
              </Link>
            </div>
          </div>

          {/* Right: Membership Health (Compact Donut + readable counts) */}
          <div className="bg-card border border-border rounded-xl p-3 shadow-xs flex flex-col justify-between items-center text-center">
            <div className="w-full flex items-center justify-between text-xs font-bold text-foreground mb-1">
              <span>Health</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {membershipHealth.totalRoster} Total
              </span>
            </div>
            <MembershipDonutChart
              activePct={membershipHealth.activePct}
              expiringPct={membershipHealth.expiringPct}
              atRiskPct={membershipHealth.atRiskPct}
              totalRoster={membershipHealth.totalRoster}
            />
            <div className="w-full grid grid-cols-3 gap-1 text-[9px] font-bold mt-2 pt-2 border-t border-border">
              <span className="text-emerald-600">{membershipHealth.activeCount} Act</span>
              <span className="text-amber-600">{membershipHealth.expiringCount} Exp</span>
              <span className="text-rose-600">{membershipHealth.atRiskCount} Risk</span>
            </div>
          </div>
        </div>

        {/* Step 3: Financial Section (2x2 grid + readable chart) & Expiring Soon */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs text-card-foreground space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              <span>Financial Overview</span>
            </div>
            {/* Window selector */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border">
              {(["7D", "30D", "90D"] as TimeWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setActiveWindow(w)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                    activeWindow === w
                      ? "bg-card text-foreground shadow-2xs border border-border"
                      : "text-muted-foreground"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* 2x2 Clean Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Collections</div>
              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                ₹{activeFin.collections.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Expenses</div>
              <div className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                ₹{activeFin.expenses.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Net Cash Flow</div>
              <div
                className={`text-sm font-black tabular-nums ${
                  activeFin.netCashFlow >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                ₹{activeFin.netCashFlow.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                Pending Dues
              </div>
              <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                ₹{activeFin.pendingDues.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Dual Bar Chart */}
          <FinancialDualBarChart bars={activeFin.chartBars} />
        </div>

        {/* Expiring Soon Mobile Card */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs text-card-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Expiring in 7 Days</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
              {expiringSoon.length} Due
            </span>
          </div>

          {expiringSoon.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              All memberships healthy — 0 expiring this week.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {expiringSoon.slice(0, 4).map((m) => (
                <div key={m.memberId} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">{m.fullName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.planName}</div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 tabular-nums ${
                      m.daysLeft <= 1
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {m.daysLeft === 0 ? "Today" : `${m.daysLeft}d left`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-border">
            <Link
              href={`/app/${gymId}/memberships?status=expiring`}
              className="text-xs font-bold text-primary hover:underline flex items-center justify-between"
            >
              <span>View all expiring memberships</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Step 4: Member Attendance (Full Width) */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs text-card-foreground">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Attendance (30 Days)</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Avg: {attendanceSeries.avg7Day}/day
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tabular-nums ${
                attendanceSeries.deltaPct >= 0
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
              }`}
            >
              {attendanceSeries.deltaPct >= 0 ? "+" : ""}
              {attendanceSeries.deltaPct}%
            </span>
          </div>
          <AttendanceAreaChart
            points={attendanceSeries.points}
            avg7Day={attendanceSeries.avg7Day}
            deltaPct={attendanceSeries.deltaPct}
          />
        </div>

        {/* Step 5: Weekly Analytics (Compact 3-Part Layout) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Revenue */}
          <div className="p-2.5 rounded-xl bg-card border border-border shadow-xs">
            <div className="text-[9px] font-bold uppercase text-muted-foreground">Rev (7d)</div>
            <div className="text-xs font-black text-foreground mt-0.5 truncate tabular-nums">
              {weeklyPulse.revenue.currentValueFormatted}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span
                className={`text-[9px] font-bold ${
                  weeklyPulse.revenue.deltaPct >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {weeklyPulse.revenue.deltaPct >= 0 ? "+" : ""}
                {weeklyPulse.revenue.deltaPct}%
              </span>
              <MiniSparkline points={weeklyPulse.revenue.points} color="#10B981" />
            </div>
          </div>

          {/* Expenses */}
          <div className="p-2.5 rounded-xl bg-card border border-border shadow-xs">
            <div className="text-[9px] font-bold uppercase text-muted-foreground">Exp (7d)</div>
            <div className="text-xs font-black text-foreground mt-0.5 truncate tabular-nums">
              {weeklyPulse.expenses.currentValueFormatted}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span
                className={`text-[9px] font-bold ${
                  weeklyPulse.expenses.deltaPct <= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {weeklyPulse.expenses.deltaPct >= 0 ? "+" : ""}
                {weeklyPulse.expenses.deltaPct}%
              </span>
              <MiniSparkline points={weeklyPulse.expenses.points} color="#F43F5E" />
            </div>
          </div>

          {/* Member Growth */}
          <div className="p-2.5 rounded-xl bg-card border border-border shadow-xs">
            <div className="text-[9px] font-bold uppercase text-muted-foreground">Growth (7d)</div>
            <div className="text-xs font-black text-foreground mt-0.5 truncate tabular-nums">
              {weeklyPulse.memberGrowth.currentValueFormatted}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span
                className={`text-[9px] font-bold ${
                  weeklyPulse.memberGrowth.deltaPct >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {weeklyPulse.memberGrowth.deltaPct >= 0 ? "+" : ""}
                {weeklyPulse.memberGrowth.deltaPct}%
              </span>
              <MiniSparkline points={weeklyPulse.memberGrowth.points} color="#2563EB" />
            </div>
          </div>
        </div>

        {/* Step 6: Today's Live Check-ins (Single Full-Width List) */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs text-card-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Today&apos;s Live Check-Ins</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {liveCheckIns.length} Entries
            </span>
          </div>

          {liveCheckIns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No check-ins yet today.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {liveCheckIns.slice(0, 5).map((ci) => (
                <div key={ci.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-[10px] border border-emerald-500/20 shrink-0">
                      {ci.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{ci.fullName}</div>
                      <div className="text-[9px] text-muted-foreground capitalize flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{ci.method.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                  <CheckInTimeBadge isoTime={ci.checkInTime} fallback="--:--" />
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-border">
            <Link
              href={`/app/${gymId}/attendance`}
              className="text-xs font-bold text-primary hover:underline flex items-center justify-between"
            >
              <span>View all check-ins →</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
