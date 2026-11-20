"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  FileText,
  Check,
  Loader2,
  Clock,
  XCircle,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  Banknote,
  Receipt,
  X,
  Copy,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  Eye,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";
import { RecordPaymentModal } from "@/components/payments/record-payment-modal";
import { verifyPaymentAction, rejectPaymentAction } from "@/lib/actions/payments";
import { getTodayIST, getStatusBadgeClass } from "@/lib/utils";

export interface PaymentLedgerItem {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  memberEmail?: string | null;
  branchName: string;
  planName?: string | null;
  membershipId?: string | null;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
  createdAt?: string;
  notes?: string | null;
  utr?: string | null;
  proofUrl?: string | null;
}

interface PaymentsLedgerClientProps {
  gymId: string;
  gymName: string;
  payments: PaymentLedgerItem[];
  members: { id: string; fullName: string; phone: string; branchId: string }[];
  branches: { id: string; name: string }[];
}

export type TabType = "confirmed" | "pending" | "rejected";
export type DateFilterType = "this_month" | "30d" | "7d" | "all";

export function PaymentsLedgerClient({
  gymId,
  gymName,
  payments: initialPayments,
  members,
  branches,
}: PaymentsLedgerClientProps) {
  const router = useRouter();
  const [paymentsList, setPaymentsList] = useState<PaymentLedgerItem[]>(initialPayments);
  const [activeTab, setActiveTab] = useState<TabType>("confirmed");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("this_month");
  
  // Verification Drawer State
  const [drawerPayment, setDrawerPayment] = useState<PaymentLedgerItem | null>(null);
  const [checklistVerified, setChecklistVerified] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync if initialPayments props change from server
  useEffect(() => {
    setPaymentsList(initialPayments);
  }, [initialPayments]);

  // Compute set of UTRs already confirmed across all payments
  const confirmedUtrSet = useMemo(() => {
    const set = new Set<string>();
    paymentsList.forEach((p) => {
      if ((p.paymentStatus === "paid" || p.paymentStatus === "partial") && p.utr) {
        set.add(p.utr.toLowerCase().trim());
      }
    });
    return set;
  }, [paymentsList]);

  // Date Boundary Computations
  const todayStr = useMemo(() => getTodayIST(), []);
  const dateBoundaries = useMemo(() => {
    const [y, m] = todayStr.split("-");
    const currentMonthPrefix = `${y}-${m}`;

    const getPastDate = (days: number) => {
      const d = new Date(todayStr + "T00:00:00+05:30");
      d.setDate(d.getDate() - days);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${date}`;
    };

    return {
      currentMonthPrefix,
      sevenDaysAgo: getPastDate(7),
      thirtyDaysAgo: getPastDate(30),
    };
  }, [todayStr]);

  // Payments filtered by date range (for KPIs and tables)
  const dateFilteredPayments = useMemo(() => {
    return paymentsList.filter((p) => {
      if (dateFilter === "this_month") {
        return p.paymentDate.startsWith(dateBoundaries.currentMonthPrefix);
      }
      if (dateFilter === "30d") {
        return p.paymentDate >= dateBoundaries.thirtyDaysAgo;
      }
      if (dateFilter === "7d") {
        return p.paymentDate >= dateBoundaries.sevenDaysAgo;
      }
      return true; // "all"
    });
  }, [paymentsList, dateFilter, dateBoundaries]);

  // Top KPI Metrics (Calculated dynamically for selected date range)
  const kpiData = useMemo(() => {
    const confirmed = dateFilteredPayments.filter(
      (p) => p.paymentStatus === "paid" || p.paymentStatus === "partial"
    );
    const pending = dateFilteredPayments.filter((p) => p.paymentStatus === "pending");

    let confirmedRevenue = 0;
    let upiTotal = 0;
    let cashTotal = 0;
    let cardTotal = 0;

    confirmed.forEach((p) => {
      confirmedRevenue += p.amount;
      if (p.paymentMethod === "upi") upiTotal += p.amount;
      else if (p.paymentMethod === "cash") cashTotal += p.amount;
      else cardTotal += p.amount;
    });

    const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

    return {
      confirmedRevenue: Math.round(confirmedRevenue * 100) / 100,
      confirmedCount: confirmed.length,
      upiTotal: Math.round(upiTotal * 100) / 100,
      upiCount: confirmed.filter((p) => p.paymentMethod === "upi").length,
      cashAndCardTotal: Math.round((cashTotal + cardTotal) * 100) / 100,
      cashTotal: Math.round(cashTotal * 100) / 100,
      cardTotal: Math.round(cardTotal * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      pendingCount: pending.length,
    };
  }, [dateFilteredPayments]);

  // Overall counts for tabs (unfiltered by search/method, but reflects date range)
  const tabCounts = useMemo(() => {
    return {
      confirmed: dateFilteredPayments.filter(
        (p) => p.paymentStatus === "paid" || p.paymentStatus === "partial"
      ).length,
      pending: dateFilteredPayments.filter((p) => p.paymentStatus === "pending").length,
      rejected: dateFilteredPayments.filter((p) => p.paymentStatus === "rejected").length,
    };
  }, [dateFilteredPayments]);

  // Filtered payments for active tab with search & method applied
  const tabFilteredPayments = useMemo(() => {
    return dateFilteredPayments.filter((p) => {
      // 1. Tab Status Filter
      if (activeTab === "confirmed") {
        if (p.paymentStatus !== "paid" && p.paymentStatus !== "partial") return false;
      } else if (activeTab === "pending") {
        if (p.paymentStatus !== "pending") return false;
      } else if (activeTab === "rejected") {
        if (p.paymentStatus !== "rejected") return false;
      }

      // 2. Method Filter
      if (methodFilter !== "all" && p.paymentMethod !== methodFilter) {
        return false;
      }

      // 3. Search Filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchesName = p.memberName.toLowerCase().includes(q);
      const matchesPhone = p.memberPhone.includes(q);
      const matchesId = p.id.toLowerCase().includes(q);
      const matchesUtr = p.utr ? p.utr.toLowerCase().includes(q) : false;
      const matchesNotes = p.notes ? p.notes.toLowerCase().includes(q) : false;
      return matchesName || matchesPhone || matchesId || matchesUtr || matchesNotes;
    });
  }, [dateFilteredPayments, activeTab, methodFilter, search]);

  // Verification & Approval Actions
  async function handleApproveFromDrawer() {
    if (!drawerPayment) return;
    setIsVerifying(true);
    setActionMessage(null);

    try {
      const res = await verifyPaymentAction({
        gymId,
        paymentId: drawerPayment.id,
        action: "approve",
      });

      if (!res.success) {
        setActionMessage({ type: "error", text: res.error || "Failed to verify payment." });
        setIsVerifying(false);
        return;
      }

      // Optimistic update
      setPaymentsList((prev) =>
        prev.map((item) =>
          item.id === drawerPayment.id ? { ...item, paymentStatus: "paid" } : item
        )
      );

      setActionMessage({
        type: "success",
        text: `Payment of ₹${drawerPayment.amount.toLocaleString("en-IN")} for ${drawerPayment.memberName} approved!`,
      });

      // Prepare receipt data and open receipt modal
      const receiptData: ReceiptData = {
        id: drawerPayment.id,
        gymName,
        branchName: drawerPayment.branchName,
        memberName: drawerPayment.memberName,
        memberPhone: drawerPayment.memberPhone,
        memberEmail: drawerPayment.memberEmail || undefined,
        planName: drawerPayment.planName || "Gym Membership / Subscription Fee",
        amount: drawerPayment.amount,
        paymentMethod: drawerPayment.paymentMethod,
        paymentStatus: "paid",
        paymentDate: drawerPayment.paymentDate,
        notes: drawerPayment.notes || undefined,
      };

      setDrawerPayment(null);
      setSelectedReceipt(receiptData);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error verifying payment.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsVerifying(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  }

  async function handleRejectFromDrawer() {
    if (!drawerPayment) return;
    setIsVerifying(true);
    setActionMessage(null);

    try {
      const res = await rejectPaymentAction({
        gymId,
        paymentId: drawerPayment.id,
        reason: rejectionReason.trim() || undefined,
      });

      if (!res.success) {
        setActionMessage({ type: "error", text: res.error || "Failed to reject payment claim." });
        setIsVerifying(false);
        return;
      }

      setPaymentsList((prev) =>
        prev.map((item) =>
          item.id === drawerPayment.id
            ? {
                ...item,
                paymentStatus: "rejected",
                notes: `${item.notes || ""} [REJECTED: ${rejectionReason.trim() || "Declined by front desk"}]`.trim(),
              }
            : item
        )
      );

      setActionMessage({ type: "success", text: "Payment submission declined." });
      setDrawerPayment(null);
      setShowRejectInput(false);
      setRejectionReason("");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error rejecting payment.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsVerifying(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  }

  // Handle Review Queue Attention Banner Click
  function handleOpenReviewQueue() {
    setActiveTab("pending");
    const firstPending = dateFilteredPayments.find((p) => p.paymentStatus === "pending");
    if (firstPending && typeof window !== "undefined" && window.innerWidth >= 1024) {
      setDrawerPayment(firstPending);
      setChecklistVerified(false);
      setShowRejectInput(false);
      setRejectionReason("");
    }
  }

  // Open Drawer for specific item
  function handleOpenDrawer(p: PaymentLedgerItem) {
    setDrawerPayment(p);
    setChecklistVerified(false);
    setShowRejectInput(false);
    setRejectionReason("");
  }

  // Open Receipt Modal
  function handleOpenReceipt(p: PaymentLedgerItem) {
    setSelectedReceipt({
      id: p.id,
      gymName,
      branchName: p.branchName,
      memberName: p.memberName,
      memberPhone: p.memberPhone,
      memberEmail: p.memberEmail || undefined,
      planName: p.planName || "Gym Membership / Subscription Fee",
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      paymentDate: p.paymentDate,
      notes: p.notes || undefined,
    });
  }

  // Copy UTR to clipboard
  function handleCopyUtr(utrText: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(utrText);
      setCopiedUtr(true);
      setTimeout(() => setCopiedUtr(false), 2000);
    }
  }

  const isDuplicateUtrInDrawer = useMemo(() => {
    if (!drawerPayment || !drawerPayment.utr) return false;
    return confirmedUtrSet.has(drawerPayment.utr.toLowerCase().trim());
  }, [drawerPayment, confirmedUtrSet]);

  return (
    <div className="space-y-4 sm:space-y-5 text-foreground max-w-7xl mx-auto">
      {/* ====================================================================
          1. PAGE HEADER & RIGHT ACTIONS
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 bg-card border border-border p-4 sm:p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Payments
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage confirmed payments, verify member UPI submissions, and issue receipts.
          </p>
        </div>

        {/* Primary Action: Record Payment */}
        <div className="w-full sm:w-auto shrink-0">
          <RecordPaymentModal
            gymId={gymId}
            branches={branches}
            members={members}
          />
        </div>
      </div>

      {/* Global Action Banner Toast */}
      {actionMessage && (
        <div
          className={`px-4 py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-between border animate-in fade-in duration-200 ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="p-1 text-muted-foreground hover:text-foreground font-bold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          2. 4 LAYERED FINANCIAL KPI CARDS
          ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Confirmed Revenue */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Confirmed Revenue
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
            ₹{kpiData.confirmedRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground leading-snug break-words">
            {kpiData.confirmedCount} verified receipt{kpiData.confirmedCount === 1 ? "" : "s"}
          </div>
        </div>

        {/* KPI 2: UPI Collections */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-blue-500/30 transition-colors">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              UPI Collections
            </span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
            ₹{kpiData.upiTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground leading-snug break-words">
            {kpiData.upiCount} digital transfer{kpiData.upiCount === 1 ? "" : "s"}
          </div>
        </div>

        {/* KPI 3: Cash & Card */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-border transition-colors">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cash & Card
            </span>
            <div className="h-7 w-7 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
              <Banknote className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
            ₹{kpiData.cashAndCardTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground leading-snug break-words">
            Cash: ₹{kpiData.cashTotal.toLocaleString("en-IN")} • Card: ₹{kpiData.cardTotal.toLocaleString("en-IN")}
          </div>
        </div>

        {/* KPI 4: Pending Verification */}
        <div
          className={`bg-card rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between transition-all ${
            kpiData.pendingCount > 0
              ? "border-2 border-amber-500/40 bg-amber-500/5 shadow-amber-500/5"
              : "border border-border"
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Verification
            </span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums truncate">
            ₹{kpiData.pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 leading-snug break-words">
            {kpiData.pendingCount} awaiting review
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. VERIFICATION ATTENTION BANNER (Rendered when pendingCount > 0)
          ==================================================================== */}
      {tabCounts.pending > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">
                {tabCounts.pending} Member UPI Submission{tabCounts.pending === 1 ? "" : "s"} Awaiting Verification
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                Review UTR transfer claims, check proof slips, and approve to clear dues and issue receipts.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenReviewQueue}
            className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          4. 3-TAB NAVIGATION & COMPACT SEARCH/FILTERS
          ==================================================================== */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-3">
          {/* 3 Tabs with live count badges (3-Column Equal Grid on Mobile) */}
          <div className="w-full sm:w-auto grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-1 bg-muted p-1 rounded-xl text-xs sm:text-sm select-none">
            <button
              type="button"
              onClick={() => setActiveTab("confirmed")}
              className={`min-h-[44px] sm:min-h-0 px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 text-center ${
                activeTab === "confirmed"
                  ? "bg-card text-foreground border border-border shadow-xs sm:border-transparent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="sm:hidden">Confirmed</span>
              <span className="hidden sm:inline">Confirmed Ledger</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted-foreground/15 text-foreground tabular-nums shrink-0">
                {tabCounts.confirmed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`min-h-[44px] sm:min-h-0 px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 text-center ${
                activeTab === "pending"
                  ? "bg-card text-amber-600 dark:text-amber-400 border border-border shadow-xs sm:border-transparent"
                  : "text-muted-foreground hover:text-amber-600"
              }`}
            >
              <span className="sm:hidden">Pending</span>
              <span className="hidden sm:inline">Verification Queue</span>
              {tabCounts.pending > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white tabular-nums animate-pulse shrink-0">
                  {tabCounts.pending}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted-foreground/15 text-muted-foreground tabular-nums shrink-0">
                  0
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("rejected")}
              className={`min-h-[44px] sm:min-h-0 px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1 sm:gap-1.5 text-center ${
                activeTab === "rejected"
                  ? "bg-card text-rose-600 dark:text-rose-400 border border-border shadow-xs sm:border-transparent"
                  : "text-muted-foreground hover:text-rose-600"
              }`}
            >
              <span className="sm:hidden">Rejected</span>
              <span className="hidden sm:inline">Rejected History</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted-foreground/15 text-muted-foreground tabular-nums shrink-0">
                {tabCounts.rejected}
              </span>
            </button>
          </div>

          {/* Date Range Selector (2x2 Grid on Mobile) */}
          <div className="w-full lg:w-auto grid grid-cols-2 gap-1.5 lg:flex lg:items-center lg:gap-1 bg-muted p-1 rounded-xl text-xs sm:text-sm select-none">
            {(
              [
                { id: "this_month", label: "This Month" },
                { id: "30d", label: "Last 30 Days" },
                { id: "7d", label: "Last 7 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDateFilter(d.id)}
                className={`min-h-[40px] lg:min-h-0 px-2.5 py-2 lg:py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer flex items-center justify-center text-center ${
                  dateFilter === d.id
                    ? "bg-card text-foreground border border-border shadow-xs font-bold lg:border-transparent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Method Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Input (Full-width on mobile inside its own row) */}
          <div className="relative w-full min-w-0 sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search receipt, member, phone or UTR"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-w-0 pl-9 pr-3.5 h-10 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/25 font-medium transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Payment Method Filter (4-Column Equal Grid on Mobile) */}
          <div className="w-full sm:w-auto grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-1 bg-muted/60 p-1 rounded-xl text-xs select-none">
            {["all", "upi", "cash", "card"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`min-h-[40px] sm:min-h-0 px-2.5 py-2 sm:py-1 rounded-lg font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer flex items-center justify-center text-center ${
                  methodFilter === m
                    ? "bg-card text-foreground border border-border shadow-xs sm:border-transparent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          5. DESKTOP LEDGER TABLE (>= lg)
          ==================================================================== */}
      <div className="hidden lg:block bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[11px] border-b border-border select-none">
            <tr>
              <th className="py-3 px-4">Receipt Ref</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Member</th>
              <th className="py-3 px-3">Plan / Notes</th>
              <th className="py-3 px-3 text-right">Amount (₹)</th>
              <th className="py-3 px-3">Method</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {tabFilteredPayments.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <div className="max-w-xs mx-auto space-y-1.5">
                    <Receipt className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                    <div className="text-sm font-bold text-foreground">No payments found</div>
                    <div className="text-xs text-muted-foreground">
                      {search || methodFilter !== "all"
                        ? "Try clearing your search query or filters."
                        : `No ${activeTab} payments recorded for this time window.`}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              tabFilteredPayments.map((p) => {
                const cleanPhone = p.memberPhone.replace(/\D/g, "");
                const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                const waText =
                  `🧾 *${gymName} — Official Payment Receipt*\n\n` +
                  `Receipt Ref: #${p.id.slice(0, 8).toUpperCase()}\n` +
                  `Date: ${p.paymentDate}\n` +
                  `Member: ${p.memberName}\n` +
                  `Amount: ₹${p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${p.paymentMethod.toUpperCase()})\n` +
                  (p.utr ? `UTR: ${p.utr}\n` : "") +
                  `Status: ${p.paymentStatus.toUpperCase()}\n\n` +
                  `Thank you for training with us at ${gymName}! 💪`;
                const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`;

                const isPending = p.paymentStatus === "pending";
                const isRejected = p.paymentStatus === "rejected";
                const isPaid = p.paymentStatus === "paid" || p.paymentStatus === "partial";

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/40 transition-colors group select-none"
                  >
                    {/* 1. Receipt Ref */}
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-foreground whitespace-nowrap">
                      #{p.id.slice(0, 8).toUpperCase()}
                    </td>

                    {/* 2. Date */}
                    <td className="py-3.5 px-3 text-xs text-muted-foreground whitespace-nowrap font-medium">
                      {p.paymentDate}
                    </td>

                    {/* 3. Member */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                          {p.memberName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            href={`/app/${gymId}/members/${p.memberId}`}
                            className="font-bold text-xs text-foreground hover:text-primary transition-colors block truncate max-w-[160px]"
                          >
                            {p.memberName}
                          </Link>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {p.memberPhone || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. Plan / Notes */}
                    <td className="py-3.5 px-3 max-w-[180px]">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {p.planName || "Subscription Fee"}
                      </div>
                      {p.notes && (
                        <div className="text-[10px] text-muted-foreground truncate" title={p.notes}>
                          {p.notes}
                        </div>
                      )}
                    </td>

                    {/* 5. Amount */}
                    <td className="py-3.5 px-3 text-right font-black text-sm text-foreground tabular-nums whitespace-nowrap">
                      ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* 6. Method */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-muted text-foreground border border-border">
                        {p.paymentMethod}
                      </span>
                      {p.utr && (
                        <div
                          className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px] mt-0.5 cursor-pointer hover:text-foreground"
                          title={`UTR: ${p.utr} (Click to copy)`}
                          onClick={() => handleCopyUtr(p.utr!)}
                        >
                          UTR: {p.utr}
                        </div>
                      )}
                    </td>

                    {/* 7. Status */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                          <XCircle className="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                          <Check className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      )}
                    </td>

                    {/* 8. Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(p)}
                            className="inline-flex items-center gap-1 h-8 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer"
                            title="Open verification desk for this transfer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify Proof</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(p)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 bg-card hover:bg-muted text-foreground border border-border rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                          title="View / Print Receipt"
                        >
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Receipt</span>
                        </button>

                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-8 px-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/25 rounded-lg font-semibold text-xs transition-colors"
                          title="Share Receipt text on WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Table Footer Count */}
        <div className="p-3 bg-muted/20 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Showing <strong className="text-foreground">{tabFilteredPayments.length}</strong> of{" "}
            {dateFilteredPayments.length} recorded payments
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            All timestamps recorded in Indian Standard Time (IST)
          </span>
        </div>
      </div>

      {/* ====================================================================
          6. MOBILE TRANSACTION CARDS (< lg — Dedicated Zero-Scroll Layout)
          ==================================================================== */}
      <div className="block lg:hidden space-y-2.5">
        {tabFilteredPayments.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground space-y-2">
            <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <div className="text-sm font-bold text-foreground">No payments found</div>
            <div className="text-xs text-muted-foreground">
              {search || methodFilter !== "all"
                ? "Try adjusting your search query or filters."
                : `No ${activeTab} payments recorded for this time window.`}
            </div>
          </div>
        ) : (
          tabFilteredPayments.map((p) => {
            const cleanPhone = p.memberPhone.replace(/\D/g, "");
            const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
            const waText =
              `🧾 *${gymName} — Payment Receipt*\n\n` +
              `Receipt Ref: #${p.id.slice(0, 8).toUpperCase()}\n` +
              `Date: ${p.paymentDate}\n` +
              `Member: ${p.memberName}\n` +
              `Amount: ₹${p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${p.paymentMethod.toUpperCase()})\n` +
              (p.utr ? `UTR: ${p.utr}\n` : "") +
              `Status: ${p.paymentStatus.toUpperCase()}\n\n` +
              `Thank you for training with us! 💪`;
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`;

            const isPending = p.paymentStatus === "pending";
            const isRejected = p.paymentStatus === "rejected";

            return (
              <div
                key={p.id}
                className="bg-card border border-border rounded-xl p-3.5 space-y-2.5 shadow-xs"
              >
                {/* Card Top Row: Ref ID + Member + Status Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-xs text-foreground block">
                      #{p.id.slice(0, 8).toUpperCase()}
                    </span>
                    <Link
                      href={`/app/${gymId}/members/${p.memberId}`}
                      className="font-bold text-sm text-foreground hover:text-primary transition-colors block truncate"
                    >
                      {p.memberName}
                    </Link>
                    <span className="text-xs text-muted-foreground font-mono block">
                      {p.memberPhone}
                    </span>
                  </div>

                  <div>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        <Clock className="w-3 h-3" />
                        <span>Pending</span>
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                        <XCircle className="w-3 h-3" />
                        <span>Rejected</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                        <Check className="w-3 h-3" />
                        <span>Approved</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Middle Row: Amount + Date + Method/UTR */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div>
                    <div className="text-base font-black text-foreground tabular-nums">
                      ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{p.paymentDate}</div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-muted text-foreground border border-border">
                      {p.paymentMethod}
                    </span>
                    {p.utr && (
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[140px]">
                        UTR: {p.utr}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Row: Action Buttons */}
                <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer(p)}
                      className="w-full h-9 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Review Proof & Verify</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenReceipt(p)}
                        className="flex-1 h-8.5 rounded-xl bg-card hover:bg-muted text-foreground border border-border font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Receipt</span>
                      </button>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 h-8.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/25 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ====================================================================
          7. RIGHT-SIDE VERIFICATION DRAWER (Slide-Over Sheet)
          ==================================================================== */}
      {drawerPayment && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setDrawerPayment(null)}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full sm:w-[480px] max-w-full bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 text-foreground">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Verification Desk
                  </h2>
                  <div className="text-xs text-muted-foreground font-mono">
                    Submission #{drawerPayment.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerPayment(null)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Duplicate UTR Warning if already in confirmed ledger */}
              {isDuplicateUtrInDrawer && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Duplicate UTR Detected!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                    This UTR (<strong>{drawerPayment.utr}</strong>) has already been used on a confirmed payment in your ledger. Cross-check your actual bank statement before approving.
                  </p>
                </div>
              )}

              {/* Member & Payment Summary Card */}
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
                      {drawerPayment.memberName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">
                        {drawerPayment.memberName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {drawerPayment.memberPhone}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${drawerPayment.memberPhone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/25"
                    title="Chat with member on WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Plan / Item
                    </span>
                    <span className="font-semibold text-foreground truncate block">
                      {drawerPayment.planName || "Membership Fee"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Submission Date
                    </span>
                    <span className="font-semibold text-foreground block">
                      {drawerPayment.paymentDate}
                    </span>
                  </div>
                </div>

                {/* Big Submitted Amount */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                      Claimed Amount
                    </span>
                    <span className="text-2xl font-black text-foreground tabular-nums">
                      ₹{drawerPayment.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                    UPI Transfer
                  </span>
                </div>

                {/* UTR Reference with Copy Button */}
                {drawerPayment.utr ? (
                  <div className="p-2.5 rounded-lg bg-card border border-border flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        UTR / Transaction Reference
                      </span>
                      <span className="font-mono font-bold text-xs text-foreground truncate block select-all">
                        {drawerPayment.utr}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyUtr(drawerPayment.utr!)}
                      className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedUtr ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUtr ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    No explicit UTR reference provided in member submission note.
                  </div>
                )}
              </div>

              {/* Payment Proof Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Payment Proof Slip
                </label>

                {drawerPayment.proofUrl ? (
                  <div className="rounded-xl border border-border overflow-hidden bg-black/5 relative group">
                    <img
                      src={drawerPayment.proofUrl}
                      alt="Member Payment Proof"
                      className="w-full max-h-72 object-contain bg-background mx-auto"
                    />
                    <a
                      href={drawerPayment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-bold inline-flex items-center gap-1 shadow-md transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open Full Size</span>
                    </a>
                  </div>
                ) : (
                  /* Clean Structured UPI Transfer Summary Card */
                  <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-2.5">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                      <span className="font-bold text-foreground">Digital Receipt Claim</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">
                        Self-Service Portal
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Beneficiary Gym</span>
                        <span className="font-semibold text-foreground">{gymName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paying Member</span>
                        <span className="font-semibold text-foreground">{drawerPayment.memberName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount Claimed</span>
                        <span className="font-bold text-foreground">₹{drawerPayment.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UTR Number</span>
                        <span className="font-mono font-semibold text-foreground">{drawerPayment.utr || "Pending Match"}</span>
                      </div>
                    </div>

                    <div className="pt-2 text-[11px] text-muted-foreground border-t border-border/60 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Member submitted this confirmation claim without an uploaded image attachment.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Verification Checklist */}
              <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Verification Checklist
                </span>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checklistVerified}
                    onChange={(e) => setChecklistVerified(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 mt-0.5 cursor-pointer"
                  />
                  <span className="text-xs text-foreground font-medium leading-tight">
                    I have verified the UTR ({drawerPayment.utr || "reference"}) and amount of ₹{drawerPayment.amount} on the gym&apos;s bank statement or UPI merchant app.
                  </span>
                </label>
              </div>

              {/* Collapsible Reject Reason Input */}
              {showRejectInput && (
                <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-2 animate-in fade-in duration-150">
                  <label className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                    Decline Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR not found in bank statement, amount mismatch..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full h-9 px-3 bg-card border border-rose-500/30 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 font-medium"
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(false)}
                      className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectFromDrawer}
                      disabled={isVerifying}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                    >
                      {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      <span>Confirm Decline</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card space-y-2">
              <div className="flex items-center gap-2">
                {!showRejectInput && (
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isVerifying}
                    className="flex-1 h-10 px-3 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApproveFromDrawer}
                  disabled={isVerifying}
                  className={`h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                    showRejectInput ? "w-full" : "flex-[2]"
                  } bg-primary hover:opacity-95 text-primary-foreground`}
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Approve &amp; Issue Receipt</span>
                </button>
              </div>

              {!checklistVerified && (
                <div className="text-[11px] text-center text-muted-foreground">
                  Tip: Confirm the checklist item above before final approval.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          8. OFFICIAL RECEIPT MODAL
          ==================================================================== */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
