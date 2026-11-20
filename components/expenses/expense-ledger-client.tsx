"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Receipt,
  Layers,
  Tag,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowLeft,
  Filter,
  X,
} from "lucide-react";
import {
  RecordExpenseModal,
  ViewExpenseModal,
  EditExpenseModal,
  DeleteExpenseModal,
  getCategoryBadgeClass,
  formatVoucherId,
  type ExpenseItem,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
} from "@/components/expenses/expense-modals";

interface ExpenseLedgerClientProps {
  gymId: string;
  branches: { id: string; name: string }[];
  initialExpenses: ExpenseItem[];
  canManage: boolean;
  canDelete: boolean;
  initialCategory?: string;
}

export function ExpenseLedgerClient({
  gymId,
  branches,
  initialExpenses,
  canManage,
  canDelete,
  initialCategory,
}: ExpenseLedgerClientProps) {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category") || initialCategory || "all";

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory);
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<ExpenseItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseItem | null>(null);

  // Sync if URL search param changes
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      setSelectedCategory(cat);
      setCurrentPage(1);
    }
  }, [searchParams]);

  // Reset to page 1 on filter changes
  function handleCategoryChange(cat: string) {
    setSelectedCategory(cat);
    setCurrentPage(1);
  }

  function handleMethodChange(m: string) {
    setSelectedMethod(m);
    setCurrentPage(1);
  }

  function handlePeriodChange(p: string) {
    setSelectedPeriod(p);
    setCurrentPage(1);
  }

  function handleSearchChange(s: string) {
    setSearch(s);
    setCurrentPage(1);
  }

  // Filter dataset based on all active criteria
  const filteredExpenses = useMemo(() => {
    const timeZone = "Asia/Kolkata";
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const [y, m, d] = todayStr.split("-").map(Number);

    return initialExpenses.filter((expense) => {
      // 1. Branch filter
      if (selectedBranchId !== "all" && expense.branch_id !== selectedBranchId) {
        return false;
      }

      // 2. Category filter
      if (selectedCategory !== "all" && expense.category !== selectedCategory) {
        return false;
      }

      // 3. Payment Method filter
      if (selectedMethod !== "all" && expense.payment_method !== selectedMethod) {
        return false;
      }

      // 4. Period filter
      if (selectedPeriod === "this_month") {
        const curMonthPrefix = `${y}-${String(m).padStart(2, "0")}`;
        if (!expense.expense_date.startsWith(curMonthPrefix)) return false;
      } else if (selectedPeriod === "last_30_days") {
        const targetDate = new Date(Date.UTC(y, m - 1, d - 30));
        const dateStr = targetDate.toISOString().slice(0, 10);
        if (expense.expense_date < dateStr) return false;
      } else if (selectedPeriod === "last_7_days") {
        const targetDate = new Date(Date.UTC(y, m - 1, d - 7));
        const dateStr = targetDate.toISOString().slice(0, 10);
        if (expense.expense_date < dateStr) return false;
      } else if (selectedPeriod === "this_year") {
        const curYearPrefix = `${y}-`;
        if (!expense.expense_date.startsWith(curYearPrefix)) return false;
      }

      // 5. Search query (notes, vendor, voucher ID, category)
      if (search.trim()) {
        const q = search.toLowerCase();
        const voucher = formatVoucherId(expense.id).toLowerCase();
        const desc = (expense.description || "").toLowerCase();
        const cat = expense.category.toLowerCase();
        const branchName = (expense.branch_name || expense.branches?.name || "").toLowerCase();

        return (
          voucher.includes(q) ||
          desc.includes(q) ||
          cat.includes(q) ||
          branchName.includes(q)
        );
      }

      return true;
    });
  }, [initialExpenses, selectedBranchId, selectedCategory, selectedMethod, selectedPeriod, search]);

  // Entire filtered dataset aggregations (NOT just current page!)
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredExpenses]);

  const filteredCount = filteredExpenses.length;

  const largestCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return { label: "None", amount: 0 };

    const topCatKey = entries[0][0];
    const label = EXPENSE_CATEGORIES.find((c) => c.value === topCatKey)?.label || topCatKey;
    return { label, amount: entries[0][1] };
  }, [filteredExpenses]);

  // Paginated Slices
  const totalPages = Math.ceil(filteredCount / pageSize) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  const pageStart = filteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredCount);

  return (
    <div className="space-y-6 text-foreground">
      {/* 1. Top Breadcrumb & Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
          <Link
            href={`/app/${gymId}/expenses`}
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Expenses</span>
          </Link>
          <span>/</span>
          <span className="text-foreground">All Expenses</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              All Expenses
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Search, filter, and audit complete branch expense records.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setIsRecordOpen(true)}
              className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filtered Summary Strip (Computed from ALL filtered items) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Card 1: Filtered Total */}
        <div className="bg-card p-3 sm:p-5 rounded-xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Filtered Total
            </span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 hidden sm:flex items-center justify-center shrink-0">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-black tracking-tight text-foreground tabular-nums truncate">
              ₹{filteredTotal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              Total spend
            </div>
          </div>
        </div>

        {/* Card 2: Expense Vouchers */}
        <div className="bg-card p-3 sm:p-5 rounded-xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Expense Vouchers
            </span>
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary hidden sm:flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-black tracking-tight text-foreground tabular-nums truncate">
              {filteredCount}
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              Matching records
            </div>
          </div>
        </div>

        {/* Card 3: Largest Category */}
        <div className="bg-card p-3 sm:p-5 rounded-xl border border-border shadow-xs flex flex-col justify-between text-card-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Largest Category
            </span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 hidden sm:flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-2xl font-black tracking-tight text-foreground capitalize truncate">
              {largestCategory.label}
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              {largestCategory.amount > 0
                ? `₹${largestCategory.amount.toLocaleString("en-IN")}`
                : "No vouchers"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Responsive Search & Filter Bar */}
      <div className="bg-card p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search notes, vendor, or voucher #..."
              className="w-full h-10 pl-10 pr-9 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2">
            {/* Period */}
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="h-10 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="this_year">This Year</option>
            </select>

            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-10 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer capitalize"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Payment Method */}
            <select
              value={selectedMethod}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="h-10 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="all">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Branch (if multi-branch) */}
            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer col-span-2 sm:col-span-1"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Active Filter Badges */}
        {(selectedCategory !== "all" ||
          selectedMethod !== "all" ||
          selectedPeriod !== "all" ||
          selectedBranchId !== "all" ||
          search) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs text-muted-foreground border-t border-border/60">
            <span className="font-semibold text-foreground">Active Filters:</span>
            {selectedCategory !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-foreground font-semibold">
                Category: {selectedCategory}
                <button
                  type="button"
                  onClick={() => handleCategoryChange("all")}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedMethod !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-foreground font-semibold">
                Method: {selectedMethod}
                <button
                  type="button"
                  onClick={() => handleMethodChange("all")}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedPeriod !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-foreground font-semibold">
                Period: {selectedPeriod.replace("_", " ")}
                <button
                  type="button"
                  onClick={() => handlePeriodChange("all")}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setSelectedMethod("all");
                setSelectedPeriod("all");
                setSelectedBranchId("all");
                setSearch("");
                setCurrentPage(1);
              }}
              className="text-xs text-primary hover:underline font-bold ml-1 cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* 4. Voucher Ledger & Pagination */}

      {/* Desktop (>= lg) Data Table */}
      <div className="hidden lg:block bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[11px] border-b border-border">
            <tr>
              <th className="py-3 px-4">Voucher</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Notes / Vendor</th>
              <th className="py-3 px-3">Method</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {paginatedExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-muted-foreground font-medium">
                  No expense vouchers match your search and filter criteria.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-muted-foreground">
                    {formatVoucherId(expense.id)}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-foreground whitespace-nowrap">
                    {expense.expense_date}
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border capitalize ${getCategoryBadgeClass(
                        expense.category
                      )}`}
                    >
                      {expense.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 max-w-sm truncate text-muted-foreground">
                    {expense.description || "—"}
                  </td>
                  <td className="py-3.5 px-3 uppercase font-medium text-muted-foreground">
                    {expense.payment_method}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-foreground whitespace-nowrap text-sm tabular-nums">
                    ₹{Number(expense.amount).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingExpense(expense)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setEditingExpense(expense)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                          title="Edit Voucher"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(expense)}
                          className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Voucher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile (< lg) Dedicated Expense Cards */}
      <div className="lg:hidden space-y-3">
        {paginatedExpenses.length === 0 ? (
          <div className="bg-card p-10 rounded-2xl border border-border text-center text-xs text-muted-foreground">
            No expense vouchers match your search and filter criteria.
          </div>
        ) : (
          paginatedExpenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-card border border-border rounded-xl p-4 space-y-2.5 shadow-xs"
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] border capitalize ${getCategoryBadgeClass(
                      expense.category
                    )}`}
                  >
                    {expense.category}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground font-semibold">
                    {formatVoucherId(expense.id)}
                  </span>
                </div>
                <div className="text-base font-black text-foreground tabular-nums">
                  ₹{Number(expense.amount).toFixed(2)}
                </div>
              </div>

              {/* Middle Row */}
              <div className="text-xs text-muted-foreground">
                <div className="font-semibold text-foreground/90">
                  <span>{expense.expense_date}</span>
                  <span className="uppercase mx-1.5">•</span>
                  <span className="uppercase">{expense.payment_method}</span>
                </div>
                {expense.description && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {expense.description}
                  </div>
                )}
              </div>

              {/* Bottom Row Actions */}
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setViewingExpense(expense)}
                  className="h-8 px-2.5 rounded-lg bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>View</span>
                </button>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingExpense(expense)}
                    className="h-8 px-2.5 rounded-lg bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeletingExpense(expense)}
                    className="h-8 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {filteredCount > 0 && (
        <div className="bg-card p-3.5 sm:p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
          <div className="font-medium">
            Showing <strong className="text-foreground">{pageStart}</strong>–
            <strong className="text-foreground">{pageEnd}</strong> of{" "}
            <strong className="text-foreground">{filteredCount}</strong> vouchers
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-8 px-3 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  (p >= currentPage - 1 && p <= currentPage + 1)
              )
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <span key={p} className="flex items-center">
                    {prev && p - prev > 1 && <span className="px-1 text-muted-foreground">…</span>}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === p
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 px-3 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Shared Modals */}
      <RecordExpenseModal
        gymId={gymId}
        branches={branches}
        isOpen={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
      />

      <ViewExpenseModal
        expense={viewingExpense}
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
        onEdit={(exp) => setEditingExpense(exp)}
      />

      <EditExpenseModal
        gymId={gymId}
        expense={editingExpense}
        branches={branches}
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
      />

      <DeleteExpenseModal
        gymId={gymId}
        expense={deletingExpense}
        isOpen={!!deletingExpense}
        canDelete={canDelete}
        onClose={() => setDeletingExpense(null)}
      />
    </div>
  );
}
