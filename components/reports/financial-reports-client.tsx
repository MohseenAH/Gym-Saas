"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Download,
  Printer,
  MoreVertical,
  ChevronRight,
  Receipt,
  Tag,
  CreditCard,
  Building2,
  Clock,
  ArrowLeft,
  PieChart,
  Wallet,
  AlertCircle,
} from "lucide-react";
import {
  type ReportPeriod,
  getPeriodDateRange,
  computeSafeComparison,
  downloadCSV,
  formatRupees,
  formatDisplayDate,
  getLocalTodayDateString,
} from "@/lib/reports/report-utils";
import { KpiCard } from "@/components/ui/kpi-card";

export interface FinancialPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string; // 'paid' | 'partial' | 'pending' | 'refunded' | 'rejected'
  paymentDate: string; // YYYY-MM-DD
  membershipId?: string | null;
  memberName: string;
  memberPhone?: string | null;
  branchId: string;
}

export interface FinancialExpense {
  id: string;
  amount: number;
  category: string;
  expenseDate: string; // YYYY-MM-DD
  paymentMethod: string;
  description?: string | null;
  branchId: string;
}

export interface FinancialMembership {
  id: string;
  memberId: string;
  memberName: string;
  planId?: string | null;
  planName: string;
  planPrice: number;
  startDate: string;
  endDate: string;
  status: string;
  branchId: string;
  paidAmount: number;
  dueAmount: number;
}

interface FinancialReportsClientProps {
  gymId: string;
  gymName: string;
  activeBranchName: string;
  payments: FinancialPayment[];
  expenses: FinancialExpense[];
  memberships: FinancialMembership[];
}

export function FinancialReportsClient({
  gymId,
  gymName,
  activeBranchName,
  payments,
  expenses,
  memberships,
}: FinancialReportsClientProps) {
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

  const todayStr = useMemo(() => getLocalTodayDateString("Asia/Kolkata"), []);
  const dateRange = useMemo(() => getPeriodDateRange(period, "Asia/Kolkata"), [period]);

  // Payments in Current Period
  const periodPayments = useMemo(() => {
    return payments.filter(
      (p) => p.paymentDate >= dateRange.startDate && p.paymentDate <= dateRange.endDate
    );
  }, [payments, dateRange]);

  // Payments in Prior Period
  const priorPeriodPayments = useMemo(() => {
    if (!dateRange.priorStartDate || !dateRange.priorEndDate) return [];
    return payments.filter(
      (p) =>
        p.paymentDate >= (dateRange.priorStartDate as string) &&
        p.paymentDate <= (dateRange.priorEndDate as string)
    );
  }, [payments, dateRange]);

  // Expenses in Current Period
  const periodExpenses = useMemo(() => {
    return expenses.filter(
      (e) => e.expenseDate >= dateRange.startDate && e.expenseDate <= dateRange.endDate
    );
  }, [expenses, dateRange]);

  // Expenses in Prior Period
  const priorPeriodExpenses = useMemo(() => {
    if (!dateRange.priorStartDate || !dateRange.priorEndDate) return [];
    return expenses.filter(
      (e) =>
        e.expenseDate >= (dateRange.priorStartDate as string) &&
        e.expenseDate <= (dateRange.priorEndDate as string)
    );
  }, [expenses, dateRange]);

  // -------------------------------------------------------------
  // KPI 1: TOTAL COLLECTIONS (Verified minus refunded)
  // -------------------------------------------------------------
  const totalCollections = useMemo(() => {
    let sum = 0;
    for (const p of periodPayments) {
      if (p.paymentStatus === "paid" || p.paymentStatus === "partial") {
        sum += p.amount;
      } else if (p.paymentStatus === "refunded") {
        sum -= p.amount;
      }
    }
    return Math.max(0, sum);
  }, [periodPayments]);

  const priorTotalCollections = useMemo(() => {
    if (!dateRange.priorStartDate) return null;
    let sum = 0;
    for (const p of priorPeriodPayments) {
      if (p.paymentStatus === "paid" || p.paymentStatus === "partial") {
        sum += p.amount;
      } else if (p.paymentStatus === "refunded") {
        sum -= p.amount;
      }
    }
    return Math.max(0, sum);
  }, [priorPeriodPayments, dateRange]);

  const collectionsComparison = useMemo(() => {
    return computeSafeComparison(totalCollections, priorTotalCollections);
  }, [totalCollections, priorTotalCollections]);

  // -------------------------------------------------------------
  // KPI 2: TOTAL EXPENSES
  // -------------------------------------------------------------
  const totalExpenses = useMemo(() => {
    return periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [periodExpenses]);

  const priorTotalExpenses = useMemo(() => {
    if (!dateRange.priorStartDate) return null;
    return priorPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [priorPeriodExpenses, dateRange]);

  const expensesComparison = useMemo(() => {
    return computeSafeComparison(totalExpenses, priorTotalExpenses);
  }, [totalExpenses, priorTotalExpenses]);

  // -------------------------------------------------------------
  // KPI 3: OPERATING DIFFERENCE (Collections - Expenses)
  // -------------------------------------------------------------
  const operatingDifference = useMemo(() => {
    return totalCollections - totalExpenses;
  }, [totalCollections, totalExpenses]);

  const priorOperatingDifference = useMemo(() => {
    if (priorTotalCollections === null || priorTotalExpenses === null) return null;
    return priorTotalCollections - priorTotalExpenses;
  }, [priorTotalCollections, priorTotalExpenses]);

  const opDiffComparison = useMemo(() => {
    return computeSafeComparison(operatingDifference, priorOperatingDifference);
  }, [operatingDifference, priorOperatingDifference]);

  // -------------------------------------------------------------
  // KPI 4: PENDING DUES (Current Snapshot, not filtered by period)
  // -------------------------------------------------------------
  const totalPendingDues = useMemo(() => {
    return memberships.reduce((sum, m) => sum + m.dueAmount, 0);
  }, [memberships]);

  const totalMembersWithDues = useMemo(() => {
    return memberships.filter((m) => m.dueAmount > 0).length;
  }, [memberships]);

  // -------------------------------------------------------------
  // SECTION 1: INCOME VS EXPENSES COMPARISON
  // -------------------------------------------------------------
  const maxRupeeScale = useMemo(() => {
    return Math.max(totalCollections, totalExpenses, 1000);
  }, [totalCollections, totalExpenses]);

  const incomePct = useMemo(() => {
    return Math.min(100, Math.round((totalCollections / maxRupeeScale) * 100));
  }, [totalCollections, maxRupeeScale]);

  const expensePct = useMemo(() => {
    return Math.min(100, Math.round((totalExpenses / maxRupeeScale) * 100));
  }, [totalExpenses, maxRupeeScale]);

  // -------------------------------------------------------------
  // SECTION 2: COLLECTIONS BY PAYMENT METHOD (Donut Chart)
  // -------------------------------------------------------------
  const paymentMethodData = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();

    for (const p of periodPayments) {
      if (p.paymentStatus === "paid" || p.paymentStatus === "partial") {
        const method = p.paymentMethod ? p.paymentMethod.toUpperCase() : "OTHER";
        const current = map.get(method) || { amount: 0, count: 0 };
        map.set(method, {
          amount: current.amount + p.amount,
          count: current.count + 1,
        });
      }
    }

    const total = Array.from(map.values()).reduce((sum, v) => sum + v.amount, 0);

    const items = Array.from(map.entries())
      .map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count,
        pct: total > 0 ? Math.round((data.amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { total, items };
  }, [periodPayments]);

  // Donut SVG calculations for payment methods
  const methodDonutSvg = useMemo(() => {
    const size = 170;
    const strokeWidth = 22;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = paymentMethodData.total;

    if (total === 0 || paymentMethodData.items.length === 0) {
      return { size, radius, circumference, segments: [] };
    }

    const colors = [
      "var(--primary)",
      "#38bdf8", // sky
      "#f59e0b", // amber
      "#a855f7", // purple
      "#ec4899", // pink
      "#64748b", // slate
    ];

    let offset = 0;
    const segments = paymentMethodData.items.map((item, index) => {
      const length = (item.amount / total) * circumference;
      const seg = {
        method: item.method,
        color: colors[index % colors.length],
        dasharray: `${length} ${circumference - length}`,
        dashoffset: -offset,
      };
      offset += length;
      return seg;
    });

    return { size, radius, circumference, segments };
  }, [paymentMethodData]);

  // -------------------------------------------------------------
  // SECTION 3: EXPENSE BREAKDOWN (Horizontal Bars)
  // -------------------------------------------------------------
  const expenseCategoryData = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();

    for (const e of periodExpenses) {
      const cat = e.category || "General";
      const current = map.get(cat) || { amount: 0, count: 0 };
      map.set(cat, {
        amount: current.amount + e.amount,
        count: current.count + 1,
      });
    }

    const total = Array.from(map.values()).reduce((sum, v) => sum + v.amount, 0);

    const items = Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        pct: total > 0 ? Math.round((data.amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { total, items };
  }, [periodExpenses]);

  // -------------------------------------------------------------
  // SECTION 4: PENDING DUES BY MEMBERSHIP PLAN (Horizontal Bars)
  // -------------------------------------------------------------
  const planDuesData = useMemo(() => {
    const map = new Map<string, { dueAmount: number; memberCount: number }>();

    for (const m of memberships) {
      if (m.dueAmount > 0) {
        const planName = m.planName ? m.planName.trim() : "Uncategorized";
        const current = map.get(planName) || { dueAmount: 0, memberCount: 0 };
        map.set(planName, {
          dueAmount: current.dueAmount + m.dueAmount,
          memberCount: current.memberCount + 1,
        });
      }
    }

    const total = Array.from(map.values()).reduce((sum, v) => sum + v.dueAmount, 0);

    const items = Array.from(map.entries())
      .map(([planName, data]) => ({
        planName,
        dueAmount: data.dueAmount,
        memberCount: data.memberCount,
        pct: total > 0 ? Math.round((data.dueAmount / total) * 100) : 0,
      }))
      .sort((a, b) => b.dueAmount - a.dueAmount);

    return { total, items };
  }, [memberships]);

  // -------------------------------------------------------------
  // EXPORT CSV & PRINT PDF
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    const headers = [
      "Section / Category",
      "Item / Description",
      "Amount (INR)",
      "Count / Units",
      "Share / Rate (%)",
      "Period",
      "Branch",
    ];

    const rows: (string | number | null | undefined)[][] = [
      // KPI Summary
      [
        "Summary KPI",
        "Total Collections",
        totalCollections,
        periodPayments.length,
        collectionsComparison.label,
        dateRange.label,
        activeBranchName,
      ],
      [
        "Summary KPI",
        "Total Expenses",
        totalExpenses,
        periodExpenses.length,
        expensesComparison.label,
        dateRange.label,
        activeBranchName,
      ],
      [
        "Summary KPI",
        "Operating Difference",
        operatingDifference,
        "—",
        opDiffComparison.label,
        dateRange.label,
        activeBranchName,
      ],
      [
        "Summary KPI",
        "Pending Dues (Snapshot)",
        totalPendingDues,
        totalMembersWithDues,
        "—",
        "Current Snapshot",
        activeBranchName,
      ],
    ];

    // Payment Methods
    paymentMethodData.items.forEach((item) => {
      rows.push([
        "Payment Method",
        item.method,
        item.amount,
        item.count,
        `${item.pct}%`,
        dateRange.label,
        activeBranchName,
      ]);
    });

    // Expense Categories
    expenseCategoryData.items.forEach((item) => {
      rows.push([
        "Expense Category",
        item.category,
        item.amount,
        item.count,
        `${item.pct}%`,
        dateRange.label,
        activeBranchName,
      ]);
    });

    // Plan Dues
    planDuesData.items.forEach((item) => {
      rows.push([
        "Pending Dues by Plan",
        item.planName,
        item.dueAmount,
        `${item.memberCount} members`,
        `${item.pct}%`,
        "Current Snapshot",
        activeBranchName,
      ]);
    });

    const filename = `GymApra_Financial_Report_${activeBranchName.replace(/\s+/g, "_")}_${period}_${todayStr}.csv`;
    downloadCSV(filename, headers, rows);
    setMobileMenuOpen(false);
  };

  const handlePrintPDF = () => {
    setMobileMenuOpen(false);
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block mb-6 p-4 border border-black/20 rounded-lg">
        <h1 className="text-2xl font-bold text-black">{gymName} — Financial Statement & Ledger</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Branch: {activeBranchName} | Period: {dateRange.label} ({dateRange.startDate} to {dateRange.endDate}) | Generated: {todayStr}
        </p>
      </div>

      {/* BREADCRUMB */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground no-print">
        <Link
          href={`/app/${gymId}/reports`}
          className="flex items-center gap-1 hover:text-foreground transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Reports</span>
        </Link>
        <span>/</span>
        <span className="text-foreground font-semibold">Financial Reports</span>
      </div>

      {/* HEADER ROW */}
      <div className="flex items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Understand collections, expenses and outstanding dues
          </p>
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

      {/* PERIOD CONTROL BAR */}
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

        <div className="text-xs text-muted-foreground font-medium self-end sm:self-center">
          {formatDisplayDate(dateRange.startDate)}
          {dateRange.startDate !== dateRange.endDate && ` – ${formatDisplayDate(dateRange.endDate)}`}
        </div>
      </div>

      {/* 4 FINANCIAL KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          label="Total Collections"
          value={formatRupees(totalCollections)}
          variant="green"
          icon={<IndianRupee className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={
            dateRange.priorStartDate ? (
              <span
                className={`text-[11px] font-medium flex items-center tabular-nums ${
                  collectionsComparison.isUp
                    ? "text-emerald-600 [.dark_&]:text-emerald-400"
                    : collectionsComparison.isDown
                    ? "text-rose-500"
                    : "text-muted-foreground"
                }`}
              >
                {collectionsComparison.isUp && <TrendingUp className="w-3 h-3 mr-0.5" />}
                {collectionsComparison.isDown && <TrendingDown className="w-3 h-3 mr-0.5" />}
                {collectionsComparison.label}
              </span>
            ) : undefined
          }
          subtext="Verified payments received"
        />

        <KpiCard
          label="Total Expenses"
          value={formatRupees(totalExpenses)}
          variant="amber"
          icon={<Receipt className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={
            dateRange.priorStartDate ? (
              <span
                className={`text-[11px] font-medium flex items-center tabular-nums ${
                  expensesComparison.isDown
                    ? "text-emerald-600 [.dark_&]:text-emerald-400"
                    : expensesComparison.isUp
                    ? "text-rose-500"
                    : "text-muted-foreground"
                }`}
              >
                {expensesComparison.isUp && <TrendingUp className="w-3 h-3 mr-0.5" />}
                {expensesComparison.isDown && <TrendingDown className="w-3 h-3 mr-0.5" />}
                {expensesComparison.label}
              </span>
            ) : undefined
          }
          subtext="Expenses recorded"
        />

        <KpiCard
          label="Net Cash Flow"
          value={`${operatingDifference < 0 ? "-" : ""}${formatRupees(Math.abs(operatingDifference))}`}
          variant="blue"
          icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
          subtext="Collections minus expenses"
        />

        <KpiCard
          label="Pending Dues"
          value={formatRupees(totalPendingDues)}
          variant="purple"
          icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
          trend={<span className="text-[11px] text-muted-foreground tabular-nums">({totalMembersWithDues} members)</span>}
          subtext="Current outstanding balance"
          href={`/app/${gymId}/follow-ups`}
        />
      </div>

      {/* 4 VISUAL SECTIONS (Pure SVG / Tailwind — Zero External Chart Libraries) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SECTION 1: INCOME VS EXPENSES (Proportional Comparison Bars) */}
        <div className="col-span-full bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Income vs Expenses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proportional comparison of collections and spend for {dateRange.label.toLowerCase()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  operatingDifference >= 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                }`}
              >
                {operatingDifference >= 0 ? "Operating Surplus" : "Operating Deficit"}:{" "}
                {formatRupees(Math.abs(operatingDifference))}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Income Bar */}
            <Link
              href={`/app/${gymId}/payments`}
              className="block group p-2 -mx-2 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Income (Verified Collections)
                  </span>
                  <span className="text-muted-foreground text-[11px]">→ View Payments</span>
                </div>
                <span className="tabular-nums font-bold text-foreground">
                  {formatRupees(totalCollections)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${incomePct}%` }}
                />
              </div>
            </Link>

            {/* Expenses Bar */}
            <Link
              href={`/app/${gymId}/expenses/all`}
              className="block group p-2 -mx-2 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Expenses (Recorded Vouchers)
                  </span>
                  <span className="text-muted-foreground text-[11px]">→ View All Expenses</span>
                </div>
                <span className="tabular-nums font-bold text-foreground">
                  {formatRupees(totalExpenses)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                  style={{ width: `${expensePct}%` }}
                />
              </div>
            </Link>
          </div>
        </div>

        {/* SECTION 2: COLLECTIONS BY PAYMENT METHOD (Donut Chart + Legend) */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">Collections by Method</h2>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {formatRupees(paymentMethodData.total)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payment channels distribution for {dateRange.label.toLowerCase()}
            </p>
          </div>

          <div className="my-5 flex flex-col sm:flex-row items-center justify-center sm:justify-around gap-6">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              {paymentMethodData.total > 0 ? (
                <svg
                  viewBox={`0 0 ${methodDonutSvg.size} ${methodDonutSvg.size}`}
                  className="w-full h-full -rotate-90 transform overflow-visible"
                >
                  <circle
                    cx={methodDonutSvg.size / 2}
                    cy={methodDonutSvg.size / 2}
                    r={methodDonutSvg.radius}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="18"
                    opacity="0.35"
                  />
                  {methodDonutSvg.segments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx={methodDonutSvg.size / 2}
                      cy={methodDonutSvg.size / 2}
                      r={methodDonutSvg.radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="18"
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.dashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  ))}
                </svg>
              ) : (
                <div className="w-full h-full rounded-full border-4 border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                  No Data
                </div>
              )}
              {/* Donut Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none px-2">
                <span className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {formatRupees(paymentMethodData.total)}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Collections
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 w-full sm:w-auto">
              {paymentMethodData.items.length > 0 ? (
                paymentMethodData.items.map((item, idx) => {
                  const colors = ["bg-primary", "bg-sky-400", "bg-amber-400", "bg-purple-400", "bg-pink-400", "bg-slate-400"];
                  const dotColor = colors[idx % colors.length];

                  return (
                    <Link
                      key={item.method}
                      href={`/app/${gymId}/payments`}
                      className="flex items-center justify-between sm:justify-start gap-3 hover:bg-muted/40 p-1 rounded-md transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                        <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.method}
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-xs font-bold text-foreground">
                          {formatRupees(item.amount)}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">
                          ({item.pct}%)
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground py-2">No collections recorded.</p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 text-right">
            <Link
              href={`/app/${gymId}/payments`}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View payments ledger <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* SECTION 3: EXPENSE BREAKDOWN (Horizontal Bars) */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h2 className="text-sm font-semibold text-foreground">Expense Breakdown</h2>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {formatRupees(expenseCategoryData.total)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Spend by category for {dateRange.label.toLowerCase()} (highest first)
            </p>
          </div>

          <div className="my-4 space-y-3">
            {expenseCategoryData.items.length > 0 ? (
              expenseCategoryData.items.map((cat) => (
                <Link
                  key={cat.category}
                  href={`/app/${gymId}/expenses/all?category=${encodeURIComponent(cat.category)}`}
                  className="block group p-1.5 -mx-1.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {cat.category}
                    </span>
                    <span className="tabular-nums font-bold text-foreground">
                      {formatRupees(cat.amount)}{" "}
                      <span className="text-muted-foreground font-normal">({cat.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No expense vouchers recorded in this period.
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-border/60 text-right">
            <Link
              href={`/app/${gymId}/expenses/all`}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View expense vouchers <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* SECTION 4: PENDING DUES BY MEMBERSHIP PLAN (Horizontal Bars) */}
        <div className="col-span-full bg-card border border-border rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Pending Dues by Plan</h2>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Current snapshot
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Outstanding membership balances grouped by plan tier
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatRupees(planDuesData.total)}
              </span>
              <p className="text-xs text-muted-foreground">across {totalMembersWithDues} members</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {planDuesData.items.length > 0 ? (
              planDuesData.items.map((item) => (
                <Link
                  key={item.planName}
                  href={`/app/${gymId}/memberships`}
                  className="block group p-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.planName}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        ({item.memberCount} {item.memberCount === 1 ? "member" : "members"})
                      </span>
                    </div>
                    <span className="tabular-nums font-bold text-foreground">
                      {formatRupees(item.dueAmount)}{" "}
                      <span className="text-muted-foreground font-normal">({item.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <Clock className="w-6 h-6 text-muted-foreground/40 mb-1" />
                <p className="text-xs font-medium text-foreground">All membership balances cleared!</p>
                <p className="text-[11px] text-muted-foreground">No pending dues currently recorded.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/60 mt-3 text-right">
            <Link
              href={`/app/${gymId}/memberships`}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Review all contracts & balances <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
