"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Receipt,
  Tag,
  Layers,
  ArrowRight,
  ExternalLink,
  Calendar,
  Building2,
  Clock,
  Eye,
  Plus,
} from "lucide-react";
import {
  RecordExpenseModal,
  ViewExpenseModal,
  getCategoryBadgeClass,
  formatVoucherId,
  type ExpenseItem,
  EXPENSE_CATEGORIES,
} from "@/components/expenses/expense-modals";

type Period = "today" | "week" | "month" | "year" | "all";

interface ExpenseOverviewClientProps {
  gymId: string;
  branches: { id: string; name: string }[];
  initialExpenses: ExpenseItem[];
  canManage: boolean;
}

export function ExpenseOverviewClient({
  gymId,
  branches,
  initialExpenses,
  canManage,
}: ExpenseOverviewClientProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [viewingExpense, setViewingExpense] = useState<ExpenseItem | null>(null);

  // Filter expenses by branch if branch selected
  const branchFilteredExpenses = useMemo(() => {
    if (selectedBranchId === "all") return initialExpenses;
    return initialExpenses.filter((e) => e.branch_id === selectedBranchId);
  }, [initialExpenses, selectedBranchId]);

  // Compute period data with gym-local Asia/Kolkata date boundaries
  const { currentPeriodExpenses, prevPeriodExpenses, prevPeriodLabel } = useMemo(() => {
    const timeZone = "Asia/Kolkata";
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const [y, m, d] = todayStr.split("-").map(Number);

    if (period === "all") {
      return {
        currentPeriodExpenses: branchFilteredExpenses,
        prevPeriodExpenses: [],
        prevPeriodLabel: "",
      };
    }

    if (period === "today") {
      const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1));
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
      return {
        currentPeriodExpenses: branchFilteredExpenses.filter((e) => e.expense_date === todayStr),
        prevPeriodExpenses: branchFilteredExpenses.filter((e) => e.expense_date === yesterdayStr),
        prevPeriodLabel: "vs yesterday",
      };
    }

    if (period === "week") {
      const curUtc = new Date(Date.UTC(y, m - 1, d));
      const day = curUtc.getUTCDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const mondayUtc = new Date(Date.UTC(y, m - 1, d + diffToMonday));
      const weekStartStr = mondayUtc.toISOString().slice(0, 10);

      const prevMondayUtc = new Date(Date.UTC(y, m - 1, d + diffToMonday - 7));
      const prevSundayUtc = new Date(Date.UTC(y, m - 1, d + diffToMonday - 1));
      const prevWeekStartStr = prevMondayUtc.toISOString().slice(0, 10);
      const prevWeekEndStr = prevSundayUtc.toISOString().slice(0, 10);

      return {
        currentPeriodExpenses: branchFilteredExpenses.filter(
          (e) => e.expense_date >= weekStartStr && e.expense_date <= todayStr
        ),
        prevPeriodExpenses: branchFilteredExpenses.filter(
          (e) => e.expense_date >= prevWeekStartStr && e.expense_date <= prevWeekEndStr
        ),
        prevPeriodLabel: "vs last week",
      };
    }

    if (period === "month") {
      const curMonthPrefix = `${y}-${String(m).padStart(2, "0")}`;
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const prevMonthPrefix = `${prevY}-${String(prevM).padStart(2, "0")}`;

      return {
        currentPeriodExpenses: branchFilteredExpenses.filter((e) =>
          e.expense_date.startsWith(curMonthPrefix)
        ),
        prevPeriodExpenses: branchFilteredExpenses.filter((e) =>
          e.expense_date.startsWith(prevMonthPrefix)
        ),
        prevPeriodLabel: "vs last month",
      };
    }

    if (period === "year") {
      const curYearPrefix = `${y}-`;
      const prevYearPrefix = `${y - 1}-`;
      return {
        currentPeriodExpenses: branchFilteredExpenses.filter((e) =>
          e.expense_date.startsWith(curYearPrefix)
        ),
        prevPeriodExpenses: branchFilteredExpenses.filter((e) =>
          e.expense_date.startsWith(prevYearPrefix)
        ),
        prevPeriodLabel: "vs last year",
      };
    }

    return {
      currentPeriodExpenses: branchFilteredExpenses,
      prevPeriodExpenses: [],
      prevPeriodLabel: "",
    };
  }, [branchFilteredExpenses, period]);

  // Aggregations for current period
  const totalAmount = useMemo(() => {
    return currentPeriodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [currentPeriodExpenses]);

  const prevTotalAmount = useMemo(() => {
    return prevPeriodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [prevPeriodExpenses]);

  const voucherCount = currentPeriodExpenses.length;
  const avgVoucher = voucherCount > 0 ? totalAmount / voucherCount : 0;

  // Comparison Delta
  const delta = useMemo(() => {
    if (period === "all" || prevPeriodExpenses.length === 0) {
      return null;
    }
    if (prevTotalAmount === 0) {
      return totalAmount > 0 ? { pct: 100, isUp: true, text: "+100% " + prevPeriodLabel } : null;
    }
    const diff = totalAmount - prevTotalAmount;
    const pct = Math.round((diff / prevTotalAmount) * 100);
    return {
      pct: Math.abs(pct),
      isUp: diff > 0,
      text: `${diff >= 0 ? "+" : ""}${pct}% ${prevPeriodLabel}`,
    };
  }, [period, prevPeriodExpenses, prevTotalAmount, totalAmount, prevPeriodLabel]);

  // Category breakdown for current period
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    currentPeriodExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });

    const entries = Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
      pct: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      label: EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category,
    }));

    entries.sort((a, b) => b.amount - a.amount);
    return entries;
  }, [currentPeriodExpenses, totalAmount]);

  const topCategory = categoryBreakdown[0] || null;

  // Monthly trends for the last 6 months
  const monthlyTrends = useMemo(() => {
    const timeZone = "Asia/Kolkata";
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const [currY, currM] = todayStr.split("-").map(Number);
    const months = [];

    for (let i = 5; i >= 0; i--) {
      let targetM = currM - i;
      let targetY = currY;
      while (targetM <= 0) {
        targetM += 12;
        targetY -= 1;
      }

      const monthKey = `${targetY}-${String(targetM).padStart(2, "0")}`;
      const monthDate = new Date(Date.UTC(targetY, targetM - 1, 1));
      const label = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
      }).format(monthDate);

      const monthSpend = branchFilteredExpenses
        .filter((e) => e.expense_date.startsWith(monthKey))
        .reduce((sum, e) => sum + Number(e.amount), 0);

      months.push({
        key: monthKey,
        label,
        amount: monthSpend,
        isCurrent: i === 0,
      });
    }

    const maxSpend = Math.max(...months.map((m) => m.amount), 1);
    return { months, maxSpend };
  }, [branchFilteredExpenses]);

  // Latest 5 expenses
  const recentExpenses = useMemo(() => {
    return branchFilteredExpenses.slice(0, 5);
  }, [branchFilteredExpenses]);

  return (
    <div className="space-y-6 text-foreground">
      {/* 1. Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Expenses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and analyze gym spending
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {branches.length > 1 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-9 px-3 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-2xs"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Period Switcher Pills (Grid on mobile, inline on desktop) */}
          <div className="grid grid-cols-5 sm:flex items-center bg-card p-1 rounded-xl border border-border shadow-2xs gap-0.5 w-full sm:w-auto">
            {(["today", "week", "month", "year", "all"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize text-center ${
                  period === p
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {canManage && (
            <RecordExpenseModal
              gymId={gymId}
              branches={branches}
              trigger={
                <button
                  type="button"
                  className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Expense</span>
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* 2. Four Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* KPI 1: Total Expenses */}
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Total Expenses
            </span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 hidden sm:flex items-center justify-center shrink-0">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums truncate">
              ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium mt-0.5 truncate">
              {delta ? (
                <>
                  {delta.isUp ? (
                    <TrendingUp className="w-3 h-3 text-rose-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-emerald-600 shrink-0" />
                  )}
                  <span
                    className={
                      delta.isUp
                        ? "text-rose-600 font-semibold truncate"
                        : "text-emerald-600 font-semibold truncate"
                    }
                  >
                    {delta.text}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground truncate capitalize">
                  {period} spend total
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Expense Vouchers */}
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Expense Vouchers
            </span>
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary hidden sm:flex items-center justify-center shrink-0">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums truncate">
              {voucherCount}
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              Transactions logged
            </div>
          </div>
        </div>

        {/* KPI 3: Top Category */}
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Top Category
            </span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 hidden sm:flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground capitalize truncate">
              {topCategory ? topCategory.label : "None"}
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              {topCategory
                ? `₹${topCategory.amount.toLocaleString("en-IN")} (${topCategory.pct}%)`
                : "No expenses in period"}
            </div>
          </div>
        </div>

        {/* KPI 4: Average Expense */}
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Average Expense
            </span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 hidden sm:flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums truncate">
              ₹{Math.round(avgVoucher).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              Per voucher avg
            </div>
          </div>
        </div>
      </div>

      {/* 3. Two-Column Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Category Breakdown */}
        <div className="lg:col-span-6 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-card-foreground tracking-tight">
                Expense Breakdown by Category
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Spend distribution for selected period
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border/60">
              {categoryBreakdown.length} Categories
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {categoryBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No expenses recorded for this period.
              </div>
            ) : (
              categoryBreakdown.map((item) => (
                <Link
                  key={item.category}
                  href={`/app/${gymId}/expenses/all?category=${encodeURIComponent(item.category)}`}
                  className="block p-2.5 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60 group"
                  title={`View all ${item.label} expenses`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border capitalize ${getCategoryBadgeClass(
                          item.category
                        )}`}
                      >
                        {item.label}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="font-semibold text-foreground tabular-nums">
                      ₹{item.amount.toLocaleString("en-IN")}
                      <span className="text-muted-foreground font-normal ml-1.5">
                        ({item.pct}%)
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar Track */}
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.max(item.pct, 3)}%` }}
                    />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right Column: 6-Month Trend Chart */}
        <div className="lg:col-span-6 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-card-foreground tracking-tight">
                Monthly Expense Trends
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last 6 months spending history
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
              <span>Current Month</span>
            </div>
          </div>

          {/* SVG / Pure Tailwind Vertical Bar Chart */}
          <div className="pt-4 flex flex-col justify-end min-h-[220px]">
            {monthlyTrends.months.every((m) => m.amount === 0) ? (
              <div className="py-14 text-center text-xs text-muted-foreground">
                No spending history in the last 6 months.
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-44 px-2 border-b border-border">
                {monthlyTrends.months.map((item) => {
                  const heightPercent =
                    item.amount > 0
                      ? Math.max(Math.round((item.amount / monthlyTrends.maxSpend) * 100), 8)
                      : 4;

                  return (
                    <div
                      key={item.key}
                      className="flex flex-col items-center gap-1.5 h-full justify-end group"
                    >
                      {/* Hover Tooltip Value */}
                      <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground tabular-nums transition-colors whitespace-nowrap">
                        {item.amount > 0
                          ? item.amount >= 100000
                            ? `₹${(item.amount / 100000).toFixed(1)}L`
                            : item.amount >= 1000
                            ? `₹${Math.round(item.amount / 1000)}k`
                            : `₹${item.amount}`
                          : "₹0"}
                      </span>

                      {/* Bar */}
                      <div className="w-full max-w-[40px] bg-muted/60 rounded-t-lg overflow-hidden flex flex-col justify-end h-32">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            item.isCurrent
                              ? "bg-primary shadow-xs"
                              : "bg-primary/50 group-hover:bg-primary/80"
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      {/* X-axis Label */}
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          item.isCurrent ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Recent Expenses Preview */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-card-foreground tracking-tight">
              Recent Expenses
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest transactions logged in gym ledger
            </p>
          </div>
          <Link
            href={`/app/${gymId}/expenses/all`}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[11px] border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Voucher</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description / Notes</th>
                <th className="py-2.5 px-3">Payment Method</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {recentExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground font-medium">
                    No expenses recorded yet. Click &quot;Record Expense&quot; above to log your first operational cost.
                  </td>
                </tr>
              ) : (
                recentExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-muted-foreground">
                      {formatVoucherId(expense.id)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">
                      {expense.expense_date}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border capitalize ${getCategoryBadgeClass(
                          expense.category
                        )}`}
                      >
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-muted-foreground">
                      {expense.description || "—"}
                    </td>
                    <td className="py-3 px-3 uppercase font-medium text-muted-foreground">
                      {expense.payment_method}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-foreground whitespace-nowrap text-sm tabular-nums">
                      ₹{Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewingExpense(expense)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="View Voucher Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile 2-Row Card View */}
        <div className="md:hidden divide-y divide-border/60">
          {recentExpenses.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No expenses recorded yet.
            </div>
          ) : (
            recentExpenses.map((expense) => (
              <div
                key={expense.id}
                onClick={() => setViewingExpense(expense)}
                className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 px-1 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] border capitalize ${getCategoryBadgeClass(
                        expense.category
                      )}`}
                    >
                      {expense.category}
                    </span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {expense.expense_date}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      • {expense.payment_method}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {expense.description || "No description"}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-foreground tabular-nums">
                    ₹{Number(expense.amount).toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {formatVoucherId(expense.id)}
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="pt-3">
            <Link
              href={`/app/${gymId}/expenses/all`}
              className="w-full h-10 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold flex items-center justify-center gap-1.5 border border-border transition-colors"
            >
              <span>View All Expenses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* View Expense Modal */}
      <ViewExpenseModal
        expense={viewingExpense}
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
      />
    </div>
  );
}
