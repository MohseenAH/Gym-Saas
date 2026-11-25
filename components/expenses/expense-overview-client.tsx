"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Wallet,
  Calendar,
  Building2,
  Search,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  FileBarChart2,
  Bookmark,
  Home,
  Zap,
  Users,
  Dumbbell,
  Wrench,
  Megaphone,
  Receipt,
  CreditCard,
  X,
  Plus,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  RecordExpenseModal,
  ViewExpenseModal,
  EditExpenseModal,
  DeleteExpenseModal,
  getCategoryBadgeClass,
  formatVoucherId,
  type ExpenseItem,
  EXPENSE_CATEGORIES,
} from "@/components/expenses/expense-modals";
import { formatDate } from "@/lib/utils";

type Period = "today" | "week" | "month" | "year" | "all";

interface ExpenseOverviewClientProps {
  gymId: string;
  branches: { id: string; name: string }[];
  initialExpenses: ExpenseItem[];
  canManage: boolean;
  canDelete?: boolean;
  todayStr: string;
}

const CATEGORY_COLORS: Record<
  string,
  { stroke: string; dot: string; iconBg: string }
> = {
  rent: {
    stroke: "#7c3aed",
    dot: "bg-violet-600",
    iconBg: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  },
  salaries: {
    stroke: "#10b981",
    dot: "bg-emerald-500",
    iconBg: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  electricity: {
    stroke: "#3b82f6",
    dot: "bg-blue-500",
    iconBg: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  },
  equipment: {
    stroke: "#a855f7",
    dot: "bg-purple-500",
    iconBg: "bg-purple-500/12 text-purple-600 dark:text-purple-400",
  },
  maintenance: {
    stroke: "#f59e0b",
    dot: "bg-amber-500",
    iconBg: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  },
  marketing: {
    stroke: "#f43f5e",
    dot: "bg-rose-500",
    iconBg: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  },
  miscellaneous: {
    stroke: "#64748b",
    dot: "bg-slate-500",
    iconBg: "bg-slate-500/12 text-slate-600 dark:text-slate-400",
  },
  other: {
    stroke: "#f97316",
    dot: "bg-orange-500",
    iconBg: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  },
};

function getCategoryIcon(category: string) {
  switch (category) {
    case "rent":
      return Home;
    case "electricity":
      return Zap;
    case "salaries":
      return Users;
    case "equipment":
      return Dumbbell;
    case "maintenance":
      return Wrench;
    case "marketing":
      return Megaphone;
    default:
      return Receipt;
  }
}

function getCategoryLabel(category: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category;
}

function formatPaymentMethod(method: string): string {
  switch (method) {
    case "bank_transfer":
      return "Bank Transfer";
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "cheque":
      return "Cheque";
    default:
      return "Other";
  }
}

export function ExpenseOverviewClient({
  gymId,
  branches,
  initialExpenses,
  canManage,
  canDelete = false,
  todayStr,
}: ExpenseOverviewClientProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modals
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<ExpenseItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseItem | null>(null);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  // Branch-scoped expenses
  const branchExpenses = useMemo(() => {
    if (selectedBranchId === "all") return initialExpenses;
    return initialExpenses.filter((e) => e.branch_id === selectedBranchId);
  }, [initialExpenses, selectedBranchId]);

  // Fixed KPIs: This Month vs Last Month & Today vs Yesterday
  const {
    thisMonthTotal,
    monthTrend,
    todayTotal,
    todayTrend,
  } = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);

    const curMonthPrefix = `${y}-${String(m).padStart(2, "0")}`;
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const prevMonthPrefix = `${prevY}-${String(prevM).padStart(2, "0")}`;

    const yesterdayStr = new Date(Date.UTC(y, m - 1, d - 1))
      .toISOString()
      .slice(0, 10);

    const curMonthSum = branchExpenses
      .filter((e) => e.expense_date.startsWith(curMonthPrefix))
      .reduce((s, e) => s + Number(e.amount), 0);
    const prevMonthSum = branchExpenses
      .filter((e) => e.expense_date.startsWith(prevMonthPrefix))
      .reduce((s, e) => s + Number(e.amount), 0);

    const curDaySum = branchExpenses
      .filter((e) => e.expense_date === todayStr)
      .reduce((s, e) => s + Number(e.amount), 0);
    const prevDaySum = branchExpenses
      .filter((e) => e.expense_date === yesterdayStr)
      .reduce((s, e) => s + Number(e.amount), 0);

    // For expenses, increase is NOT positive (amber/red), decrease is favorable (emerald)
    function computeExpenseTrend(current: number, previous: number) {
      if (previous <= 0) {
        return current > 0
          ? { value: "New spend", isDecrease: false }
          : null;
      }
      const diff = current - previous;
      const pct = Math.round((diff / previous) * 100);
      return {
        value: `${pct > 0 ? "+" : ""}${pct}%`,
        isDecrease: diff <= 0,
      };
    }

    return {
      thisMonthTotal: curMonthSum,
      monthTrend: computeExpenseTrend(curMonthSum, prevMonthSum),
      todayTotal: curDaySum,
      todayTrend: computeExpenseTrend(curDaySum, prevDaySum),
    };
  }, [branchExpenses, todayStr]);

  // Period-filtered expenses (drives both Category Breakdown Chart & Recent Expenses)
  const periodExpenses = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    if (period === "all") return branchExpenses;
    if (period === "today") {
      return branchExpenses.filter((e) => e.expense_date === todayStr);
    }
    if (period === "week") {
      const curUtc = new Date(Date.UTC(y, m - 1, d));
      const day = curUtc.getUTCDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const weekStartStr = new Date(Date.UTC(y, m - 1, d + diffToMonday))
        .toISOString()
        .slice(0, 10);
      return branchExpenses.filter(
        (e) => e.expense_date >= weekStartStr && e.expense_date <= todayStr
      );
    }
    if (period === "month") {
      const curMonthPrefix = `${y}-${String(m).padStart(2, "0")}`;
      return branchExpenses.filter((e) => e.expense_date.startsWith(curMonthPrefix));
    }
    const curYearPrefix = `${y}-`;
    return branchExpenses.filter((e) => e.expense_date.startsWith(curYearPrefix));
  }, [branchExpenses, period, todayStr]);

  const periodTotal = useMemo(
    () => periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [periodExpenses]
  );

  // Category breakdown for donut chart
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    periodExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });

    const entries = Object.entries(map).map(([category, amount]) => {
      const pct = periodTotal > 0 ? Math.round((amount / periodTotal) * 100) : 0;
      const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
      return {
        category,
        label: getCategoryLabel(category),
        amount,
        pct,
        stroke: colors.stroke,
        dot: colors.dot,
      };
    });

    entries.sort((a, b) => b.amount - a.amount);
    return entries;
  }, [periodExpenses, periodTotal]);

  // SVG Donut geometry
  const donutSegments = useMemo(() => {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return categoryBreakdown.map((item) => {
      const fraction = periodTotal > 0 ? item.amount / periodTotal : 0;
      const length = fraction * circumference;
      const seg = {
        ...item,
        dasharray: `${length} ${circumference}`,
        dashoffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [categoryBreakdown, periodTotal]);

  // Filtered recent expenses (applies period, category, search)
  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodExpenses
      .filter((e) => {
        if (selectedCategory !== "all" && e.category !== selectedCategory) {
          return false;
        }
        if (!q) return true;
        const desc = (e.description || "").toLowerCase();
        const cat = getCategoryLabel(e.category).toLowerCase();
        const voucher = formatVoucherId(e.id).toLowerCase();
        return desc.includes(q) || cat.includes(q) || voucher.includes(q);
      })
      .slice(0, 6);
  }, [periodExpenses, selectedCategory, search]);

  const periodLabel =
    period === "today"
      ? "Today"
      : period === "week"
      ? "This Week"
      : period === "month"
      ? "This Month"
      : period === "year"
      ? "This Year"
      : "All Time";

  return (
    <div className="space-y-5 text-foreground">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
            Expenses
          </h1>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsRecordOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95 transition-opacity shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        )}
      </div>

      {/* 2 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <KpiCard
          label="This Month"
          value={`₹${thisMonthTotal.toLocaleString("en-IN")}`}
          variant="purple"
          icon={<Wallet className="w-4 h-4" />}
          trend={
            monthTrend ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  monthTrend.isDecrease
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                }`}
              >
                {monthTrend.value} vs last month
              </span>
            ) : undefined
          }
          subtext={!monthTrend ? "Current month total" : undefined}
        />

        <KpiCard
          label="Today"
          value={`₹${todayTotal.toLocaleString("en-IN")}`}
          variant="amber"
          icon={<Calendar className="w-4 h-4" />}
          trend={
            todayTrend ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  todayTrend.isDecrease
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                }`}
              >
                {todayTrend.value} vs yesterday
              </span>
            ) : undefined
          }
          subtext={!todayTrend ? "Today's spend" : undefined}
        />
      </div>

      {/* Category Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Expenses by Category Donut Chart */}
        <div className="lg:col-span-8 bg-card rounded-3xl border border-border shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-black text-foreground">
                Expenses by Category
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodLabel}
              </p>
            </div>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No expenses recorded for {periodLabel.toLowerCase()}.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Donut SVG */}
              <div className="relative w-44 h-44 shrink-0">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="58"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted/40"
                    strokeWidth="22"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.category}
                      cx="80"
                      cy="80"
                      r="58"
                      fill="none"
                      stroke={seg.stroke}
                      strokeWidth="22"
                      strokeDasharray={seg.dasharray}
                      strokeDashoffset={seg.dashoffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
                  <span className="text-base font-black text-foreground">
                    ₹{periodTotal.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground leading-tight mt-0.5">
                    Total Expenses
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 w-full space-y-2">
                {categoryBreakdown.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-muted/35 border border-border/50 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dot}`}
                      />
                      <span className="font-bold text-foreground truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-foreground">
                        ₹{item.amount.toLocaleString("en-IN")}
                      </span>
                      <span className="w-9 text-right text-muted-foreground font-semibold">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Quick Actions */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <Link
            href={`/app/${gymId}/reports/financial`}
            className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-500/20 bg-purple-500/8 hover:bg-purple-500/14 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <FileBarChart2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-foreground">
                  Expense Reports
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  View &amp; analyze expenses
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>

          <button
            type="button"
            onClick={() => setIsCategoriesModalOpen(true)}
            className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-blue-500/20 bg-blue-500/8 hover:bg-blue-500/14 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Bookmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-foreground">
                  Manage Categories
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  View built-in expense categories
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>

      {/* Search & Filters (applies to Chart + Recent Expenses) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses by title or note..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-10 px-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            aria-label="Filter chart and recent expenses by period"
            className="h-10 px-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="month">This Month</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>

          {branches.length > 1 && (
            <div className="relative flex items-center">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                aria-label="Filter by branch"
                className="h-10 pl-8 pr-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-card rounded-3xl border border-border shadow-xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-black text-foreground">
              Recent Expenses
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Showing {periodLabel.toLowerCase()} records
            </p>
          </div>
          <Link
            href={`/app/${gymId}/expenses/all`}
            className="text-xs font-bold text-primary hover:underline"
          >
            View All →
          </Link>
        </div>

        {filteredRecent.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No expenses match the selected filters.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRecent.map((exp) => {
              const Icon = getCategoryIcon(exp.category);
              const colors =
                CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.other;
              const label = getCategoryLabel(exp.category);

              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-muted/25 hover:bg-muted/45 border border-border/60 transition-colors"
                >
                  {/* Left: Icon + Title/Note */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${colors.iconBg}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {exp.description || label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {label} • {formatPaymentMethod(exp.payment_method)}
                      </div>
                    </div>
                  </div>

                  {/* Desktop middle columns */}
                  <div className="hidden md:flex items-center gap-6 shrink-0 text-xs">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                        exp.category
                      )}`}
                    >
                      {label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium w-28">
                      <CreditCard className="w-3.5 h-3.5" />
                      {formatPaymentMethod(exp.payment_method)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium w-24">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(exp.expense_date)}
                    </span>
                  </div>

                  {/* Right: Amount + Date (mobile) + Menu */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-black text-foreground">
                        ₹{Number(exp.amount).toLocaleString("en-IN")}
                      </div>
                      <div className="md:hidden text-[10px] text-muted-foreground">
                        {formatDate(exp.expense_date)}
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Expense actions"
                        onClick={() =>
                          setOpenMenuId((prev) =>
                            prev === exp.id ? null : exp.id
                          )
                        }
                        className="h-8 w-8 inline-flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === exp.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-9 w-40 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setViewingExpense(exp);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-primary" />
                              View
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setEditingExpense(exp);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeletingExpense(exp);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Categories Info Modal (honest gap notice) */}
      {isCategoriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400">
                  <Bookmark className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-foreground">
                  Expense Categories
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoriesModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Expense categories are currently system-defined across GymApra.
              Custom category creation is not yet supported.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <span
                  key={c.value}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                    c.value
                  )}`}
                >
                  {c.label}
                </span>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoriesModalOpen(false)}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Modals */}
      <RecordExpenseModal
        gymId={gymId}
        branches={branches}
        isOpen={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
      />

      {viewingExpense && (
        <ViewExpenseModal
          expense={viewingExpense}
          isOpen={true}
          onClose={() => setViewingExpense(null)}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          gymId={gymId}
          branches={branches}
          expense={editingExpense}
          isOpen={true}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {deletingExpense && (
        <DeleteExpenseModal
          gymId={gymId}
          expense={deletingExpense}
          canDelete={canDelete}
          isOpen={true}
          onClose={() => setDeletingExpense(null)}
        />
      )}
    </div>
  );
}
