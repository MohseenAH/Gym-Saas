"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneCall,
  MessageSquare,
  Mail,
  Calendar,
  DollarSign,
  Receipt,
  AlertCircle,
  Clock,
  TrendingUp,
  Search,
  SlidersHorizontal,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { recordPaymentAction } from "@/lib/actions/payments";
import { getTodayIST } from "@/lib/utils";

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
  dueDate: string;
  formattedDueDate: string;
  daysDiff: number;
  daysOverdue: number;
  daysUntilDue: number;
  isOverdue: boolean;
  isDueSoon: boolean;
  isUpcoming: boolean;
  membershipStatus: string;
}

interface MemberForPayment {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
}

interface PlanOption {
  id: string;
  name: string;
  price: number;
}

interface BranchOption {
  id: string;
  name: string;
}

interface FollowUpsClientProps {
  gymId: string;
  gymName: string;
  members: FollowUpMember[];
  allMembersForPayment: MemberForPayment[];
  plans: PlanOption[];
  branches: BranchOption[];
  totalOutstanding: number;
  overdueTotal: number;
  overdueCount: number;
  dueSoonTotal: number;
  dueSoonCount: number;
  upcomingTotal: number;
  upcomingCount: number;
  recoveredThisMonth: number;
  monthlyTarget: number;
}

type TabType = "all" | "overdue" | "due_soon" | "upcoming";

interface MessageScript {
  key: string;
  title: string;
  template: string;
}

const DEFAULT_SCRIPTS: Record<string, MessageScript> = {
  gentle: {
    key: "gentle",
    title: "Gentle Reminder",
    template:
      "Hi {memberName}, friendly reminder from {gymName} that your {planName} membership dues of ₹{dueAmount} are due on {dueDate}. Kindly clear at the desk or via UPI to keep working out uninterrupted! 💪",
  },
  urgent: {
    key: "urgent",
    title: "Urgent Overdue",
    template:
      "URGENT: Hi {memberName}, your {planName} balance of ₹{dueAmount} at {gymName} was due on {dueDate} and is now overdue. Please settle this immediately to prevent membership suspension. ⚠️",
  },
  partial: {
    key: "partial",
    title: "Partial Balance",
    template:
      "Hi {memberName}, you have a remaining partial balance of ₹{dueAmount} towards your {planName} membership at {gymName}. Please complete payment on your next gym visit. Thank you!",
  },
  promise: {
    key: "promise",
    title: "Promise-to-Pay",
    template:
      "Hi {memberName}, following up on your promised payment of ₹{dueAmount} for {gymName}. Please confirm when you'll be dropping by today or share the UPI screenshot. Thank you!",
  },
};

export function FollowUpsClient({
  gymId,
  gymName,
  members,
  allMembersForPayment,
  plans,
  branches,
  totalOutstanding,
  overdueTotal,
  overdueCount,
  dueSoonTotal,
  dueSoonCount,
  upcomingTotal,
  upcomingCount,
  recoveredThisMonth,
  monthlyTarget,
}: FollowUpsClientProps) {
  const router = useRouter();

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("all");
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState("all");

  // Accordion state for upcoming group
  const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(false);

  // Message scripts state (stored in localStorage)
  const [scripts, setScripts] = useState<Record<string, MessageScript>>(DEFAULT_SCRIPTS);
  const [activeScriptKey, setActiveScriptKey] = useState<string>("gentle");
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [editingScripts, setEditingScripts] = useState<Record<string, MessageScript>>(DEFAULT_SCRIPTS);

  // Follow-up status tracking from localStorage
  const [followUpStatuses, setFollowUpStatuses] = useState<Record<string, string>>({});

  // Promise-to-Pay popover state
  const [promiseModalMember, setPromiseModalMember] = useState<FollowUpMember | null>(null);
  const [promiseDateInput, setPromiseDateInput] = useState("");

  // Record payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMemberId, setPaymentMemberId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(getTodayIST());
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [waReceiptUrl, setWaReceiptUrl] = useState<string | null>(null);

  // Initialize from localStorage on client mount
  useEffect(() => {
    try {
      const savedScripts = localStorage.getItem("gymapra_followup_scripts");
      if (savedScripts) {
        const parsed = JSON.parse(savedScripts);
        setScripts(parsed);
        setEditingScripts(parsed);
      }
    } catch {
      // ignore JSON parse errors
    }

    try {
      const loadedStatuses: Record<string, string> = {};
      members.forEach((m) => {
        const saved = localStorage.getItem(`gymapra_followup_${m.id}`);
        if (saved) {
          loadedStatuses[m.id] = saved;
        }
      });
      setFollowUpStatuses(loadedStatuses);
    } catch {
      // ignore
    }
  }, [members]);

  function updateFollowUpStatus(memberId: string, status: string) {
    setFollowUpStatuses((prev) => ({ ...prev, [memberId]: status }));
    try {
      localStorage.setItem(`gymapra_followup_${memberId}`, status);
    } catch {
      // ignore
    }
  }

  function interpolateScript(template: string, member: FollowUpMember): string {
    return template
      .replace(/{memberName}/g, member.fullName)
      .replace(/{planName}/g, member.planName)
      .replace(/{dueAmount}/g, member.dueAmount.toLocaleString("en-IN"))
      .replace(/{dueDate}/g, member.formattedDueDate)
      .replace(/{gymName}/g, gymName);
  }

  function handleWhatsApp(member: FollowUpMember) {
    const template =
      scripts[activeScriptKey]?.template || DEFAULT_SCRIPTS.gentle.template;
    const message = interpolateScript(template, member);

    let cleanPhone = member.phone.replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      cleanPhone = "91" + cleanPhone;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");

    updateFollowUpStatus(member.id, "WhatsApp Sent");
  }

  function handleEmail(member: FollowUpMember) {
    if (!member.email) {
      alert(`No email address recorded for ${member.fullName}`);
      return;
    }
    const template =
      scripts[activeScriptKey]?.template || DEFAULT_SCRIPTS.gentle.template;
    const body = interpolateScript(template, member);
    const subject = `Payment Reminder: ${gymName} Membership Dues`;
    const mailtoUrl = `mailto:${member.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }

  function handleSaveScripts() {
    setScripts(editingScripts);
    try {
      localStorage.setItem("gymapra_followup_scripts", JSON.stringify(editingScripts));
    } catch {
      // ignore
    }
    setIsScriptModalOpen(false);
  }

  function handleResetScripts() {
    setEditingScripts(DEFAULT_SCRIPTS);
    setScripts(DEFAULT_SCRIPTS);
    try {
      localStorage.removeItem("gymapra_followup_scripts");
    } catch {
      // ignore
    }
    setIsScriptModalOpen(false);
  }

  function handleSavePromise() {
    if (!promiseModalMember) return;
    if (!promiseDateInput) {
      alert("Please select a promise-to-pay date");
      return;
    }
    const [y, m, d] = promiseDateInput.split("-").map(Number);
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

  function setQuickPromiseDate(daysFromNow: number) {
    const today = new Date();
    today.setDate(today.getDate() + daysFromNow);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setPromiseDateInput(`${yyyy}-${mm}-${dd}`);
  }

  function openPaymentModal(member?: FollowUpMember) {
    if (member) {
      setPaymentMemberId(member.id);
      setPaymentAmount(member.dueAmount.toString());
    } else {
      setPaymentMemberId(allMembersForPayment[0]?.id || "");
      setPaymentAmount("");
    }
    setPaymentDate(getTodayIST());
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

    const memberObj = allMembersForPayment.find((m) => m.id === paymentMemberId);
    const targetBranchId = memberObj?.branchId || branches[0]?.id || "";

    setPaymentLoading(true);

    let res;
    try {
      res = await recordPaymentAction({
        gymId,
        branchId: targetBranchId,
        memberId: paymentMemberId,
        amount: numAmount,
        paymentMethod: paymentMethod as
          | "cash"
          | "upi"
          | "card"
          | "bank_transfer"
          | "cheque"
          | "other",
        paymentDate,
        notes: paymentNotes || null,
        paymentStatus: "paid",
      });
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Failed to record payment");
      setPaymentLoading(false);
      return;
    }

    if (!res || !res.success) {
      setPaymentError(res?.error || "Failed to record payment");
      setPaymentLoading(false);
      return;
    }

    setPaymentLoading(false);

    // Update follow-up status locally
    updateFollowUpStatus(paymentMemberId, `Paid ₹${numAmount.toLocaleString("en-IN")}`);

    if (res.receiptUrl) {
      setWaReceiptUrl(res.receiptUrl);
    } else {
      setPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  function handleClosePaymentModal() {
    setPaymentModalOpen(false);
    setWaReceiptUrl(null);
    setPaymentAmount("");
    setPaymentNotes("");
    startTransition(() => {
      router.refresh();
    });
  }

  // Filter members based on search, plan, and due date
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = member.fullName.toLowerCase().includes(q);
        const matchPhone = member.phone.toLowerCase().includes(q);
        const matchCode = member.code.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode) return false;
      }

      if (selectedPlanId !== "all") {
        if (member.planId !== selectedPlanId) return false;
      }

      if (selectedDueDateFilter === "overdue") {
        if (!member.isOverdue) return false;
      } else if (selectedDueDateFilter === "7days") {
        if (!member.isDueSoon && !member.isOverdue) return false;
      } else if (selectedDueDateFilter === "30days") {
        if (member.daysUntilDue > 30 && !member.isOverdue) return false;
      }

      return true;
    });
  }, [members, searchQuery, selectedPlanId, selectedDueDateFilter]);

  const overdueMembersList = useMemo(
    () => filteredMembers.filter((m) => m.isOverdue),
    [filteredMembers]
  );
  const dueSoonMembersList = useMemo(
    () => filteredMembers.filter((m) => m.isDueSoon),
    [filteredMembers]
  );
  const upcomingMembersList = useMemo(
    () => filteredMembers.filter((m) => m.isUpcoming),
    [filteredMembers]
  );

  const filteredOverdueAmount = overdueMembersList.reduce(
    (sum, m) => sum + m.dueAmount,
    0
  );
  const filteredDueSoonAmount = dueSoonMembersList.reduce(
    (sum, m) => sum + m.dueAmount,
    0
  );
  const filteredUpcomingAmount = upcomingMembersList.reduce(
    (sum, m) => sum + m.dueAmount,
    0
  );

  const recoveryPercent = Math.min(
    100,
    Math.round((recoveredThisMonth / (monthlyTarget || 1)) * 100)
  );

  const activeScript = scripts[activeScriptKey] || DEFAULT_SCRIPTS.gentle;

  function getFollowUpStatusBadge(memberId: string) {
    const status = followUpStatuses[memberId] || "Never Contacted";
    if (status.startsWith("WhatsApp")) {
      return (
        <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-emerald-500 shrink-0" />
          {status}
        </span>
      );
    }
    if (status.startsWith("Promised")) {
      return (
        <span className="text-amber-400 font-medium inline-flex items-center gap-1">
          <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
          {status}
        </span>
      );
    }
    if (status.startsWith("Paid")) {
      return (
        <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
          {status}
        </span>
      );
    }
    return <span className="text-muted-foreground">{status}</span>;
  }

  // Row Component for desktop and mobile
  function renderMemberRow(member: FollowUpMember) {
    const paidPercent = Math.min(
      100,
      Math.max(
        0,
        Math.round((member.totalPaid / (member.planPrice || 1)) * 100)
      )
    );

    return (
      <div key={member.id} className="group">
        {/* Desktop 4-column row */}
        <div className="hidden sm:grid grid-cols-12 items-center gap-4 px-4 py-3.5 border-b border-border/50 hover:bg-muted/20 transition-colors text-sm">
          {/* Col 1: Member Name (#code) + phone subtext */}
          <div className="col-span-3 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground truncate">
                {member.fullName}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {member.code}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
              <Phone className="w-3 h-3 text-muted-foreground/70 shrink-0" />
              <span>{member.phone || "No phone"}</span>
              {branches.length > 1 && (
                <span className="text-[10px] text-muted-foreground/70 border border-border/50 px-1 py-0.2 rounded-sm shrink-0">
                  {member.branchName}
                </span>
              )}
            </div>
          </div>

          {/* Col 2: Plan Name + Plan ₹price · Paid ₹paid + slim emerald progress bar */}
          <div className="col-span-3 min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">
              {member.planName}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Plan ₹{member.planPrice.toLocaleString("en-IN")} · Paid ₹
              {member.totalPaid.toLocaleString("en-IN")}
            </div>
            <div className="w-full bg-muted/60 rounded-full h-1 mt-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>

          {/* Col 3: Status pill + Follow-up: {status} */}
          <div className="col-span-3 min-w-0">
            <div>
              {member.isOverdue ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  ₹{member.dueAmount.toLocaleString("en-IN")} Due (Overdue{" "}
                  {member.daysOverdue}d · Due {member.formattedDueDate})
                </span>
              ) : member.isDueSoon ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  ₹{member.dueAmount.toLocaleString("en-IN")} Due (
                  {member.daysUntilDue === 0
                    ? "Due Today"
                    : `Due in ${member.daysUntilDue}d`}{" "}
                  · {member.formattedDueDate})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  ₹{member.dueAmount.toLocaleString("en-IN")} Due (Due in{" "}
                  {member.daysUntilDue}d · {member.formattedDueDate})
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate">
              Follow-up: {getFollowUpStatusBadge(member.id)}
            </div>
          </div>

          {/* Col 4: 5 Direct 1-tap buttons */}
          <div className="col-span-3 flex items-center justify-end gap-1.5">
            {/* 1. WhatsApp */}
            <button
              onClick={() => handleWhatsApp(member)}
              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Send WhatsApp message"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {/* 2. Call */}
            <a
              href={`tel:${member.phone}`}
              className="h-8 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Call phone"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>

            {/* 3. Email */}
            <button
              onClick={() => handleEmail(member)}
              className="h-8 px-2 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="Send Email"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Email</span>
            </button>

            {/* 4. Promise */}
            <button
              onClick={() => {
                setPromiseModalMember(member);
                setPromiseDateInput("");
              }}
              className="h-8 px-2 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="Log Promise-to-Pay date"
            >
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Promise</span>
            </button>

            {/* 5. Collect Due */}
            <button
              onClick={() => openPaymentModal(member)}
              className="h-8 px-2.5 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="Collect this due"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-500" />
              <span>Collect Due</span>
            </button>
          </div>
        </div>

        {/* Mobile Compact Card */}
        <div className="sm:hidden p-4 rounded-xl border border-border bg-card space-y-3 mb-2.5">
          {/* Top row: Name (#code), Due Status pill */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <span>{member.fullName}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {member.code}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-muted-foreground/70" />
                <span>{member.phone || "No phone"}</span>
              </div>
            </div>
            <div>
              {member.isOverdue ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  ₹{member.dueAmount.toLocaleString("en-IN")} Due
                </span>
              ) : member.isDueSoon ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ₹{member.dueAmount.toLocaleString("en-IN")} Due
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  ₹{member.dueAmount.toLocaleString("en-IN")} Due
                </span>
              )}
            </div>
          </div>

          {/* Middle: Plan info, progress bar, follow-up subtext */}
          <div className="bg-muted/30 p-2.5 rounded-lg border border-border/40 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-foreground truncate max-w-[60%]">
                {member.planName}
              </span>
              <span className="text-muted-foreground text-[11px]">
                Paid ₹{member.totalPaid.toLocaleString("en-IN")} / ₹
                {member.planPrice.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-1 rounded-full"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
              <span>
                {member.isOverdue
                  ? `Overdue ${member.daysOverdue}d (Due ${member.formattedDueDate})`
                  : `Due in ${member.daysUntilDue}d (${member.formattedDueDate})`}
              </span>
              <span>
                Follow-up: {getFollowUpStatusBadge(member.id)}
              </span>
            </div>
          </div>

          {/* Bottom: 5 Action Buttons in Grid */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            <button
              onClick={() => handleWhatsApp(member)}
              className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[10px]">WhatsApp</span>
            </button>
            <a
              href={`tel:${member.phone}`}
              className="h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="text-[10px]">Call</span>
            </a>
            <button
              onClick={() => handleEmail(member)}
              className="h-9 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-medium flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px]">Email</span>
            </button>
            <button
              onClick={() => {
                setPromiseModalMember(member);
                setPromiseDateInput("");
              }}
              className="h-9 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-medium flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px]">Promise</span>
            </button>
            <button
              onClick={() => openPaymentModal(member)}
              className="h-9 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px]">Collect</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="space-y-4">
        {/* Desktop Header */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link
                href={`/app/${gymId}/payments`}
                className="hover:text-foreground transition-colors"
              >
                Finance
              </Link>
              <span>/</span>
              <span className="text-foreground">Follow-Ups & Dues</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              Follow-Ups & Dues
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track outstanding plan balances, prioritize overdue dues, and log follow-ups.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingScripts(scripts);
                setIsScriptModalOpen(true);
              }}
              className="h-10 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              Manage Message Scripts
            </button>

            <button
              onClick={() => openPaymentModal()}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Record Payment
            </button>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Finance</div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Follow-Ups & Dues
              </h1>
            </div>
            <button
              onClick={() => {
                setEditingScripts(scripts);
                setIsScriptModalOpen(true);
              }}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
              title="Manage Message Scripts"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Full-width emerald + Record Payment button */}
          <button
            onClick={() => openPaymentModal()}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Record Payment
          </button>
        </div>
      </div>

      {/* 2. Unified 4-Metric Dues Overview Bar */}
      {/* Desktop: Single 4-column divided card */}
      <div className="hidden sm:grid grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card shadow-xs">
        {/* Metric 1: Total Outstanding Dues */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Total Outstanding Dues</span>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            ({overdueCount + dueSoonCount} members)
          </div>
        </div>

        {/* Metric 2: Overdue Dues */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Overdue Dues</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-500">
            ₹{overdueTotal.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-rose-400 font-medium">
            ({overdueCount} members)
          </div>
        </div>

        {/* Metric 3: Due Within 7 Days */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Due Within 7 Days</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-500">
            ₹{dueSoonTotal.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-amber-400 font-medium">
            ({dueSoonCount} members)
          </div>
        </div>

        {/* Metric 4: Dues Recovered This Month */}
        <div className="p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Dues Recovered This Month</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">
            ₹{recoveredThisMonth.toLocaleString("en-IN")}
          </div>
          <div className="mt-2 space-y-1">
            <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${recoveryPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground flex justify-between">
              <span>{recoveryPercent}% of target</span>
              <span>Target: ₹{monthlyTarget.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: 2x2 grid of compact metric cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        <div className="p-3 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
            Total Outstanding
          </div>
          <div className="mt-1 text-lg font-bold text-foreground">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {overdueCount + dueSoonCount} members
          </div>
        </div>

        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 truncate">
            Overdue Dues
          </div>
          <div className="mt-1 text-lg font-bold text-rose-500">
            ₹{overdueTotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-rose-400 font-medium">
            {overdueCount} members
          </div>
        </div>

        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 truncate">
            Due in 7 Days
          </div>
          <div className="mt-1 text-lg font-bold text-amber-500">
            ₹{dueSoonTotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-amber-400 font-medium">
            {dueSoonCount} members
          </div>
        </div>

        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 truncate">
            Recovered MTD
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-500">
            ₹{recoveredThisMonth.toLocaleString("en-IN")}
          </div>
          <div className="w-full bg-muted/60 rounded-full h-1 mt-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1 rounded-full transition-all"
              style={{ width: `${recoveryPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {recoveryPercent}% of target
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs, Script Selector & Search Bar */}
      <div className="space-y-3">
        {/* Desktop Row 1: Filter tabs on left + active script preview pill on right */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "all"
                  ? "bg-card text-foreground shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Dues ({overdueCount + dueSoonCount + upcomingCount})
            </button>
            <button
              onClick={() => setActiveTab("overdue")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "overdue"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overdue ({overdueCount})
            </button>
            <button
              onClick={() => setActiveTab("due_soon")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "due_soon"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Due Within 7d ({dueSoonCount})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "upcoming"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Upcoming &gt;7d ({upcomingCount})
            </button>
          </div>

          {/* Desktop inline active script preview pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/30 text-xs text-muted-foreground max-w-lg truncate">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-foreground shrink-0">
              {activeScript.title}:
            </span>
            <span className="truncate italic">
              &quot;{activeScript.template.slice(0, 75)}...&quot;
            </span>
          </div>
        </div>

        {/* Mobile script bar: Compact Active Message Script selector + 1-line preview */}
        <div className="sm:hidden space-y-2 p-3 rounded-xl border border-border bg-card">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Active Message Script:</span>
            <button
              onClick={() => {
                setEditingScripts(scripts);
                setIsScriptModalOpen(true);
              }}
              className="text-primary text-[11px] font-semibold hover:underline"
            >
              Edit Templates
            </button>
          </div>

          {/* Script Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {Object.values(scripts).map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveScriptKey(s.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeScriptKey === s.key
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {/* 1-line live template preview */}
          <div className="text-xs text-muted-foreground italic truncate bg-muted/30 px-2 py-1.5 rounded-md border border-border/40">
            &quot;{activeScript.template}&quot;
          </div>
        </div>

        {/* Desktop Script Selector Row */}
        <div className="hidden sm:flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border bg-card/60">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-foreground shrink-0">
              Active Script:
            </span>
            <div className="flex items-center gap-1.5">
              {Object.values(scripts).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveScriptKey(s.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeScriptKey === s.key
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground italic truncate max-w-md">
            Preview: &quot;{activeScript.template}&quot;
          </div>
        </div>

        {/* Search & Filter row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search member or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Plan Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="all">Plan: All Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedDueDateFilter}
              onChange={(e) => setSelectedDueDateFilter(e.target.value)}
              className="w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="all">Due Date: All</option>
              <option value="overdue">Overdue Only</option>
              <option value="7days">Due Within 7 Days</option>
              <option value="30days">Due Within 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Grouped Priority Containers */}
      <div className="space-y-6">
        {/* GROUP 1: Overdue — Action Today */}
        {(activeTab === "all" || activeTab === "overdue") && (
          <div className="rounded-2xl border border-rose-500/30 bg-card overflow-hidden shadow-xs">
            {/* Header */}
            <div className="bg-rose-500/10 text-rose-400 px-4 py-3 flex items-center justify-between border-b border-rose-500/20 font-semibold text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>
                  Overdue — Action Today ({overdueMembersList.length} Members • ₹
                  {filteredOverdueAmount.toLocaleString("en-IN")})
                </span>
              </div>
              <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                High Priority
              </span>
            </div>

            {/* Content */}
            {overdueMembersList.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  No overdue dues!
                </p>
                <p className="text-xs text-muted-foreground">
                  All member accounts are currently up to date.
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop column header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
                  <div className="col-span-3">MEMBER</div>
                  <div className="col-span-3">PLAN & PAYMENT</div>
                  <div className="col-span-3">DUE STATUS & FOLLOW-UP</div>
                  <div className="col-span-3 text-right">ACTIONS</div>
                </div>

                {overdueMembersList.map(renderMemberRow)}
              </div>
            )}
          </div>
        )}

        {/* GROUP 2: Due Within 7 Days */}
        {(activeTab === "all" || activeTab === "due_soon") && (
          <div className="rounded-2xl border border-amber-500/30 bg-card overflow-hidden shadow-xs">
            {/* Header */}
            <div className="bg-amber-500/10 text-amber-400 px-4 py-3 flex items-center justify-between border-b border-amber-500/20 font-semibold text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>
                  Due Within 7 Days ({dueSoonMembersList.length} Members • ₹
                  {filteredDueSoonAmount.toLocaleString("en-IN")})
                </span>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                Expiring Soon
              </span>
            </div>

            {/* Content */}
            {dueSoonMembersList.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted/40 text-muted-foreground mx-auto flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  No dues due in the next 7 days
                </p>
                <p className="text-xs text-muted-foreground">
                  No upcoming renewals within this weekly window.
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop column header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
                  <div className="col-span-3">MEMBER</div>
                  <div className="col-span-3">PLAN & PAYMENT</div>
                  <div className="col-span-3">DUE STATUS & FOLLOW-UP</div>
                  <div className="col-span-3 text-right">ACTIONS</div>
                </div>

                {dueSoonMembersList.map(renderMemberRow)}
              </div>
            )}
          </div>
        )}

        {/* GROUP 3: Collapsible accordion bar at bottom (Upcoming — Later >7 Days) */}
        {(activeTab === "all" || activeTab === "upcoming") && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            {/* Accordion Toggle Bar */}
            <button
              onClick={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
              className="w-full px-4 py-3.5 flex items-center justify-between bg-card hover:bg-muted/30 transition-colors text-sm font-semibold text-foreground cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    isUpcomingExpanded ? "rotate-90 text-foreground" : ""
                  }`}
                />
                <span>
                  Upcoming — Later (&gt;7 Days) • {upcomingMembersList.length}{" "}
                  Members (₹{filteredUpcomingAmount.toLocaleString("en-IN")})
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {isUpcomingExpanded ? "Collapse" : "Click to expand"}
              </span>
            </button>

            {/* Collapsible Content */}
            {isUpcomingExpanded && (
              <div className="border-t border-border">
                {upcomingMembersList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No members scheduled with renewals beyond 7 days.
                  </div>
                ) : (
                  <div>
                    {/* Desktop column header */}
                    <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/20">
                      <div className="col-span-3">MEMBER</div>
                      <div className="col-span-3">PLAN & PAYMENT</div>
                      <div className="col-span-3">DUE STATUS & FOLLOW-UP</div>
                      <div className="col-span-3 text-right">ACTIONS</div>
                    </div>

                    {upcomingMembersList.map(renderMemberRow)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Manage Message Scripts Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card text-foreground rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 my-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Manage Message Scripts
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Customize WhatsApp & Email follow-up templates
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">
              <span className="font-semibold text-foreground">
                Available placeholder tags:
              </span>{" "}
              <code className="text-primary font-mono">&#123;memberName&#125;</code>,{" "}
              <code className="text-primary font-mono">&#123;planName&#125;</code>,{" "}
              <code className="text-primary font-mono">&#123;dueAmount&#125;</code>,{" "}
              <code className="text-primary font-mono">&#123;dueDate&#125;</code>,{" "}
              <code className="text-primary font-mono">&#123;gymName&#125;</code>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {Object.entries(editingScripts).map(([key, script]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    {script.title}
                  </label>
                  <textarea
                    rows={3}
                    value={script.template}
                    onChange={(e) =>
                      setEditingScripts((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], template: e.target.value },
                      }))
                    }
                    className="w-full p-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                  />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetScripts}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                Reset to Defaults
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScriptModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-sm font-semibold text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveScripts}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Save Scripts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Promise-to-Pay Date Popover Modal */}
      {promiseModalMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card text-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 my-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Log Promise-to-Pay
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                    {promiseModalMember.fullName} (₹
                    {promiseModalMember.dueAmount.toLocaleString("en-IN")})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPromiseModalMember(null)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground">
                Quick Select Date:
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickPromiseDate(0)}
                  className="py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPromiseDate(1)}
                  className="py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPromiseDate(3)}
                  className="py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  In 3 Days
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPromiseDate(7)}
                  className="py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  In 1 Week
                </button>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Or pick specific date:
                </label>
                <input
                  type="date"
                  min={getTodayIST()}
                  value={promiseDateInput}
                  onChange={(e) => setPromiseDateInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 transition-all"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromiseModalMember(null)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePromise}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Save Promise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Record Payment Modal (with WhatsApp Digital Receipt support) */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card text-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Record Member Payment
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Collect dues and send instant WhatsApp receipt
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePaymentModal}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {waReceiptUrl ? (
              <div className="mt-6 text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-foreground">
                    Payment Recorded Successfully!
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send the digital payment receipt directly via WhatsApp.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2.5">
                  <a
                    href={waReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 flex items-center justify-center gap-2 w-full px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Receipt via WhatsApp
                  </a>
                  <button
                    onClick={handleClosePaymentModal}
                    className="h-10 w-full text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
                {paymentError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Member Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Select Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMemberId}
                    onChange={(e) => setPaymentMemberId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    required
                  >
                    <option value="">-- Choose Member --</option>
                    {allMembersForPayment.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.phone})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Amount Received (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-semibold">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 1500"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                      required
                    />
                  </div>
                </div>

                {/* Payment Method & Date in 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / QR</option>
                      <option value="card">Debit / Credit Card</option>
                      <option value="bank_transfer">Net Banking</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                      required
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Partial balance clearance"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={paymentLoading}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    {paymentLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Record Payment
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
