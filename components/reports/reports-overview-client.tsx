"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  CalendarCheck,
  RefreshCw,
  UserX,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  MoreVertical,
  Layers,
  ChevronRight,
  PieChart,
  Activity,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  type ReportPeriod,
  getPeriodDateRange,
  computeSafeComparison,
  downloadCSV,
  formatDisplayDate,
  getLocalTodayDateString,
} from "@/lib/reports/report-utils";
import { KpiCard } from "@/components/ui/kpi-card";

export interface OverviewMember {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  branchId: string;
  createdAt: string;
}

export interface OverviewMembership {
  id: string;
  memberId: string;
  planId?: string | null;
  planName: string;
  planPrice: number;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  branchId: string;
}

export interface OverviewAttendance {
  id: string;
  memberId: string;
  branchId: string;
  checkInDate: string;
  checkInTime?: string | null;
  checkInMethod?: string | null;
}

interface ReportsOverviewClientProps {
  gymId: string;
  gymName: string;
  activeBranchName: string;
  members: OverviewMember[];
  memberships: OverviewMembership[];
  attendance: OverviewAttendance[];
}

export function ReportsOverviewClient({
  gymId,
  gymName,
  activeBranchName,
  members,
  memberships,
  attendance,
}: ReportsOverviewClientProps) {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  // Compute local today string and date boundaries
  const todayStr = useMemo(() => getLocalTodayDateString("Asia/Kolkata"), []);
  const dateRange = useMemo(() => getPeriodDateRange(period, "Asia/Kolkata"), [period]);

  // Seven days from today for "Expiring Soon"
  const sevenDaysLaterStr = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + 7));
    return date.toISOString().slice(0, 10);
  }, [todayStr]);

  // Eligible Active Members (snapshot for branch)
  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status === "active");
  }, [members]);

  const activeMemberIds = useMemo(() => {
    return new Set(activeMembers.map((m) => m.id));
  }, [activeMembers]);

  // Attendance in Current Period
  const periodAttendance = useMemo(() => {
    return attendance.filter(
      (a) => a.checkInDate >= dateRange.startDate && a.checkInDate <= dateRange.endDate
    );
  }, [attendance, dateRange]);

  // Attendance in Prior Period
  const priorPeriodAttendance = useMemo(() => {
    if (!dateRange.priorStartDate || !dateRange.priorEndDate) return [];
    return attendance.filter(
      (a) =>
        a.checkInDate >= (dateRange.priorStartDate as string) &&
        a.checkInDate <= (dateRange.priorEndDate as string)
    );
  }, [attendance, dateRange]);

  // Unique active members attended in current period
  const attendedActiveMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of periodAttendance) {
      if (activeMemberIds.has(a.memberId)) {
        ids.add(a.memberId);
      }
    }
    return ids;
  }, [periodAttendance, activeMemberIds]);

  // Unique active members attended in prior period
  const priorAttendedActiveMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of priorPeriodAttendance) {
      if (activeMemberIds.has(a.memberId)) {
        ids.add(a.memberId);
      }
    }
    return ids;
  }, [priorPeriodAttendance, activeMemberIds]);

  // 1. KPI: Attendance Rate
  const attendanceRate = useMemo(() => {
    if (activeMembers.length === 0) return 0;
    return Math.round((attendedActiveMemberIds.size / activeMembers.length) * 100);
  }, [attendedActiveMemberIds, activeMembers]);

  const priorAttendanceRate = useMemo(() => {
    if (activeMembers.length === 0 || !dateRange.priorStartDate) return null;
    return Math.round((priorAttendedActiveMemberIds.size / activeMembers.length) * 100);
  }, [priorAttendedActiveMemberIds, activeMembers, dateRange]);

  const attendanceComparison = useMemo(() => {
    return computeSafeComparison(attendanceRate, priorAttendanceRate);
  }, [attendanceRate, priorAttendanceRate]);

  // 2. KPI: Renewal Rate
  // Memberships expiring/ending in current period
  const eligibleRenewals = useMemo(() => {
    return memberships.filter(
      (m) => m.endDate >= dateRange.startDate && m.endDate <= dateRange.endDate
    );
  }, [memberships, dateRange]);

  // Renewed memberships in period: either status is 'renewed' or another membership for same member exists starting near or after end date
  const renewedCount = useMemo(() => {
    return eligibleRenewals.filter((m) => {
      if (m.status === "renewed") return true;
      // Check if member has another membership that starts >= this membership's start date
      return memberships.some(
        (other) =>
          other.id !== m.id &&
          other.memberId === m.memberId &&
          other.startDate >= m.endDate
      );
    }).length;
  }, [eligibleRenewals, memberships]);

  const renewalRate = useMemo(() => {
    if (eligibleRenewals.length === 0) return 0;
    return Math.round((renewedCount / eligibleRenewals.length) * 100);
  }, [eligibleRenewals, renewedCount]);

  // Prior period eligible renewals
  const priorEligibleRenewals = useMemo(() => {
    if (!dateRange.priorStartDate || !dateRange.priorEndDate) return [];
    return memberships.filter(
      (m) =>
        m.endDate >= (dateRange.priorStartDate as string) &&
        m.endDate <= (dateRange.priorEndDate as string)
    );
  }, [memberships, dateRange]);

  const priorRenewedCount = useMemo(() => {
    return priorEligibleRenewals.filter((m) => {
      if (m.status === "renewed") return true;
      return memberships.some(
        (other) =>
          other.id !== m.id &&
          other.memberId === m.memberId &&
          other.startDate >= m.endDate
      );
    }).length;
  }, [priorEligibleRenewals, memberships]);

  const priorRenewalRate = useMemo(() => {
    if (priorEligibleRenewals.length === 0 || !dateRange.priorStartDate) return null;
    return Math.round((priorRenewedCount / priorEligibleRenewals.length) * 100);
  }, [priorEligibleRenewals, priorRenewedCount, dateRange]);

  const renewalComparison = useMemo(() => {
    return computeSafeComparison(renewalRate, priorRenewalRate);
  }, [renewalRate, priorRenewalRate]);

  // 3. KPI: Inactive Members (Active members with 0 valid visits in period)
  const inactiveMembers = useMemo(() => {
    return activeMembers.filter((m) => !attendedActiveMemberIds.has(m.id));
  }, [activeMembers, attendedActiveMemberIds]);

  // 4. KPI: Expiring Soon (Active memberships expiring in next 7 days)
  const expiringSoonMemberships = useMemo(() => {
    return memberships.filter(
      (m) =>
        m.status === "active" &&
        m.endDate >= todayStr &&
        m.endDate <= sevenDaysLaterStr
    );
  }, [memberships, todayStr, sevenDaysLaterStr]);

  // -------------------------------------------------------------
  // CHART 1: ATTENDANCE TREND (Area Chart data)
  // -------------------------------------------------------------
  const trendData = useMemo(() => {
    if (period === "today") {
      // 2-hour slots from 6 AM to 10 PM
      const slots = [
        { label: "6 AM", startH: 6, endH: 8, count: 0 },
        { label: "8 AM", startH: 8, endH: 10, count: 0 },
        { label: "10 AM", startH: 10, endH: 12, count: 0 },
        { label: "12 PM", startH: 12, endH: 14, count: 0 },
        { label: "2 PM", startH: 14, endH: 16, count: 0 },
        { label: "4 PM", startH: 16, endH: 18, count: 0 },
        { label: "6 PM", startH: 18, endH: 20, count: 0 },
        { label: "8 PM", startH: 20, endH: 22, count: 0 },
      ];

      for (const a of periodAttendance) {
        if (!a.checkInTime) {
          slots[3].count += 1; // default to midday
          continue;
        }
        const hour = parseInt(a.checkInTime.split(":")[0], 10);
        const slot = slots.find((s) => hour >= s.startH && hour < s.endH);
        if (slot) {
          slot.count += 1;
        } else if (hour < 6) {
          slots[0].count += 1;
        } else {
          slots[slots.length - 1].count += 1;
        }
      }
      return slots.map((s) => ({ label: s.label, count: s.count }));
    }

    if (period === "weekly") {
      // Mon to Sun of the current week
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const countsByDay: { [key: string]: number } = {};
      const labels: string[] = [];

      const [sy, sm, sd] = dateRange.startDate.split("-").map(Number);
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.UTC(sy, sm - 1, sd + i));
        const dateKey = d.toISOString().slice(0, 10);
        countsByDay[dateKey] = 0;
        labels.push(days[i]);
      }

      for (const a of periodAttendance) {
        if (countsByDay[a.checkInDate] !== undefined) {
          countsByDay[a.checkInDate] += 1;
        }
      }

      const keys = Object.keys(countsByDay).sort();
      return keys.map((k, idx) => ({
        label: labels[idx] || k.slice(8),
        count: countsByDay[k],
      }));
    }

    if (period === "all_time") {
      // Last 6 months aggregated
      const monthBuckets: { [key: string]: number } = {};
      const labels: { [key: string]: string } = {};

      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
        const key = d.toISOString().slice(0, 7); // YYYY-MM
        monthBuckets[key] = 0;
        labels[key] = d.toLocaleString("default", { month: "short" });
      }

      for (const a of attendance) {
        const key = a.checkInDate.slice(0, 7);
        if (monthBuckets[key] !== undefined) {
          monthBuckets[key] += 1;
        }
      }

      return Object.keys(monthBuckets).map((key) => ({
        label: labels[key],
        count: monthBuckets[key],
      }));
    }

    // "monthly" or "last_month": Group by date or interval
    const countsByDate: { [key: string]: number } = {};
    const [sy, sm, sd] = dateRange.startDate.split("-").map(Number);
    const [ey, em, ed] = dateRange.endDate.split("-").map(Number);

    const startUtc = new Date(Date.UTC(sy, sm - 1, sd));
    const endUtc = new Date(Date.UTC(ey, em - 1, ed));
    const totalDays = Math.max(1, Math.round((endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    for (let i = 0; i < totalDays; i++) {
      const cur = new Date(Date.UTC(sy, sm - 1, sd + i));
      const key = cur.toISOString().slice(0, 10);
      countsByDate[key] = 0;
    }

    for (const a of periodAttendance) {
      if (countsByDate[a.checkInDate] !== undefined) {
        countsByDate[a.checkInDate] += 1;
      }
    }

    const sortedKeys = Object.keys(countsByDate).sort();
    return sortedKeys.map((k) => ({
      label: String(parseInt(k.slice(8), 10)),
      count: countsByDate[k],
    }));
  }, [period, periodAttendance, attendance, dateRange]);

  const totalVisits = useMemo(() => {
    return periodAttendance.length;
  }, [periodAttendance]);

  const priorTotalVisits = useMemo(() => {
    return priorPeriodAttendance.length;
  }, [priorPeriodAttendance]);

  const visitsComparison = useMemo(() => {
    return computeSafeComparison(totalVisits, priorTotalVisits);
  }, [totalVisits, priorTotalVisits]);

  // SVG Area Chart Calculations
  const chartSvg = useMemo(() => {
    const width = 600;
    const height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 35 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    if (trendData.length === 0) {
      return { width, height, points: [], areaPath: "", linePath: "", maxVal: 0, padding, innerW, innerH };
    }

    const counts = trendData.map((d) => d.count);
    const maxVal = Math.max(5, ...counts);

    const points = trendData.map((d, i) => {
      const x = padding.left + (trendData.length > 1 ? (i / (trendData.length - 1)) * innerW : innerW / 2);
      const y = padding.top + innerH - (d.count / maxVal) * innerH;
      return { x, y, ...d };
    });

    const linePointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
    const linePath = `M ${linePointsStr}`;
    const areaPath = `M ${linePointsStr} L ${points[points.length - 1].x.toFixed(1)},${(padding.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)},${(padding.top + innerH).toFixed(1)} Z`;

    return { width, height, points, areaPath, linePath, maxVal, padding, innerW, innerH };
  }, [trendData]);

  // -------------------------------------------------------------
  // CHART 2: MEMBERSHIP DISTRIBUTION (Donut Chart data)
  // -------------------------------------------------------------
  const distributionData = useMemo(() => {
    const activeCount = memberships.filter((m) => m.status === "active").length;
    const expiredCount = memberships.filter((m) => m.status === "expired" || m.status === "cancelled").length;
    const frozenCount = memberships.filter((m) => m.status === "frozen" || m.status === "suspended").length;
    const total = activeCount + expiredCount + frozenCount;

    return {
      total,
      active: { count: activeCount, pct: total > 0 ? Math.round((activeCount / total) * 100) : 0 },
      expired: { count: expiredCount, pct: total > 0 ? Math.round((expiredCount / total) * 100) : 0 },
      frozen: { count: frozenCount, pct: total > 0 ? Math.round((frozenCount / total) * 100) : 0 },
    };
  }, [memberships]);

  // SVG Donut calculation
  const donutSvg = useMemo(() => {
    const size = 180;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = distributionData.total;

    if (total === 0) {
      return {
        size,
        radius,
        circumference,
        segments: [],
      };
    }

    const activeLength = (distributionData.active.count / total) * circumference;
    const expiredLength = (distributionData.expired.count / total) * circumference;
    const frozenLength = (distributionData.frozen.count / total) * circumference;

    let offset = 0;
    const segments = [
      {
        id: "active",
        color: "var(--primary)",
        dasharray: `${activeLength} ${circumference - activeLength}`,
        dashoffset: -offset,
      },
      {
        id: "expired",
        color: "#94a3b8", // slate
        dasharray: `${expiredLength} ${circumference - expiredLength}`,
        dashoffset: -(offset += activeLength),
      },
      {
        id: "frozen",
        color: "#38bdf8", // sky
        dasharray: `${frozenLength} ${circumference - frozenLength}`,
        dashoffset: -(offset += expiredLength),
      },
    ];

    return {
      size,
      radius,
      circumference,
      segments,
    };
  }, [distributionData]);

  // -------------------------------------------------------------
  // CHART 3: MEMBER ENGAGEMENT (Horizontal Bars data)
  // -------------------------------------------------------------
  const engagementData = useMemo(() => {
    const memberVisitCounts = new Map<string, number>();
    for (const a of periodAttendance) {
      if (activeMemberIds.has(a.memberId)) {
        memberVisitCounts.set(a.memberId, (memberVisitCounts.get(a.memberId) || 0) + 1);
      }
    }

    let regular = 0; // 5+
    let occasional = 0; // 1-4
    let noVisits = 0; // 0

    for (const m of activeMembers) {
      const count = memberVisitCounts.get(m.id) || 0;
      if (count >= 5) regular++;
      else if (count >= 1) occasional++;
      else noVisits++;
    }

    const total = activeMembers.length;
    return {
      total,
      regular: { count: regular, pct: total > 0 ? Math.round((regular / total) * 100) : 0 },
      occasional: { count: occasional, pct: total > 0 ? Math.round((occasional / total) * 100) : 0 },
      noVisits: { count: noVisits, pct: total > 0 ? Math.round((noVisits / total) * 100) : 0 },
    };
  }, [periodAttendance, activeMembers, activeMemberIds]);

  // -------------------------------------------------------------
  // CSV Export & Print PDF
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    const headers = [
      "Metric / Category",
      "Current Value",
      "Raw Counts / Ratio",
      "Prior Value",
      "Change",
      "Period",
      "Branch",
    ];

    const rows = [
      [
        "Attendance Rate",
        `${attendanceRate}%`,
        `${attendedActiveMemberIds.size} / ${activeMembers.length} active members`,
        priorAttendanceRate !== null ? `${priorAttendanceRate}%` : "—",
        attendanceComparison.label,
        dateRange.label,
        activeBranchName,
      ],
      [
        "Renewal Rate",
        eligibleRenewals.length > 0 ? `${renewalRate}%` : "—",
        `${renewedCount} / ${eligibleRenewals.length} renewals`,
        priorRenewalRate !== null ? `${priorRenewalRate}%` : "—",
        renewalComparison.label,
        dateRange.label,
        activeBranchName,
      ],
      [
        "Inactive Members",
        inactiveMembers.length,
        `${inactiveMembers.length} with 0 visits in period`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Expiring Soon (Next 7 Days)",
        expiringSoonMemberships.length,
        `${expiringSoonMemberships.length} memberships`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Total Period Check-ins",
        totalVisits,
        `${totalVisits} visits`,
        priorTotalVisits,
        visitsComparison.label,
        dateRange.label,
        activeBranchName,
      ],
      [
        "Engagement: Regular (5+ visits)",
        engagementData.regular.count,
        `${engagementData.regular.pct}% of active`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Engagement: Occasional (1-4 visits)",
        engagementData.occasional.count,
        `${engagementData.occasional.pct}% of active`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Engagement: No Visits (0 visits)",
        engagementData.noVisits.count,
        `${engagementData.noVisits.pct}% of active`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Memberships: Active",
        distributionData.active.count,
        `${distributionData.active.pct}%`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Memberships: Expired / Cancelled",
        distributionData.expired.count,
        `${distributionData.expired.pct}%`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
      [
        "Memberships: Frozen / Suspended",
        distributionData.frozen.count,
        `${distributionData.frozen.pct}%`,
        "—",
        "—",
        dateRange.label,
        activeBranchName,
      ],
    ];

    const filename = `GymApra_Reports_${activeBranchName.replace(/\s+/g, "_")}_${period}_${todayStr}.csv`;
    downloadCSV(filename, headers, rows);
    setMobileMenuOpen(false);
  };

  const handlePrintPDF = () => {
    setMobileMenuOpen(false);
    window.print();
  };

  const totalActionsCount = inactiveMembers.length + expiringSoonMemberships.length;

  return (
    <div className="space-y-6 pb-12">
      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block mb-6 p-4 border border-black/20 rounded-lg">
        <h1 className="text-2xl font-bold text-black">{gymName} — Activity & Operations Report</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Branch: {activeBranchName} | Period: {dateRange.label} ({dateRange.startDate} to {dateRange.endDate}) | Generated: {todayStr}
        </p>
      </div>

      {/* HEADER ROW */}
      <div className="flex items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gym performance at a glance</p>
        </div>

        {/* Desktop Buttons (>= sm) */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/60 text-foreground transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Export CSV
          </button>
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/60 text-foreground transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            Print PDF
          </button>
        </div>

        {/* Mobile Dropdown (< sm) */}
        <div className="relative sm:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="More options"
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {mobileMenuOpen && (
            <div className="absolute right-0 mt-1 w-44 rounded-xl border border-border bg-card shadow-lg py-1 z-30 animate-in fade-in zoom-in-95">
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors text-left"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                Export CSV
              </button>
              <button
                onClick={handlePrintPDF}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors text-left"
              >
                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                Print PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONTROL BAR (Period Selector + Financial Reports Link) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
        {/* Desktop Period Pills */}
        <div className="hidden sm:inline-flex items-center p-1 rounded-xl bg-card border border-border gap-1 shadow-xs">
          {(
            [
              { id: "today", label: "Today" },
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
              { id: "last_month", label: "Last Month" },
              { id: "all_time", label: "All Time" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                period === item.id
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Mobile Period Dropdown */}
        <div className="sm:hidden w-full">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="today">Today</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="last_month">Last Month</option>
            <option value="all_time">All Time</option>
          </select>
        </div>

        {/* Prominent Financial Reports Link */}
        <Link
          href={`/app/${gymId}/reports/financial`}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 transition-all shadow-xs shrink-0 group"
        >
          <span>Financial Reports</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 4 RATE & ACTION KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          variant="blue"
          icon={<CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={
            dateRange.priorStartDate ? (
              <span
                className={`text-[11px] font-medium flex items-center tabular-nums ${
                  attendanceComparison.isUp
                    ? "text-emerald-600 [.dark_&]:text-emerald-400"
                    : attendanceComparison.isDown
                    ? "text-rose-500"
                    : "text-muted-foreground"
                }`}
              >
                {attendanceComparison.isUp && <TrendingUp className="w-3 h-3 mr-0.5" />}
                {attendanceComparison.isDown && <TrendingDown className="w-3 h-3 mr-0.5" />}
                {attendanceComparison.label}
              </span>
            ) : undefined
          }
          subtext={`${attendedActiveMemberIds.size} / ${activeMembers.length} active`}
        />

        <KpiCard
          label="Renewal Rate"
          value={eligibleRenewals.length > 0 ? `${renewalRate}%` : "—"}
          variant="green"
          icon={<RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={
            dateRange.priorStartDate && eligibleRenewals.length > 0 ? (
              <span
                className={`text-[11px] font-medium flex items-center tabular-nums ${
                  renewalComparison.isUp
                    ? "text-emerald-600 [.dark_&]:text-emerald-400"
                    : renewalComparison.isDown
                    ? "text-rose-500"
                    : "text-muted-foreground"
                }`}
              >
                {renewalComparison.isUp && <TrendingUp className="w-3 h-3 mr-0.5" />}
                {renewalComparison.isDown && <TrendingDown className="w-3 h-3 mr-0.5" />}
                {renewalComparison.label}
              </span>
            ) : undefined
          }
          subtext={`${renewedCount} / ${eligibleRenewals.length} renewed`}
        />

        <KpiCard
          label="Inactive Members"
          value={inactiveMembers.length}
          variant="amber"
          icon={<UserX className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={
            <span className="text-[11px] text-muted-foreground tabular-nums">
              ({activeMembers.length > 0 ? Math.round((inactiveMembers.length / activeMembers.length) * 100) : 0}%)
            </span>
          }
          subtext="0 visits in selected period"
        />

        <KpiCard
          label="Expiring Soon"
          value={expiringSoonMemberships.length}
          variant="purple"
          icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={<span className="text-[11px] font-medium text-rose-500">Next 7 days</span>}
          subtext="Active memberships expiring"
          href={`/app/${gymId}/follow-ups`}
        />
      </div>

      {/* 3 VISUAL CHARTS (Pure SVG / Tailwind — Zero External Chart Libraries) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CHART 1: ATTENDANCE TREND (Full Width on desktop) */}
        <div className="col-span-full bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Attendance Trend</h2>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {dateRange.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check-in distribution across {dateRange.label.toLowerCase()}
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums text-foreground tracking-tight">
                {totalVisits}
              </span>
              <span className="text-xs text-muted-foreground">total visits</span>
              {dateRange.priorStartDate && (
                <span
                  className={`text-xs font-medium flex items-center tabular-nums ml-2 ${
                    visitsComparison.isUp
                      ? "text-emerald-600 dark:text-emerald-400"
                      : visitsComparison.isDown
                      ? "text-rose-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {visitsComparison.isUp && <TrendingUp className="w-3.5 h-3.5 mr-0.5" />}
                  {visitsComparison.isDown && <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                  {visitsComparison.label} {dateRange.comparisonLabel}
                </span>
              )}
            </div>
          </div>

          {/* SVG Area Chart */}
          <div className="mt-4 w-full overflow-hidden">
            {chartSvg.points.length > 0 && totalVisits > 0 ? (
              <svg
                viewBox={`0 0 ${chartSvg.width} ${chartSvg.height}`}
                className="w-full h-44 sm:h-52 overflow-visible select-none"
              >
                <defs>
                  <linearGradient id="attendance-area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line
                  x1={chartSvg.padding.left}
                  y1={chartSvg.padding.top}
                  x2={chartSvg.width - chartSvg.padding.right}
                  y2={chartSvg.padding.top}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
                <line
                  x1={chartSvg.padding.left}
                  y1={chartSvg.padding.top + chartSvg.innerH / 2}
                  x2={chartSvg.width - chartSvg.padding.right}
                  y2={chartSvg.padding.top + chartSvg.innerH / 2}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
                <line
                  x1={chartSvg.padding.left}
                  y1={chartSvg.padding.top + chartSvg.innerH}
                  x2={chartSvg.width - chartSvg.padding.right}
                  y2={chartSvg.padding.top + chartSvg.innerH}
                  stroke="var(--border)"
                  strokeOpacity="0.9"
                />

                {/* Y-axis Ticks */}
                <text
                  x={chartSvg.padding.left - 6}
                  y={chartSvg.padding.top + 4}
                  textAnchor="end"
                  className="text-[10px] fill-muted-foreground font-mono"
                >
                  {chartSvg.maxVal}
                </text>
                <text
                  x={chartSvg.padding.left - 6}
                  y={chartSvg.padding.top + chartSvg.innerH / 2 + 3}
                  textAnchor="end"
                  className="text-[10px] fill-muted-foreground font-mono"
                >
                  {Math.round(chartSvg.maxVal / 2)}
                </text>
                <text
                  x={chartSvg.padding.left - 6}
                  y={chartSvg.padding.top + chartSvg.innerH + 3}
                  textAnchor="end"
                  className="text-[10px] fill-muted-foreground font-mono"
                >
                  0
                </text>

                {/* Area Gradient Fill */}
                <path d={chartSvg.areaPath} fill="url(#attendance-area-grad)" />

                {/* Line Path */}
                <path
                  d={chartSvg.linePath}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Dots & X-axis Labels */}
                {chartSvg.points.map((p, idx) => {
                  // Show fewer labels on small screens or large datasets to avoid clutter
                  const showLabel =
                    chartSvg.points.length <= 8 ||
                    idx === 0 ||
                    idx === chartSvg.points.length - 1 ||
                    idx % Math.ceil(chartSvg.points.length / 6) === 0;

                  return (
                    <g key={idx} className="group cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="3.5"
                        fill="var(--card)"
                        stroke="var(--primary)"
                        strokeWidth="2"
                        className="transition-transform duration-150 group-hover:scale-150"
                      />
                      {showLabel && (
                        <text
                          x={p.x}
                          y={chartSvg.padding.top + chartSvg.innerH + 18}
                          textAnchor="middle"
                          className="text-[10px] fill-muted-foreground font-mono"
                        >
                          {p.label}
                        </text>
                      )}
                      <title>{`${p.label}: ${p.count} visits`}</title>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Activity className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No visits recorded in this period</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Try switching the period filter above to inspect earlier activity.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: MEMBERSHIP DISTRIBUTION (Donut Chart) */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">Membership Distribution</h2>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {distributionData.total} Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active, expired, and frozen contracts snapshot
            </p>
          </div>

          <div className="my-5 flex flex-col sm:flex-row items-center justify-center sm:justify-around gap-6">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              {distributionData.total > 0 ? (
                <svg
                  viewBox={`0 0 ${donutSvg.size} ${donutSvg.size}`}
                  className="w-full h-full -rotate-90 transform overflow-visible"
                >
                  {/* Background Track */}
                  <circle
                    cx={donutSvg.size / 2}
                    cy={donutSvg.size / 2}
                    r={donutSvg.radius}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="20"
                    opacity="0.35"
                  />
                  {donutSvg.segments.map((seg) => (
                    <circle
                      key={seg.id}
                      cx={donutSvg.size / 2}
                      cy={donutSvg.size / 2}
                      r={donutSvg.radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="20"
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.dashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  ))}
                </svg>
              ) : (
                <div className="w-full h-full rounded-full border-4 border-dashed border-border flex items-center justify-center" />
              )}
              {/* Donut Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
                  {distributionData.active.count}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">
                  Active
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2.5 w-full sm:w-auto">
              {/* Active */}
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground">Active</span>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-xs font-bold text-foreground">
                    {distributionData.active.count}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    ({distributionData.active.pct}%)
                  </span>
                </div>
              </div>

              {/* Expired */}
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-foreground">Expired</span>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-xs font-bold text-foreground">
                    {distributionData.expired.count}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    ({distributionData.expired.pct}%)
                  </span>
                </div>
              </div>

              {/* Frozen */}
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-sky-400 shrink-0" />
                  <span className="text-xs font-medium text-foreground">Frozen</span>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-xs font-bold text-foreground">
                    {distributionData.frozen.count}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    ({distributionData.frozen.pct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 text-right">
            <Link
              href={`/app/${gymId}/memberships`}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Manage all memberships <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* CHART 3: MEMBER ENGAGEMENT (Horizontal Bars) */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">Member Engagement</h2>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {engagementData.total} Active Members
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Visit frequency breakdown for {dateRange.label.toLowerCase()}
            </p>
          </div>

          <div className="my-5 space-y-4">
            {/* Regular (5+ visits) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Regular (5+ visits)
                </span>
                <span className="tabular-nums font-semibold text-foreground">
                  {engagementData.regular.count}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({engagementData.regular.pct}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${engagementData.regular.pct}%` }}
                />
              </div>
            </div>

            {/* Occasional (1-4 visits) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Occasional (1–4 visits)
                </span>
                <span className="tabular-nums font-semibold text-foreground">
                  {engagementData.occasional.count}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({engagementData.occasional.pct}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${engagementData.occasional.pct}%` }}
                />
              </div>
            </div>

            {/* No Visits (0 visits) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  No Visits (0 visits)
                </span>
                <span className="tabular-nums font-semibold text-foreground">
                  {engagementData.noVisits.count}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({engagementData.noVisits.pct}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${engagementData.noVisits.pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 text-right">
            <Link
              href={`/app/${gymId}/members`}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View member directory <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* NEEDS ATTENTION (Bottom Action Card) */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
          </div>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums">
            {totalActionsCount} actions
          </span>
        </div>

        <div className="divide-y divide-border/60 mt-1">
          {/* Row 1: Inactive Members */}
          <Link
            href={`/app/${gymId}/members`}
            className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {inactiveMembers.length} inactive members
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and follow up with members who haven&apos;t visited in {dateRange.label.toLowerCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>Review list</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Row 2: Expiring Soon */}
          <Link
            href={`/app/${gymId}/memberships`}
            className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {expiringSoonMemberships.length} expiring memberships
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review upcoming contract expirations in the next 7 days and trigger renewals
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>Review expirations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
