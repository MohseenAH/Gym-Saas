"use client";

import {
  useState,
  useMemo,
  useSyncExternalStore,
  startTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Target,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  AlertCircle,
  Clock,
  Search,
  Plus,
  X,
  CheckCircle2,
  CreditCard,
  Loader2,
  MoreVertical,
  RefreshCw,
  User,
  Wallet,
  XCircle,
  Hourglass,
  FileEdit,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  RenewMembershipModal,
  MembershipPlanOption,
} from "@/components/members/renew-membership-modal";
import { recordPaymentAction } from "@/lib/actions/payments";

export interface FollowUpMember {
  id: string;
  memberId: string;
  membershipId: string;
  code: string;
  fullName: string;
  phone: string;
  email?: string | null;
  branchId: string;
  branchName: string;
  planId: string;
  planName: string;
  planPrice: number;
  totalPaid: number;
  dueAmount: number;
  endDate: string;
  formattedEndDate: string;
  startDate: string;
  formattedStartDate: string;
  daysDiff: number;
  daysOverdue: number;
  isExpiring: boolean;
  isPending: boolean;
  isOverdue: boolean;
  isTrialEnding: boolean;
  isTrial: boolean;
  membershipStatus: string;
}

interface MemberForPayment {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface FollowUpsClientProps {
  gymId: string;
  gymName: string;
  todayStr: string;
  members: FollowUpMember[];
  allMembersForPayment: MemberForPayment[];
  plans: MembershipPlanOption[];
  branches: BranchOption[];
  canRecordPayments: boolean;
  canManageMembers: boolean;
}

type CategoryTab = "all" | "expiring" | "pending" | "overdue" | "trial_ending";
type SortOption = "urgency" | "balance" | "name";

interface MessageScript {
  key: string;
  title: string;
  template: string;
}

const DEFAULT_SCRIPTS: Record<string, MessageScript> = {
  gentle: {
    key: "gentle",
    title: "Renewal / Payment Reminder",
    template:
      "Hi {memberName}, friendly reminder from {gymName} regarding your {planName} membership ({statusInfo}). Please drop by the desk or reach out if you'd like to renew or clear your balance.",
  },
  urgent: {
    key: "urgent",
    title: "Overdue Renewal",
    template:
      "Hi {memberName}, your {planName} membership at {gymName} has expired ({statusInfo}). Renew today to continue uninterrupted gym access!",
  },
  partial: {
    key: "partial",
    title: "Pending Balance",
    template:
      "Hi {memberName}, you have a remaining balance of ₹{dueAmount} for your {planName} membership at {gymName}. Kindly settle it at the front desk or via UPI.",
  },
};

// Lightweight external store for localStorage follow-up notes & scripts (SSR-safe)
let storageListeners: Array<() => void> = [];
function subscribeStorage(listener: () => void) {
  storageListeners.push(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    storageListeners = storageListeners.filter((l) => l !== listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}
function emitStorageChange() {
  storageListeners.forEach((l) => l());
}

const EMPTY_STATUSES_JSON = "{}";
const DEFAULT_SCRIPTS_JSON = JSON.stringify(DEFAULT_SCRIPTS);

function getFollowUpStatusSnapshot(memberId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(`gymapra_followup_${memberId}`) || "";
  } catch {
    return "";
  }
}

function getAllStatusesSnapshot(): string {
  if (typeof window === "undefined") return EMPTY_STATUSES_JSON;
  try {
    return localStorage.getItem("gymapra_followup_status_map") || EMPTY_STATUSES_JSON;
  } catch {
    return EMPTY_STATUSES_JSON;
  }
}

function getScriptsSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_SCRIPTS_JSON;
  try {
    return localStorage.getItem("gymapra_followup_scripts") || DEFAULT_SCRIPTS_JSON;
  } catch {
    return DEFAULT_SCRIPTS_JSON;
  }
}

export function FollowUpsClient({
  gymId,
  gymName,
  todayStr,
  members,
  allMembersForPayment,
  plans,
  branches,
  canRecordPayments,
  canManageMembers,
}: FollowUpsClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Synced localStorage stores without setState in useEffect
  const statusMapRaw = useSyncExternalStore(
    subscribeStorage,
    getAllStatusesSnapshot,
    () => EMPTY_STATUSES_JSON
  );
  const scriptsRaw = useSyncExternalStore(
    subscribeStorage,
    getScriptsSnapshot,
    () => DEFAULT_SCRIPTS_JSON
  );

  const followUpStatuses: Record<string, string> = useMemo(() => {
    try {
      return JSON.parse(statusMapRaw);
    } catch {
      return {};
    }
  }, [statusMapRaw]);

  const scripts: Record<string, MessageScript> = useMemo(() => {
    try {
      return JSON.parse(scriptsRaw);
    } catch {
      return DEFAULT_SCRIPTS;
    }
  }, [scriptsRaw]);

  const [activeScriptKey, setActiveScriptKey] = useState<string>("gentle");
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [editingScripts, setEditingScripts] =
    useState<Record<string, MessageScript>>(DEFAULT_SCRIPTS);

  // Promise-to-Pay modal
  const [promiseModalMember, setPromiseModalMember] =
    useState<FollowUpMember | null>(null);
  const [promiseDateInput, setPromiseDateInput] = useState("");

  // Renew Membership modal
  const [renewMember, setRenewMember] = useState<FollowUpMember | null>(null);

  // Record Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMemberId, setPaymentMemberId] = useState("");
  const [paymentMembershipId, setPaymentMembershipId] = useState<string | null>(
    null
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other"
  >("cash");
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [waReceiptUrl, setWaReceiptUrl] = useState<string | null>(null);

  // Branch-scoped members
  const branchMembers = useMemo(() => {
    if (selectedBranchId === "all") return members;
    return members.filter((m) => m.branchId === selectedBranchId);
  }, [members, selectedBranchId]);

  // Approved KPI category counts (non-mutually-exclusive)
  const expiringMembers = useMemo(
    () => branchMembers.filter((m) => m.isExpiring),
    [branchMembers]
  );
  const pendingMembers = useMemo(
    () => branchMembers.filter((m) => m.isPending),
    [branchMembers]
  );
  const overdueMembers = useMemo(
    () => branchMembers.filter((m) => m.isOverdue),
    [branchMembers]
  );
  const trialEndingMembers = useMemo(
    () => branchMembers.filter((m) => m.isTrialEnding),
    [branchMembers]
  );

  const pendingTotal = useMemo(
    () => pendingMembers.reduce((sum, m) => sum + m.dueAmount, 0),
    [pendingMembers]
  );

  // Filter + Sort according to Section 6 urgency rules
  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = branchMembers.filter((m) => {
      if (activeTab === "expiring" && !m.isExpiring) return false;
      if (activeTab === "pending" && !m.isPending) return false;
      if (activeTab === "overdue" && !m.isOverdue) return false;
      if (activeTab === "trial_ending" && !m.isTrialEnding) return false;

      if (selectedPlanId !== "all" && m.planId !== selectedPlanId) return false;

      if (q) {
        const matchName = m.fullName.toLowerCase().includes(q);
        const matchPhone = m.phone.toLowerCase().includes(q);
        const matchCode = m.code.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode) return false;
      }

      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "name") {
        return a.fullName.localeCompare(b.fullName);
      }
      if (sortBy === "balance") {
        return b.dueAmount - a.dueAmount;
      }

      // Urgency sorting per category (Section 6)
      if (activeTab === "expiring" || activeTab === "trial_ending") {
        return a.daysDiff - b.daysDiff;
      }
      if (activeTab === "pending") {
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return b.dueAmount - a.dueAmount;
      }
      if (activeTab === "overdue") {
        // Most recently expired first (e.g. -1 before -25)
        return b.daysDiff - a.daysDiff;
      }

      // Combined "All" urgency: soonest expiring/trial first, then recent overdue, then pending
      const rank = (m: FollowUpMember) => {
        if (m.isTrialEnding) return 0;
        if (m.isExpiring) return 1;
        if (m.isOverdue) return 2;
        return 3;
      };
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0 || ra === 1) return a.daysDiff - b.daysDiff;
      if (ra === 2) return b.daysDiff - a.daysDiff;
      return b.daysOverdue - a.daysOverdue;
    });

    return sorted;
  }, [
    branchMembers,
    activeTab,
    selectedPlanId,
    searchQuery,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / rowsPerPage)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMembers = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredAndSorted.slice(start, start + rowsPerPage);
  }, [filteredAndSorted, safePage, rowsPerPage]);

  function getMemberFollowUpStatus(memberId: string): string {
    return (
      followUpStatuses[memberId] ||
      getFollowUpStatusSnapshot(memberId) ||
      "Never contacted"
    );
  }

  function updateFollowUpStatus(memberId: string, status: string) {
    try {
      const nextMap = { ...followUpStatuses, [memberId]: status };
      localStorage.setItem("gymapra_followup_status_map", JSON.stringify(nextMap));
      localStorage.setItem(`gymapra_followup_${memberId}`, status);
      emitStorageChange();
    } catch {
      // ignore storage failure
    }
  }

  function getStatusSummaryText(m: FollowUpMember): string {
    if (m.isOverdue) {
      return `expired ${Math.abs(m.daysDiff)}d ago on ${m.formattedEndDate}`;
    }
    if (m.isTrialEnding) {
      return m.daysDiff === 0
        ? "trial ends today"
        : `trial ends in ${m.daysDiff}d (${m.formattedEndDate})`;
    }
    if (m.isExpiring) {
      return m.daysDiff === 0
        ? "ends today"
        : `ends in ${m.daysDiff}d (${m.formattedEndDate})`;
    }
    return `₹${m.dueAmount.toLocaleString("en-IN")} balance pending`;
  }

  function interpolateScript(template: string, member: FollowUpMember): string {
    return template
      .replace(/{memberName}/g, member.fullName)
      .replace(/{planName}/g, member.planName)
      .replace(/{dueAmount}/g, member.dueAmount.toLocaleString("en-IN"))
      .replace(/{dueDate}/g, member.formattedEndDate)
      .replace(/{statusInfo}/g, getStatusSummaryText(member))
      .replace(/{gymName}/g, gymName);
  }

  function handleWhatsApp(member: FollowUpMember) {
    const cleanPhone = (member.phone || "").replace(/\D/g, "");
    if (cleanPhone.length < 7) return;
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const scriptKey = member.isPending
      ? "partial"
      : member.isOverdue
      ? "urgent"
      : activeScriptKey;
    const template =
      scripts[scriptKey]?.template ||
      scripts.gentle?.template ||
      DEFAULT_SCRIPTS.gentle.template;
    const message = interpolateScript(template, member);

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    // Per Section 8: Do NOT automatically mark a reminder as delivered merely because a WhatsApp link was opened.
  }

  function handleEmail(member: FollowUpMember) {
    if (!member.email) return;
    const template =
      scripts[activeScriptKey]?.template || DEFAULT_SCRIPTS.gentle.template;
    const body = interpolateScript(template, member);
    const subject = `Membership Follow-up — ${gymName}`;
    window.location.href = `mailto:${member.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }

  function handleSaveScripts() {
    try {
      localStorage.setItem(
        "gymapra_followup_scripts",
        JSON.stringify(editingScripts)
      );
      emitStorageChange();
    } catch {
      // ignore
    }
    setIsScriptModalOpen(false);
  }

  function handleSavePromise() {
    if (!promiseModalMember || !promiseDateInput) return;
    const [, m, d] = promiseDateInput.split("-").map(Number);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const formatted = `${d} ${months[m - 1]}`;
    updateFollowUpStatus(promiseModalMember.id, `Promised ${formatted}`);
    setPromiseModalMember(null);
    setPromiseDateInput("");
  }

  function openPaymentModal(member?: FollowUpMember) {
    if (member) {
      setPaymentMemberId(member.id);
      setPaymentMembershipId(member.membershipId);
      setPaymentAmount(
        member.dueAmount > 0 ? String(member.dueAmount) : String(member.planPrice)
      );
    } else {
      setPaymentMemberId(allMembersForPayment[0]?.id || "");
      setPaymentMembershipId(null);
      setPaymentAmount("");
    }
    setPaymentDate(todayStr);
    setPaymentMethod("cash");
    setPaymentNotes("");
    setPaymentError(null);
    setWaReceiptUrl(null);
    setPaymentModalOpen(true);
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setPaymentError(null);
    setWaReceiptUrl(null);

    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPaymentError("Please enter a valid payment amount");
      return;
    }

    if (!paymentMemberId) {
      setPaymentError("Please select a member");
      return;
    }

    const memberObj = allMembersForPayment.find(
      (m) => m.id === paymentMemberId
    );
    const targetBranchId = memberObj?.branchId || branches[0]?.id || "";

    setPaymentLoading(true);
    try {
      const res = await recordPaymentAction({
        gymId,
        branchId: targetBranchId,
        memberId: paymentMemberId,
        membershipId: paymentMembershipId,
        amount: numAmount,
        paymentMethod,
        paymentDate,
        notes: paymentNotes.trim() || null,
        paymentStatus: "paid",
      });

      if (!res || !res.success) {
        setPaymentError(res?.error || "Failed to record payment");
        setPaymentLoading(false);
        return;
      }

      setPaymentLoading(false);
      updateFollowUpStatus(
        paymentMemberId,
        `Paid ₹${numAmount.toLocaleString("en-IN")}`
      );

      if (res.receiptUrl) {
        setWaReceiptUrl(res.receiptUrl);
      } else {
        setPaymentModalOpen(false);
        setPaymentAmount("");
        setPaymentNotes("");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Failed to record payment"
      );
      setPaymentLoading(false);
    }
  }

  function renderUrgencyPill(member: FollowUpMember) {
    if (member.isTrialEnding) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/12 text-purple-700 dark:text-purple-400 border border-purple-500/25">
          <Hourglass className="w-3 h-3" />
          {member.daysDiff === 0
            ? "Trial ends today"
            : `Trial ${member.daysDiff}d left`}
        </span>
      );
    }
    if (member.isExpiring) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
            member.daysDiff <= 1
              ? "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/25"
              : "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25"
          }`}
        >
          <Clock className="w-3 h-3" />
          {member.daysDiff === 0 ? "Ends today" : `${member.daysDiff}d left`}
        </span>
      );
    }
    if (member.isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/12 text-rose-700 dark:text-rose-400 border border-rose-500/25">
          <XCircle className="w-3 h-3" />
          Expired {Math.abs(member.daysDiff)}d ago
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/25">
        <AlertCircle className="w-3 h-3" />
        ₹{member.dueAmount.toLocaleString("en-IN")} Due
      </span>
    );
  }

  function renderFollowUpStatusChip(memberId: string) {
    const status = getMemberFollowUpStatus(memberId);
    if (status === "Never contacted") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
          Never contacted
        </span>
      );
    }
    if (status.startsWith("Promised")) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/12 text-blue-700 dark:text-blue-400 border border-blue-500/25">
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
        {status}
      </span>
    );
  }

  const showTrialCard = trialEndingMembers.length > 0;
  const startIndex =
    filteredAndSorted.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(safePage * rowsPerPage, filteredAndSorted.length);

  return (
    <div className="space-y-5 text-foreground">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
            Follow-ups &amp; Collections
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingScripts(scripts);
              setIsScriptModalOpen(true);
            }}
            className="h-9 sm:h-10 px-3 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scripts</span>
          </button>

          {canRecordPayments && (
            <button
              type="button"
              onClick={() => openPaymentModal()}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Approved KPI Cards (3 permanent + conditional Trial Ending) */}
      <div
        className={`grid grid-cols-2 gap-2.5 sm:gap-4 ${
          showTrialCard ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <KpiCard
          compact
          label="Expiring"
          value={`${expiringMembers.length} Members`}
          variant="amber"
          icon={<Calendar className="w-4 h-4" />}
          subtext="Ends in 1–7 days"
          onClick={() => {
            setActiveTab((prev) => (prev === "expiring" ? "all" : "expiring"));
            setCurrentPage(1);
          }}
          active={activeTab === "expiring"}
        />

        <KpiCard
          compact
          label="Pending"
          value={`₹${pendingTotal.toLocaleString("en-IN")}`}
          variant="red"
          icon={<Wallet className="w-4 h-4" />}
          subtext={`${pendingMembers.length} Members`}
          onClick={() => {
            setActiveTab((prev) => (prev === "pending" ? "all" : "pending"));
            setCurrentPage(1);
          }}
          active={activeTab === "pending"}
        />

        <KpiCard
          compact
          label="Overdue"
          value={`${overdueMembers.length} Members`}
          variant="red"
          icon={<XCircle className="w-4 h-4" />}
          subtext="Expired without renewal"
          onClick={() => {
            setActiveTab((prev) => (prev === "overdue" ? "all" : "overdue"));
            setCurrentPage(1);
          }}
          active={activeTab === "overdue"}
        />

        {showTrialCard && (
          <KpiCard
            compact
            label="Trial Ending"
            value={`${trialEndingMembers.length} Members`}
            variant="purple"
            icon={<Hourglass className="w-4 h-4" />}
            subtext="Ends in 0–3 days"
            onClick={() => {
              setActiveTab((prev) =>
                prev === "trial_ending" ? "all" : "trial_ending"
              );
              setCurrentPage(1);
            }}
            active={activeTab === "trial_ending"}
          />
        )}
      </div>

      {/* Category Pills + Search + Sort + Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                { id: "all" as const, label: `All (${branchMembers.length})` },
                {
                  id: "expiring" as const,
                  label: `Expiring (${expiringMembers.length})`,
                },
                {
                  id: "pending" as const,
                  label: `Pending (${pendingMembers.length})`,
                },
                {
                  id: "overdue" as const,
                  label: `Overdue (${overdueMembers.length})`,
                },
                ...(showTrialCard
                  ? [
                      {
                        id: "trial_ending" as const,
                        label: `Trial Ending (${trialEndingMembers.length})`,
                      },
                    ]
                  : []),
              ]
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

          {/* Search, Sort, Plan, Branch */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-60 min-w-[180px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search member, phone, ID..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="relative flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort follow-ups"
                className="h-9 pl-8 pr-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground"
              >
                <option value="urgency">Sort: Urgency</option>
                <option value="balance">Sort: Balance</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            {plans.length > 0 && (
              <select
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by plan"
                className="h-9 px-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground"
              >
                <option value="all">All Plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by branch"
                className="h-9 px-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground"
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
      </div>

      {/* Desktop Follow-ups Table */}
      <div className="hidden md:block bg-card rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border text-[11px]">
              <tr>
                <th className="py-3.5 pl-5 pr-3">Member</th>
                <th className="py-3.5 px-3">Plan &amp; Details</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Last Follow-up</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No follow-up records match the current selection.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => {
                  const cleanPhone = (member.phone || "").replace(/\D/g, "");
                  const hasPhone = cleanPhone.length >= 7;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center justify-center font-black text-xs shrink-0">
                            {member.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/app/${gymId}/members/${member.id}`}
                              className="font-bold text-foreground hover:underline truncate block"
                            >
                              {member.fullName}
                            </Link>
                            <div className="text-[11px] text-muted-foreground font-mono truncate">
                              {member.code} • {member.phone || "No phone"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-foreground">
                          {member.planName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {member.isOverdue
                            ? `Ended ${member.formattedEndDate}`
                            : `Ends on ${member.formattedEndDate}`}
                          {member.dueAmount > 0 && (
                            <span className="ml-1.5 font-bold text-rose-600 dark:text-rose-400">
                              • ₹{member.dueAmount.toLocaleString("en-IN")} due
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {renderUrgencyPill(member)}
                      </td>

                      <td className="py-3.5 px-3">
                        {renderFollowUpStatusChip(member.id)}
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5 relative">
                          {/* Primary Direct Contact: Call */}
                          {hasPhone ? (
                            <a
                              href={`tel:${cleanPhone}`}
                              className="h-8 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Call
                            </a>
                          ) : (
                            <span className="h-8 px-3 rounded-xl bg-muted text-muted-foreground font-bold text-xs inline-flex items-center gap-1.5 opacity-60 cursor-not-allowed">
                              <Phone className="w-3.5 h-3.5" />
                              No Phone
                            </span>
                          )}

                          {/* Secondary: WhatsApp */}
                          <button
                            type="button"
                            disabled={!hasPhone}
                            onClick={() => handleWhatsApp(member)}
                            title="Open WhatsApp reminder"
                            aria-label={`Send WhatsApp reminder to ${member.fullName}`}
                            className="h-8 w-8 rounded-xl bg-emerald-500/12 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 inline-flex items-center justify-center disabled:opacity-40 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* Overflow Menu */}
                          <button
                            type="button"
                            aria-label="More follow-up actions"
                            onClick={() =>
                              setOpenMenuId((prev) =>
                                prev === member.id ? null : member.id
                              )
                            }
                            className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground inline-flex items-center justify-center cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === member.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 top-9 w-48 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-left text-xs font-semibold">
                                {canRecordPayments && member.dueAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      openPaymentModal(member);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                  >
                                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                    Record Payment
                                  </button>
                                )}
                                {canManageMembers && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setRenewMember(member);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-primary" />
                                    Renew Membership
                                  </button>
                                )}
                                <Link
                                  href={`/app/${gymId}/members/${member.id}`}
                                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  <User className="w-3.5 h-3.5 text-blue-600" />
                                  View Member Profile
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setPromiseModalMember(member);
                                    setPromiseDateInput(todayStr);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                  Log Promise Date
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    updateFollowUpStatus(member.id, "Contacted");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Mark Contacted
                                </button>
                                {member.email && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleEmail(member);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                    Send Email
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

      {/* Mobile Follow-up Cards */}
      <div className="md:hidden space-y-2.5">
        {paginatedMembers.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-xs text-muted-foreground">
            No follow-up records match the current selection.
          </div>
        ) : (
          paginatedMembers.map((member) => {
            const cleanPhone = (member.phone || "").replace(/\D/g, "");
            const hasPhone = cleanPhone.length >= 7;

            return (
              <div
                key={member.id}
                className="bg-card rounded-2xl border border-border p-3.5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/25 flex items-center justify-center font-black text-xs shrink-0">
                      {member.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/app/${gymId}/members/${member.id}`}
                        className="font-bold text-sm text-foreground truncate block hover:underline"
                      >
                        {member.fullName}
                      </Link>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {member.code} • {member.phone || "No phone"}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">{renderUrgencyPill(member)}</div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="truncate">
                    <span className="font-semibold text-foreground">
                      {member.planName}
                    </span>{" "}
                    • {member.isOverdue ? "Ended" : "Ends"}{" "}
                    {member.formattedEndDate}
                    {member.dueAmount > 0 && (
                      <span className="ml-1 font-bold text-rose-600 dark:text-rose-400">
                        (₹{member.dueAmount.toLocaleString("en-IN")} due)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {hasPhone ? (
                    <a
                      href={`tel:${cleanPhone}`}
                      className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call
                    </a>
                  ) : (
                    <span className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground font-bold text-xs inline-flex items-center justify-center gap-1.5 opacity-60">
                      <Phone className="w-3.5 h-3.5" />
                      No Phone
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={!hasPhone}
                    onClick={() => handleWhatsApp(member)}
                    aria-label="WhatsApp"
                    className="h-9 w-10 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 inline-flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Mobile follow-up actions"
                      onClick={() =>
                        setOpenMenuId((prev) =>
                          prev === `mob-${member.id}` ? null : `mob-${member.id}`
                        )
                      }
                      className="h-9 w-9 rounded-xl border border-border bg-muted/40 text-foreground inline-flex items-center justify-center cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === `mob-${member.id}` && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 bottom-10 w-48 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-xs font-semibold">
                          {canRecordPayments && member.dueAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                openPaymentModal(member);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                              Record Payment
                            </button>
                          )}
                          {canManageMembers && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setRenewMember(member);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-primary" />
                              Renew Membership
                            </button>
                          )}
                          <Link
                            href={`/app/${gymId}/members/${member.id}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            View Profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setPromiseModalMember(member);
                              setPromiseDateInput(todayStr);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            Log Promise Date
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              updateFollowUpStatus(member.id, "Contacted");
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Mark Contacted
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
            {filteredAndSorted.length}
          </span>{" "}
          members
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

      {/* Promise-to-Pay Modal */}
      {promiseModalMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-black text-foreground">
                Log Promise-to-Pay
              </h3>
              <button
                type="button"
                onClick={() => setPromiseModalMember(null)}
                className="p-1 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Member:{" "}
                <strong className="text-foreground">
                  {promiseModalMember.fullName}
                </strong>
              </p>
              <input
                type="date"
                value={promiseDateInput}
                onChange={(e) => setPromiseDateInput(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromiseModalMember(null)}
                className="h-9 px-4 rounded-xl border border-border bg-muted font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePromise}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer"
              >
                Save Promise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Scripts Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-black text-foreground">
                Follow-up Message Scripts
              </h3>
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="p-1 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.values(editingScripts).map((sc) => (
                  <button
                    key={sc.key}
                    type="button"
                    onClick={() => setActiveScriptKey(sc.key)}
                    className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                      activeScriptKey === sc.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {sc.title}
                  </button>
                ))}
              </div>
              <textarea
                rows={4}
                value={editingScripts[activeScriptKey]?.template || ""}
                onChange={(e) =>
                  setEditingScripts((prev) => ({
                    ...prev,
                    [activeScriptKey]: {
                      ...prev[activeScriptKey],
                      template: e.target.value,
                    },
                  }))
                }
                className="w-full p-3 rounded-xl bg-background border border-border text-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                Placeholders: {"{memberName}"}, {"{planName}"}, {"{dueAmount}"},{" "}
                {"{dueDate}"}, {"{statusInfo}"}, {"{gymName}"}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="h-9 px-4 rounded-xl border border-border bg-muted font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScripts}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer"
              >
                Save Scripts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <h3 className="text-sm font-black text-foreground">
                Record Payment
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {waReceiptUrl ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-semibold">
                  Payment recorded successfully!
                </div>
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={waReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 rounded-xl bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Send Receipt on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleRecordPayment}
                className="mt-4 space-y-3 text-xs"
              >
                {paymentError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 font-semibold">
                    {paymentError}
                  </div>
                )}

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Member
                  </label>
                  <select
                    value={paymentMemberId}
                    onChange={(e) => {
                      setPaymentMemberId(e.target.value);
                      setPaymentMembershipId(null);
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
                  >
                    {allMembersForPayment.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(
                          e.target.value as
                            | "cash"
                            | "upi"
                            | "card"
                            | "bank_transfer"
                            | "cheque"
                            | "other"
                        )
                      }
                      className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="card">Card</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Optional note or UTR"
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    className="h-9 px-4 rounded-xl border border-border bg-muted font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentLoading}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {paymentLoading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Save Payment
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Existing Renew Membership Modal */}
      {renewMember && (
        <RenewMembershipModal
          gymId={gymId}
          branchId={renewMember.branchId}
          memberId={renewMember.id}
          memberName={renewMember.fullName}
          currentPlanId={renewMember.planId}
          plans={plans}
          isOpen={true}
          onClose={() => setRenewMember(null)}
          onSuccess={() => {
            setRenewMember(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
