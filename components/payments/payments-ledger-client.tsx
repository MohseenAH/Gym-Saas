"use client";

import { useState, useMemo, startTransition } from "react";
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
  Banknote,
  X,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Wallet,
  QrCode,
  Landmark,
  Layers,
  MoreVertical,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { FilterPillBar } from "@/components/ui/filter-pill-bar";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";
import { RecordPaymentModal } from "@/components/payments/record-payment-modal";
import { verifyPaymentAction, rejectPaymentAction } from "@/lib/actions/payments";
import { formatDate } from "@/lib/utils";

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
  todayStr: string;
  payments: PaymentLedgerItem[];
  members: { id: string; fullName: string; phone: string; branchId: string }[];
  branches: { id: string; name: string }[];
}

export type TabType = "all" | "confirmed" | "pending" | "rejected";
export type MethodFilterType = "all" | "cash" | "digital" | "upi" | "bank_transfer" | "card";
export type DateFilterType = "this_month" | "30d" | "7d" | "all";

function formatMethodLabel(method: string): string {
  switch (method) {
    case "upi":
      return "UPI";
    case "cash":
      return "Cash";
    case "bank_transfer":
      return "Bank";
    case "card":
      return "Card";
    case "cheque":
      return "Cheque";
    default:
      return "Other";
  }
}

export function PaymentsLedgerClient({
  gymId,
  gymName,
  todayStr,
  payments: initialPayments,
  members,
  branches,
}: PaymentsLedgerClientProps) {
  const router = useRouter();

  // Optimistic overrides layered over server prop (no setState in useEffect)
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, { paymentStatus: string; notes?: string | null }>
  >({});

  const paymentsList = useMemo(() => {
    return initialPayments.map((p) => {
      const ov = statusOverrides[p.id];
      return ov ? { ...p, ...ov } : p;
    });
  }, [initialPayments, statusOverrides]);

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<MethodFilterType>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("this_month");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Verification Drawer State
  const [drawerPayment, setDrawerPayment] = useState<PaymentLedgerItem | null>(null);
  const [checklistVerified, setChecklistVerified] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Confirmed UTR set for duplicate UTR warning
  const confirmedUtrSet = useMemo(() => {
    const set = new Set<string>();
    paymentsList.forEach((p) => {
      if ((p.paymentStatus === "paid" || p.paymentStatus === "partial") && p.utr) {
        set.add(p.utr.toLowerCase().trim());
      }
    });
    return set;
  }, [paymentsList]);

  // Date boundaries from server todayStr (IST)
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
      return true;
    });
  }, [paymentsList, dateFilter, dateBoundaries]);

  // Financial KPIs: ONLY confirmed (paid / partial) contribute to Collected!
  const kpiData = useMemo(() => {
    const confirmed = dateFilteredPayments.filter(
      (p) => p.paymentStatus === "paid" || p.paymentStatus === "partial"
    );
    const pending = dateFilteredPayments.filter(
      (p) => p.paymentStatus === "pending"
    );

    let confirmedRevenue = 0;
    let cashTotal = 0;
    let digitalTotal = 0;

    confirmed.forEach((p) => {
      confirmedRevenue += p.amount;
      if (p.paymentMethod === "cash") {
        cashTotal += p.amount;
      } else {
        digitalTotal += p.amount;
      }
    });

    const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

    return {
      confirmedRevenue: Math.round(confirmedRevenue * 100) / 100,
      confirmedCount: confirmed.length,
      cashTotal: Math.round(cashTotal * 100) / 100,
      cashCount: confirmed.filter((p) => p.paymentMethod === "cash").length,
      digitalTotal: Math.round(digitalTotal * 100) / 100,
      digitalCount: confirmed.filter((p) => p.paymentMethod !== "cash").length,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      pendingCount: pending.length,
    };
  }, [dateFilteredPayments]);

  const tabCounts = useMemo(() => {
    return {
      all: dateFilteredPayments.length,
      confirmed: dateFilteredPayments.filter(
        (p) => p.paymentStatus === "paid" || p.paymentStatus === "partial"
      ).length,
      pending: dateFilteredPayments.filter((p) => p.paymentStatus === "pending")
        .length,
      rejected: dateFilteredPayments.filter(
        (p) => p.paymentStatus === "rejected"
      ).length,
    };
  }, [dateFilteredPayments]);

  const tabFilteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dateFilteredPayments.filter((p) => {
      if (activeTab === "confirmed") {
        if (p.paymentStatus !== "paid" && p.paymentStatus !== "partial") return false;
      } else if (activeTab === "pending") {
        if (p.paymentStatus !== "pending") return false;
      } else if (activeTab === "rejected") {
        if (p.paymentStatus !== "rejected") return false;
      }

      if (methodFilter === "cash" && p.paymentMethod !== "cash") return false;
      if (methodFilter === "digital" && p.paymentMethod === "cash") return false;
      if (
        methodFilter !== "all" &&
        methodFilter !== "cash" &&
        methodFilter !== "digital" &&
        p.paymentMethod !== methodFilter
      ) {
        return false;
      }

      if (!q) return true;
      return (
        p.memberName.toLowerCase().includes(q) ||
        p.memberPhone.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.utr ? p.utr.toLowerCase().includes(q) : false) ||
        (p.notes ? p.notes.toLowerCase().includes(q) : false)
      );
    });
  }, [dateFilteredPayments, activeTab, methodFilter, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(tabFilteredPayments.length / rowsPerPage)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPayments = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return tabFilteredPayments.slice(start, start + rowsPerPage);
  }, [tabFilteredPayments, safePage, rowsPerPage]);

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
        setActionMessage({
          type: "error",
          text: res.error || "Failed to verify payment.",
        });
        setIsVerifying(false);
        return;
      }

      setStatusOverrides((prev) => ({
        ...prev,
        [drawerPayment.id]: { paymentStatus: "paid" },
      }));

      setActionMessage({
        type: "success",
        text: `Payment of ₹${drawerPayment.amount.toLocaleString(
          "en-IN"
        )} for ${drawerPayment.memberName} approved!`,
      });

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
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error verifying payment.",
      });
    } finally {
      setIsVerifying(false);
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
        setActionMessage({
          type: "error",
          text: res.error || "Failed to reject payment claim.",
        });
        setIsVerifying(false);
        return;
      }

      setStatusOverrides((prev) => ({
        ...prev,
        [drawerPayment.id]: {
          paymentStatus: "rejected",
          notes: `${drawerPayment.notes || ""} [REJECTED: ${
            rejectionReason.trim() || "Declined by front desk"
          }]`.trim(),
        },
      }));

      setActionMessage({
        type: "success",
        text: "Payment submission declined.",
      });
      setDrawerPayment(null);
      setShowRejectInput(false);
      setRejectionReason("");
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error rejecting payment.",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  function handleOpenReviewQueue() {
    setActiveTab("pending");
    setCurrentPage(1);
    const firstPending = dateFilteredPayments.find(
      (p) => p.paymentStatus === "pending"
    );
    if (firstPending) {
      handleOpenDrawer(firstPending);
    }
  }

  function handleOpenDrawer(p: PaymentLedgerItem) {
    setDrawerPayment(p);
    setChecklistVerified(false);
    setShowRejectInput(false);
    setRejectionReason("");
  }

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

  const periodLabel =
    dateFilter === "this_month"
      ? "This Month"
      : dateFilter === "30d"
      ? "Last 30 Days"
      : dateFilter === "7d"
      ? "Last 7 Days"
      : "All Time";

  const startIndex =
    tabFilteredPayments.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(
    safePage * rowsPerPage,
    tabFilteredPayments.length
  );

  function renderStatusBadge(status: string) {
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/25">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/12 text-rose-700 dark:text-rose-400 border border-rose-500/25">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    if (status === "refunded") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/12 text-slate-700 dark:text-slate-400 border border-slate-500/25">
          Refunded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
        <Check className="w-3 h-3" />
        {status === "partial" ? "Partial" : "Confirmed"}
      </span>
    );
  }

  function renderMethodIcon(method: string) {
    if (method === "upi") return <QrCode className="w-3.5 h-3.5 text-primary" />;
    if (method === "bank_transfer")
      return <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    if (method === "card")
      return <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
    return <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
  }

  return (
    <div className="space-y-5 text-foreground">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
            Payments
          </h1>
        </div>

        <button
          type="button"
          onClick={handleOpenReviewQueue}
          className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95 transition-opacity shrink-0 cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Verification Queue</span>
          <span className="sm:hidden">Queue</span>
          {tabCounts.pending > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white tabular-nums">
              {tabCounts.pending}
            </span>
          )}
        </button>
      </div>

      {/* Global Action Banner */}
      {actionMessage && (
        <div
          className={`px-4 py-3 text-xs font-semibold rounded-2xl flex items-center justify-between border ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
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
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard
          compact
          label={`Collected (${periodLabel})`}
          value={`₹${kpiData.confirmedRevenue.toLocaleString("en-IN")}`}
          variant="green"
          icon={<Wallet className="w-4 h-4" />}
          subtext={`${kpiData.confirmedCount} confirmed`}
          onClick={() => {
            setActiveTab("confirmed");
            setMethodFilter("all");
            setCurrentPage(1);
          }}
          active={activeTab === "confirmed" && methodFilter === "all"}
        />

        <KpiCard
          compact
          label="Pending Verification"
          value={`₹${kpiData.pendingAmount.toLocaleString("en-IN")}`}
          variant="amber"
          icon={<Clock className="w-4 h-4" />}
          subtext={`${kpiData.pendingCount} submissions`}
          onClick={() => {
            setActiveTab("pending");
            setCurrentPage(1);
          }}
          active={activeTab === "pending"}
        />

        <KpiCard
          compact
          label="Cash Collected"
          value={`₹${kpiData.cashTotal.toLocaleString("en-IN")}`}
          variant="purple"
          icon={<Banknote className="w-4 h-4" />}
          subtext={`${kpiData.cashCount} receipts`}
          onClick={() => {
            setActiveTab("confirmed");
            setMethodFilter("cash");
            setCurrentPage(1);
          }}
          active={methodFilter === "cash"}
        />

        <KpiCard
          compact
          label="Digital Collected"
          value={`₹${kpiData.digitalTotal.toLocaleString("en-IN")}`}
          variant="blue"
          icon={<QrCode className="w-4 h-4" />}
          subtext={`${kpiData.digitalCount} transfers`}
          onClick={() => {
            setActiveTab("confirmed");
            setMethodFilter("digital");
            setCurrentPage(1);
          }}
          active={methodFilter === "digital"}
        />
      </div>

      {/* 2 Prominent Soft-Tinted Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RecordPaymentModal
          gymId={gymId}
          branches={branches}
          members={members}
          renderTrigger={(openModal) => (
            <button
              type="button"
              onClick={openModal}
              className="group flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-500/20 bg-purple-500/8 hover:bg-purple-500/14 text-left transition-all cursor-pointer w-full"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black text-foreground">
                    Record Payment
                  </div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    Manually record cash, UPI, or bank payments.
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}
        />

        <button
          type="button"
          onClick={handleOpenReviewQueue}
          className="group flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-blue-500/20 bg-blue-500/8 hover:bg-blue-500/14 text-left transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-foreground flex items-center gap-2">
                <span>Review Submissions</span>
                {tabCounts.pending > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {tabCounts.pending}
                  </span>
                )}
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                Verify member UPI screenshots and UTR details.
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </div>

      {/* Mobile Search & Filters Toolbar */}
      <div className="md:hidden space-y-2">
        {/* Row 1: Full-width Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by member, reference or UTR..."
            aria-label="Search payments"
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Row 2: Payment Status Criteria */}
        <FilterPillBar
          ariaLabel="Payment status criteria"
          value={activeTab}
          onChange={(id) => {
            setActiveTab(id);
            setCurrentPage(1);
          }}
          items={[
            { id: "all", label: `All (${tabCounts.all})` },
            { id: "confirmed", label: `Confirmed (${tabCounts.confirmed})` },
            { id: "pending", label: `Pending (${tabCounts.pending})` },
            { id: "rejected", label: `Rejected (${tabCounts.rejected})` },
          ]}
        />

        {/* Row 3: Payment Method + Date/Period Dropdowns */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative flex items-center">
            <CreditCard className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value as MethodFilterType);
                setCurrentPage(1);
              }}
              aria-label="Filter payments by method"
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-card border border-border text-xs font-semibold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="digital">Digital</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 pointer-events-none" />
          </div>

          <div className="relative flex items-center">
            <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilterType);
                setCurrentPage(1);
              }}
              aria-label="Filter payments by date range"
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-card border border-border text-xs font-semibold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="this_month">This Month</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="all">All Time</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Desktop Search & Filters */}
      <div className="hidden md:block space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by member name, reference, or UTR..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: "all", label: `All (${tabCounts.all})` },
                { id: "confirmed", label: `Confirmed (${tabCounts.confirmed})` },
                { id: "pending", label: `Pending (${tabCounts.pending})` },
                { id: "rejected", label: `Rejected (${tabCounts.rejected})` },
              ] as const
            ).map((pill) => {
              const active = activeTab === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(pill.id);
                    setCurrentPage(1);
                  }}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "all", label: "All Methods" },
                { id: "cash", label: "Cash" },
                { id: "digital", label: "Digital" },
                { id: "upi", label: "UPI" },
                { id: "bank_transfer", label: "Bank" },
              ] as const
            ).map((m) => {
              const active = methodFilter === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMethodFilter(m.id);
                    setCurrentPage(1);
                  }}
                  className={`h-8 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-primary/12 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilterType);
                setCurrentPage(1);
              }}
              aria-label="Filter payments by date range"
              className="h-9 pl-8 pr-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground"
            >
              <option value="this_month">This Month</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Payments Table */}
      <div className="hidden md:block bg-card rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border text-[11px]">
              <tr>
                <th className="py-3.5 pl-5 pr-3">Member</th>
                <th className="py-3.5 px-3">Amount</th>
                <th className="py-3.5 px-3">Method</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Reference</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No payment records match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((p) => {
                  const isPending = p.paymentStatus === "pending";
                  const isRejected = p.paymentStatus === "rejected";
                  const cleanPhone = p.memberPhone.replace(/\D/g, "");
                  const waPhone =
                    cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                    `Receipt #${p.id.slice(0, 8).toUpperCase()} — ₹${p.amount.toLocaleString(
                      "en-IN"
                    )} (${p.paymentStatus.toUpperCase()}) at ${gymName}.`
                  )}`;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-1 h-9 rounded-full shrink-0 ${
                              isPending
                                ? "bg-amber-500"
                                : isRejected
                                ? "bg-rose-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-xs shrink-0">
                            {p.memberName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/app/${gymId}/members/${p.memberId}`}
                              className="font-bold text-foreground hover:underline truncate block"
                            >
                              {p.memberName}
                            </Link>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              #{p.memberId.slice(0, 8).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-black text-foreground tabular-nums">
                        ₹{p.amount.toLocaleString("en-IN")}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                          {renderMethodIcon(p.paymentMethod)}
                          {formatMethodLabel(p.paymentMethod)}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-muted-foreground font-medium">
                        {formatDate(p.paymentDate)}
                      </td>

                      <td className="py-3.5 px-3">
                        {renderStatusBadge(p.paymentStatus)}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {p.utr
                          ? `UTR-${p.utr}`
                          : `REC-${p.id.slice(0, 6).toUpperCase()}`}
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5 relative">
                          <button
                            type="button"
                            onClick={() =>
                              isPending
                                ? handleOpenDrawer(p)
                                : handleOpenReceipt(p)
                            }
                            className="inline-flex items-center gap-1 h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors cursor-pointer"
                          >
                            {isPending ? "Verify" : "View"}
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            aria-label="Payment row actions"
                            onClick={() =>
                              setOpenMenuId((prev) =>
                                prev === p.id ? null : p.id
                              )
                            }
                            className="h-8 w-8 inline-flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === p.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 top-9 w-44 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-left text-xs font-semibold">
                                {!isPending && !isRejected && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenReceipt(p);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                    View Receipt
                                  </button>
                                )}
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenDrawer(p);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                    Review Proof
                                  </button>
                                )}
                                {cleanPhone.length >= 7 && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setOpenMenuId(null)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    Share on WhatsApp
                                  </a>
                                )}
                                {p.utr && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleCopyUtr(p.utr!);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    Copy UTR
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Payment Cards */}
      <div className="md:hidden space-y-2.5">
        {paginatedPayments.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-xs text-muted-foreground">
            No payment records match the current filters.
          </div>
        ) : (
          paginatedPayments.map((p) => {
            const isPending = p.paymentStatus === "pending";
            const isRejected = p.paymentStatus === "rejected";

            return (
              <div
                key={p.id}
                className="bg-card rounded-2xl border border-border p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-1 h-10 rounded-full shrink-0 ${
                      isPending
                        ? "bg-amber-500"
                        : isRejected
                        ? "bg-rose-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-xs shrink-0">
                    {p.memberName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-foreground truncate">
                      {p.memberName}
                    </div>
                    <div className="text-xs font-black text-foreground">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {formatMethodLabel(p.paymentMethod)} •{" "}
                      {p.utr
                        ? `UTR-${p.utr}`
                        : `REC-${p.id.slice(0, 6).toUpperCase()}`}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {renderStatusBadge(p.paymentStatus)}
                  <button
                    type="button"
                    onClick={() =>
                      isPending ? handleOpenDrawer(p) : handleOpenReceipt(p)
                    }
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {isPending ? "Verify →" : "Receipt →"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-bold text-foreground">
            {startIndex}–{endIndex}
          </span>{" "}
          of{" "}
          <span className="font-bold text-foreground">
            {tabFilteredPayments.length}
          </span>{" "}
          records
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-foreground">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label="Rows per page"
            className="h-8 px-2 rounded-xl border border-border bg-card text-foreground font-bold"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Verification Desk Drawer (Preserved) */}
      {drawerPayment && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDrawerPayment(null)}
          />
          <div className="relative z-10 w-full sm:w-[460px] max-w-full bg-card border-l border-border shadow-2xl flex flex-col h-full text-foreground">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">
                    Review Submission
                  </h2>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    #{drawerPayment.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerPayment(null)}
                className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {isDuplicateUtrInDrawer && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Duplicate UTR Detected!</span>
                  </div>
                  <p className="text-[11px]">
                    UTR <strong>{drawerPayment.utr}</strong> already exists on a
                    confirmed payment. Verify your bank statement before approving.
                  </p>
                </div>
              )}

              <div className="bg-muted/35 border border-border rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-foreground">
                      {drawerPayment.memberName}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      #{drawerPayment.memberId.slice(0, 8).toUpperCase()}
                    </div>
                  </div>
                  <span className="font-black text-lg text-foreground">
                    ₹{drawerPayment.amount.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Plan / Item
                    </span>
                    <span className="font-semibold text-foreground">
                      {drawerPayment.planName || "Membership Fee"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Date
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDate(drawerPayment.paymentDate)}
                    </span>
                  </div>
                </div>

                {drawerPayment.utr && (
                  <div className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        UTR Number
                      </span>
                      <span className="font-mono font-bold text-foreground truncate block">
                        {drawerPayment.utr}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyUtr(drawerPayment.utr!)}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedUtr ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedUtr ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>

              {drawerPayment.proofUrl ? (
                <div className="rounded-2xl border border-border overflow-hidden bg-muted/20 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={drawerPayment.proofUrl}
                    alt="Member Payment Proof"
                    className="w-full max-h-64 object-contain mx-auto"
                  />
                  <a
                    href={drawerPayment.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-border bg-muted/20 text-xs text-muted-foreground">
                  No screenshot attached with this UPI submission.
                </div>
              )}

              <label className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-border bg-card cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={checklistVerified}
                  onChange={(e) => setChecklistVerified(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <span>
                  I verified this UTR and ₹
                  {drawerPayment.amount.toLocaleString("en-IN")} deposit in the
                  gym bank/UPI account.
                </span>
              </label>

              {showRejectInput && (
                <div className="p-3.5 rounded-2xl bg-rose-500/8 border border-rose-500/25 space-y-2 text-xs">
                  <label className="block font-bold text-rose-600 dark:text-rose-400">
                    Rejection Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. UTR mismatch or not credited"
                    className="w-full h-9 px-3 rounded-xl bg-background border border-rose-500/30 text-foreground"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(false)}
                      className="px-3 py-1.5 font-semibold text-muted-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={handleRejectFromDrawer}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-border bg-card flex items-center gap-2">
              {!showRejectInput && (
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => setShowRejectInput(true)}
                  className="flex-1 h-10 rounded-xl border border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              )}
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleApproveFromDrawer}
                className="flex-[2] h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve &amp; Issue Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
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
