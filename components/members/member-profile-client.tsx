"use client";

import { useState, startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Dumbbell,
  Edit2,
  FileText,
  IndianRupee,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  MoreVertical,
  CheckSquare,
  Sparkles,
  ChevronRight,
  Activity,
  X,
  Loader2,
  Copy,
  Check,
  Crown,
  Mail,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { GymApraLogo } from "@/components/ui/gymapra-logo";
import { EditMemberModal } from "@/components/members/edit-member-modal";
import {
  RenewMembershipModal,
  MembershipPlanOption,
} from "@/components/members/renew-membership-modal";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";
import { staffCheckInAction } from "@/lib/actions/attendance";
import { recordPaymentAction } from "@/lib/actions/payments";
import { getStatusBadgeClass, formatDate } from "@/lib/utils";

export interface MemberProfileClientProps {
  gymId: string;
  gymName: string;
  gymPhone?: string;
  todayStr: string;
  permissions: {
    canManageMembers: boolean;
    canRecordPayments: boolean;
    canRecordAttendance: boolean;
  };
  member: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
    branchId: string;
    branchName: string;
    status: "active" | "inactive" | "suspended";
    notes?: string | null;
    createdAt: string;
    userId?: string | null;
  };
  branches: { id: string; name: string }[];
  plans: MembershipPlanOption[];
  activeMembership: {
    id: string;
    planId?: string;
    planName: string;
    planPrice: number;
    durationDays?: number;
    startDate: string;
    endDate: string;
    status: string;
    daysLeft: number;
  } | null;
  memberships: {
    id: string;
    planId?: string;
    planName: string;
    planPrice: number;
    durationDays?: number;
    startDate: string;
    endDate: string;
    status: string;
    notes?: string | null;
    createdAt: string;
  }[];
  payments: {
    id: string;
    membershipId?: string | null;
    amount: number;
    paymentMethod: string;
    paymentStatus: string;
    paymentDate: string;
    notes?: string | null;
    createdAt?: string;
  }[];
  attendance: {
    id: string;
    checkInDate: string;
    checkInTime: string;
    checkInMethod: string;
    branchName?: string;
  }[];
  totalPaid: number;
  outstandingDues: number;
  totalWorkouts: number;
  currentMonthAttendance: number;
}

type ProfileTab = "overview" | "membership" | "attendance" | "payments" | "activity";

interface ActivityEvent {
  id: string;
  type: "attendance" | "payment" | "membership";
  title: string;
  subtitle: string;
  dateStr: string;
  sortKey: string;
}

function getMembershipBadgeInfo(
  memberStatus: string,
  activeMembership: MemberProfileClientProps["activeMembership"],
  memberships: MemberProfileClientProps["memberships"]
): { label: string; className: string; isTrial: boolean; isExpired: boolean; isUnassigned: boolean } {
  if (memberStatus === "suspended") {
    return {
      label: "Suspended",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
      isTrial: false,
      isExpired: false,
      isUnassigned: false,
    };
  }
  if (memberStatus === "inactive") {
    return {
      label: "Inactive",
      className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/25",
      isTrial: false,
      isExpired: false,
      isUnassigned: false,
    };
  }
  if (activeMembership) {
    const isTrial = activeMembership.planName.toLowerCase().includes("trial");
    if (activeMembership.daysLeft < 0) {
      return {
        label: "Expired",
        className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
        isTrial,
        isExpired: true,
        isUnassigned: false,
      };
    }
    if (isTrial) {
      return {
        label: "Trial",
        className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25",
        isTrial: true,
        isExpired: false,
        isUnassigned: false,
      };
    }
    if (activeMembership.daysLeft <= 7) {
      return {
        label: "Expiring Soon",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
        isTrial: false,
        isExpired: false,
        isUnassigned: false,
      };
    }
    return {
      label: "Active",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
      isTrial: false,
      isExpired: false,
      isUnassigned: false,
    };
  }
  if (memberships.length > 0) {
    return {
      label: "Expired",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
      isTrial: false,
      isExpired: true,
      isUnassigned: false,
    };
  }
  return {
    label: "Unassigned",
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/25",
    isTrial: false,
    isExpired: false,
    isUnassigned: true,
  };
}

export function MemberProfileClient({
  gymId,
  gymName,
  gymPhone,
  todayStr,
  permissions,
  member,
  branches,
  plans,
  activeMembership,
  memberships,
  payments,
  attendance,
  totalPaid,
  outstandingDues,
  totalWorkouts,
  currentMonthAttendance,
}: MemberProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Check-in quick action state
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
    canOverride?: boolean;
  } | null>(null);

  // Quick Record Payment Modal state
  const [payAmount, setPayAmount] = useState(
    outstandingDues > 0 ? String(outstandingDues) : ""
  );
  const [payMethod, setPayMethod] = useState<
    "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other"
  >("upi");
  const [payDate, setPayDate] = useState(todayStr);
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const cleanPhone = (member.phone || "").replace(/\D/g, "");
  const hasPhone = cleanPhone.length >= 7;
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waDirectUrl = hasPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(
        `Hello ${member.fullName}! This is ${gymName}.`
      )}`
    : "#";
  const telUrl = hasPhone ? `tel:${cleanPhone}` : "#";
  const shortMemberId = `#${member.id.slice(0, 8).toUpperCase()}`;

  const badgeInfo = getMembershipBadgeInfo(member.status, activeMembership, memberships);
  const showConvertToMembership =
    permissions.canManageMembers &&
    (badgeInfo.isTrial || badgeInfo.isUnassigned || badgeInfo.isExpired);

  // Confirmed payments only
  const confirmedPayments = payments.filter(
    (p) => p.paymentStatus === "paid" || p.paymentStatus === "partial"
  );
  const lastConfirmedPayment = confirmedPayments[0] || null;

  // Membership progress calculation
  let validityProgress = 0;
  if (activeMembership) {
    const startMs = new Date(`${activeMembership.startDate}T00:00:00`).getTime();
    const endMs = new Date(`${activeMembership.endDate}T00:00:00`).getTime();
    const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
    const totalSpan = Math.max(1, endMs - startMs);
    const elapsed = Math.max(0, Math.min(totalSpan, todayMs - startMs));
    validityProgress = Math.round((elapsed / totalSpan) * 100);
  }

  // Real chronological activity events
  const activityEvents: ActivityEvent[] = [
    ...attendance.map((att) => ({
      id: `att-${att.id}`,
      type: "attendance" as const,
      title: `Checked in (${att.checkInMethod.replace("_", " ").toUpperCase()})`,
      subtitle: att.branchName || member.branchName,
      dateStr: att.checkInDate,
      sortKey: att.checkInTime || `${att.checkInDate}T00:00:00`,
    })),
    ...confirmedPayments.map((p) => ({
      id: `pay-${p.id}`,
      type: "payment" as const,
      title: `Payment of ₹${p.amount.toLocaleString("en-IN")} received`,
      subtitle: `${p.paymentMethod.toUpperCase()} • ${p.paymentStatus}`,
      dateStr: p.paymentDate,
      sortKey: p.createdAt || `${p.paymentDate}T00:00:00`,
    })),
    ...memberships.map((m) => ({
      id: `mem-${m.id}`,
      type: "membership" as const,
      title: `${m.planName} (${m.status})`,
      subtitle: `${formatDate(m.startDate)} – ${formatDate(m.endDate)}`,
      dateStr: m.startDate,
      sortKey: m.createdAt || `${m.startDate}T00:00:00`,
    })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const recentActivity = activityEvents.slice(0, 5);

  function copyMemberId() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shortMemberId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1800);
    }
    setMenuOpen(false);
  }

  async function handleMarkAttendance(isOverride = false) {
    setCheckInLoading(true);
    setActionFeedback(null);
    try {
      const res = await staffCheckInAction({
        gymId,
        branchId: member.branchId,
        memberId: member.id,
        isOverride,
        overrideReason: isOverride ? "Staff profile quick check-in override" : undefined,
      });
      if (res.success) {
        setActionFeedback({
          type: "success",
          message: "Attendance marked successfully for today.",
        });
        startTransition(() => router.refresh());
      } else {
        setActionFeedback({
          type: "error",
          message: res.error || "Could not mark attendance.",
          canOverride: Boolean(res.isExpired && !isOverride && permissions.canManageMembers),
        });
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to mark attendance.",
      });
    } finally {
      setCheckInLoading(false);
    }
  }

  async function handleQuickPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPayError(null);
    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPayError("Please enter a valid positive amount.");
      return;
    }

    setPayLoading(true);
    try {
      const res = await recordPaymentAction({
        gymId,
        branchId: member.branchId,
        memberId: member.id,
        membershipId: activeMembership?.id || null,
        amount: numAmount,
        paymentMethod: payMethod,
        paymentDate: payDate,
        paymentStatus: "paid",
        notes: payNotes.trim() || null,
      });

      if (!res || !res.success) {
        setPayError(res?.error || "Failed to record payment.");
        setPayLoading(false);
        return;
      }

      setPayLoading(false);
      setIsPaymentModalOpen(false);
      setPayNotes("");
      setActionFeedback({
        type: "success",
        message: `Payment of ₹${numAmount.toLocaleString("en-IN")} recorded.`,
      });
      startTransition(() => router.refresh());
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to record payment.");
      setPayLoading(false);
    }
  }

  function openReceipt(p: (typeof payments)[0]) {
    const receiptData: ReceiptData = {
      id: p.id,
      gymName,
      branchName: member.branchName,
      gymPhone,
      memberName: member.fullName,
      memberPhone: member.phone,
      memberEmail: member.email || undefined,
      planName: activeMembership?.planName || "Membership Fee",
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      paymentDate: p.paymentDate,
      notes: p.notes || undefined,
      outstandingDues: outstandingDues > 0 ? outstandingDues : 0,
    };
    setSelectedReceipt(receiptData);
  }

  function handleRenewalSuccess(res: {
    paymentId?: string | null;
    planName: string;
    amountPaid: number;
    paymentMethod: string;
    startDate: string;
    endDate: string;
  }) {
    router.refresh();
    if (res.paymentId) {
      const receiptData: ReceiptData = {
        id: res.paymentId,
        gymName,
        branchName: member.branchName,
        gymPhone,
        memberName: member.fullName,
        memberPhone: member.phone,
        memberEmail: member.email || undefined,
        planName: res.planName,
        amount: res.amountPaid,
        paymentMethod: res.paymentMethod,
        paymentStatus: "paid",
        paymentDate: res.startDate,
        outstandingDues: 0,
      };
      setSelectedReceipt(receiptData);
    }
  }

  const latestMembership = memberships[0] || null;
  const initials =
    member.fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M";
  const mobileHeroBadgeClass = badgeInfo.isUnassigned
    ? "bg-slate-600/90 text-white border-white/25"
    : badgeInfo.isExpired
    ? "bg-rose-500/90 text-white border-rose-300/40"
    : badgeInfo.isTrial
    ? "bg-purple-500/90 text-white border-purple-300/40"
    : activeMembership && activeMembership.daysLeft <= 7
    ? "bg-amber-500/90 text-white border-amber-300/40"
    : "bg-emerald-600/90 text-white border-emerald-300/40";
  const latestPlanRecord = activeMembership || latestMembership;
  const totalBilled = totalPaid + outstandingDues;

  return (
    <div className="space-y-3 md:space-y-5 text-foreground">
      {/* Mobile Contextual Header & Hero Banner */}
      <div className="md:hidden space-y-3">
        <div className="relative flex items-center justify-between gap-2">
          <Link
            href={`/app/${gymId}/members`}
            aria-label="Back to Members"
            className="h-9 w-9 rounded-full bg-card border border-border shadow-2xs flex items-center justify-center text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <Link
            href={`/app/${gymId}/dashboard`}
            className="inline-flex items-center gap-1.5 min-w-0"
          >
            <GymApraLogo variant="symbol" size="sm" />
            <span className="text-base font-black tracking-tight text-foreground truncate">
              GymApra
            </span>
          </Link>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMobileMoreOpen((v) => !v)}
              aria-label="Member actions menu"
              className="h-9 w-9 rounded-full bg-card border border-border shadow-2xs flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {mobileMoreOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMobileMoreOpen(false)}
                />
                <div className="absolute right-0 top-11 z-30 w-48 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl p-1.5 text-xs font-semibold">
                  {hasPhone && (
                    <a
                      href={telUrl}
                      onClick={() => setMobileMoreOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      Call Member
                    </a>
                  )}
                  {hasPhone && (
                    <a
                      href={waDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMoreOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp Member
                    </a>
                  )}
                  {permissions.canManageMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMoreOpen(false);
                        setIsEditOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-primary" />
                      Edit Member
                    </button>
                  )}
                  {permissions.canManageMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMoreOpen(false);
                        setIsRenewOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-primary" />
                      Renew / Change Plan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      copyMemberId();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    {copiedId ? "Copied ID" : "Copy Member ID"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Photo Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-zinc-900 p-4 text-white shadow-sm">
          <Image
            src="/images/auth-gym-dumbbells.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-right opacity-55"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/45" />

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-xs border-2 border-white/40 flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-md">
              {initials}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-lg font-black leading-tight text-white truncate">
                  {member.fullName}
                </h1>
                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${mobileHeroBadgeClass}`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {badgeInfo.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-white/90 truncate">
                <Phone className="w-3.5 h-3.5 shrink-0 text-white/75" />
                <span className="truncate font-medium">
                  {member.phone || "No phone"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-white/80 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0 text-white/75" />
                <span className="truncate">
                  {member.email || `${shortMemberId} • ${member.branchName}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Back Navigation & Header Banner */}
      <div className="hidden md:block space-y-5">
      {/* Back Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/app/${gymId}/members`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Members
        </Link>
      </div>

      {/* Profile Header Banner */}
      <div className="relative overflow-hidden bg-card rounded-3xl border border-border shadow-xs p-5 sm:p-6 text-card-foreground">
        {/* Subtle gym background image on right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 sm:w-2/5 overflow-hidden opacity-15 dark:opacity-10"
        >
          <Image
            src="/images/auth-gym-interior.jpg"
            alt=""
            fill
            sizes="40vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/12 text-primary border border-primary/25 flex items-center justify-center text-xl sm:text-2xl font-black shadow-xs shrink-0">
              {member.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">
                  {member.fullName}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeInfo.className}`}
                >
                  {badgeInfo.label}
                </span>
                {member.userId && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                    <ShieldCheck className="w-3 h-3" /> Portal
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="font-mono font-bold text-foreground/80">
                  {shortMemberId}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-foreground/90">
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  {member.branchName}
                </span>
                <span>•</span>
                {activeMembership ? (
                  <span
                    className={`font-semibold ${
                      activeMembership.daysLeft < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : activeMembership.daysLeft <= 7
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {activeMembership.daysLeft < 0
                      ? `Expired on ${formatDate(activeMembership.endDate)}`
                      : `Expires in ${activeMembership.daysLeft}d (${formatDate(
                          activeMembership.endDate
                        )})`}
                  </span>
                ) : latestMembership ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    Expired on {formatDate(latestMembership.endDate)}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-medium">
                    No active plan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {hasPhone ? (
              <a
                href={telUrl}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/25 rounded-xl text-xs font-bold transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 bg-muted/50 text-muted-foreground border border-border rounded-xl text-xs font-bold opacity-60 cursor-not-allowed"
              >
                <Phone className="w-3.5 h-3.5" />
                No Phone
              </span>
            )}

            {hasPhone && (
              <a
                href={waDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 rounded-xl text-xs font-bold transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            )}

            {permissions.canManageMembers && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}

            {/* Contextual Overflow Menu */}
            <div className="relative">
              <button
                type="button"
                aria-label="More member actions"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 bg-muted/70 hover:bg-muted text-foreground border border-border rounded-xl transition-colors cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-48 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-xs font-semibold">
                    {permissions.canManageMembers && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setIsRenewOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-primary" />
                        Renew / Change Plan
                      </button>
                    )}
                    {permissions.canRecordPayments && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setPayAmount(outstandingDues > 0 ? String(outstandingDues) : "");
                          setIsPaymentModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                        Record Payment
                      </button>
                    )}
                    {permissions.canRecordAttendance && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          handleMarkAttendance(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                        Mark Attendance
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={copyMemberId}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors cursor-pointer"
                    >
                      {copiedId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {copiedId ? "Copied ID" : "Copy Member ID"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-semibold ${
            actionFeedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {actionFeedback.canOverride && (
              <button
                type="button"
                onClick={() => handleMarkAttendance(true)}
                disabled={checkInLoading}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 font-bold transition-colors cursor-pointer"
              >
                Grace Override Check-in
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile 4-Tab Segmented Navigation */}
      <div className="md:hidden flex items-center justify-between gap-0.5 p-1 rounded-2xl bg-card border border-border shadow-2xs">
        {[
          { id: "overview" as const, label: "Overview", icon: null },
          { id: "attendance" as const, label: "Attendance", icon: Calendar },
          { id: "payments" as const, label: "Payments", icon: CreditCard },
          { id: "activity" as const, label: "History", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 px-2 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {Icon && <Icon className="w-3 h-3 shrink-0" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Membership Tab Back Pill */}
      {activeTab === "membership" && (
        <div className="md:hidden flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Overview
          </button>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {memberships.length} contract{memberships.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {/* Desktop Navigation Tabs */}
      <div className="hidden md:flex items-center gap-1.5 border-b border-border pb-2.5 overflow-x-auto no-scrollbar">
        {[
          { id: "overview" as const, label: "Overview", icon: User },
          {
            id: "membership" as const,
            label: `Membership (${memberships.length})`,
            icon: Calendar,
          },
          {
            id: "attendance" as const,
            label: `Attendance (${attendance.length})`,
            icon: Clock,
          },
          {
            id: "payments" as const,
            label: `Payments (${payments.length})`,
            icon: CreditCard,
          },
          {
            id: "activity" as const,
            label: `Activity (${activityEvents.length})`,
            icon: Activity,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-3 md:space-y-5">
          {/* Dedicated Mobile Overview Layout */}
          <div className="md:hidden space-y-3">
            {/* 1. Membership Summary Card */}
            <button
              type="button"
              onClick={() => setActiveTab("membership")}
              className="w-full text-left bg-card rounded-2xl border border-border shadow-2xs p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-amber-500/12 [.dark_&]:bg-amber-500/20 text-amber-600 [.dark_&]:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Membership
                  </div>
                  <div className="text-sm font-black text-foreground truncate">
                    {latestPlanRecord ? latestPlanRecord.planName : "No Plan Assigned"}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {latestPlanRecord
                      ? `${formatDate(latestPlanRecord.startDate)} – ${formatDate(latestPlanRecord.endDate)}`
                      : "Tap to view or assign plan"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    activeMembership
                      ? activeMembership.daysLeft <= 7
                        ? "bg-amber-500/12 [.dark_&]:bg-amber-950/45 text-amber-700 [.dark_&]:text-amber-300 border-amber-500/25"
                        : "bg-amber-500/12 [.dark_&]:bg-amber-950/45 text-amber-800 [.dark_&]:text-amber-300 border-amber-500/25"
                      : badgeInfo.className
                  }`}
                >
                  {activeMembership
                    ? activeMembership.daysLeft <= 0
                      ? "Ends today"
                      : `${activeMembership.daysLeft} days left`
                    : badgeInfo.label}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>

            {/* 2. Attendance Summary Card (Factual counts, no fake target denominator) */}
            <div className="bg-card rounded-2xl border border-border shadow-2xs p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-indigo-500/12 [.dark_&]:bg-indigo-500/20 text-indigo-600 [.dark_&]:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-black text-foreground truncate">
                    Attendance{" "}
                    <span className="font-normal text-xs text-muted-foreground">
                      (This Month)
                    </span>
                  </div>
                </div>
                <div className="text-xs shrink-0">
                  <span className="font-black text-foreground">
                    {currentMonthAttendance}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {currentMonthAttendance === 1 ? "visit" : "visits"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 [.dark_&]:bg-emerald-950/45 text-emerald-700 [.dark_&]:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
                  <Activity className="w-3.5 h-3.5" />
                  {totalWorkouts} total ·{" "}
                  {attendance[0]
                    ? `Last ${formatDate(attendance[0].checkInDate)}`
                    : "No visits yet"}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  className="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline cursor-pointer shrink-0"
                >
                  View Details →
                </button>
              </div>
            </div>

            {/* 3. Payment Summary Card (3 Tinted Tiles) */}
            <div className="bg-card rounded-2xl border border-border shadow-2xs p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-purple-500/12 [.dark_&]:bg-purple-500/20 text-purple-600 [.dark_&]:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-black text-foreground">
                    Payment Summary
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("payments")}
                  aria-label="View payment history"
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-2.5 text-center bg-emerald-500/10 [.dark_&]:bg-emerald-950/45 border border-emerald-500/20">
                  <div className="text-sm font-black text-emerald-700 [.dark_&]:text-emerald-300 tabular-nums truncate">
                    ₹{totalPaid.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                    Paid
                  </div>
                </div>

                <div
                  className={`rounded-xl p-2.5 text-center border ${
                    outstandingDues > 0
                      ? "bg-amber-500/12 [.dark_&]:bg-amber-950/45 border-amber-500/25"
                      : "bg-blue-500/10 [.dark_&]:bg-blue-950/45 border-blue-500/20"
                  }`}
                >
                  <div
                    className={`text-sm font-black tabular-nums truncate ${
                      outstandingDues > 0
                        ? "text-amber-700 [.dark_&]:text-amber-300"
                        : "text-blue-700 [.dark_&]:text-blue-300"
                    }`}
                  >
                    ₹{outstandingDues.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                    Due
                  </div>
                </div>

                <div className="rounded-xl p-2.5 text-center bg-purple-500/10 [.dark_&]:bg-purple-950/45 border border-purple-500/20">
                  <div className="text-sm font-black text-purple-700 [.dark_&]:text-purple-300 tabular-nums truncate">
                    ₹{totalBilled.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                    Total
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Primary Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={!permissions.canManageMembers}
                onClick={() => setIsEditOpen(true)}
                className="h-11 px-3 rounded-2xl bg-primary/12 [.dark_&]:bg-primary/20 hover:bg-primary/18 text-primary border border-primary/20 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-45 cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                Edit Member
              </button>

              <button
                type="button"
                disabled={!permissions.canRecordPayments}
                onClick={() => setIsPaymentModalOpen(true)}
                className="h-11 px-3 rounded-2xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-xs shadow-sm inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-45 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
            </div>

            {/* 5. Secondary Quick Actions (4-Column Compact Grid) */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={!permissions.canRecordAttendance || checkInLoading}
                onClick={() => handleMarkAttendance(false)}
                className="bg-card hover:bg-muted/60 rounded-2xl border border-border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors disabled:opacity-45 cursor-pointer shadow-2xs"
              >
                {checkInLoading ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <CheckSquare className="w-4 h-4 text-primary" />
                )}
                <span className="text-[11px] font-semibold text-foreground leading-tight">
                  Mark Attendance
                </span>
              </button>

              <button
                type="button"
                disabled={!permissions.canManageMembers}
                onClick={() => setIsRenewOpen(true)}
                className="bg-card hover:bg-muted/60 rounded-2xl border border-border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors disabled:opacity-45 cursor-pointer shadow-2xs"
              >
                <RefreshCw className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">
                  Renew / Change Plan
                </span>
              </button>

              {showConvertToMembership ? (
                <button
                  type="button"
                  onClick={() => setIsRenewOpen(true)}
                  className="bg-card hover:bg-muted/60 rounded-2xl border border-border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer shadow-2xs"
                >
                  <Crown className="w-4 h-4 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground leading-tight">
                    Convert to Membership
                  </span>
                </button>
              ) : (
                <a
                  href={hasPhone ? waDirectUrl : undefined}
                  target={hasPhone ? "_blank" : undefined}
                  rel={hasPhone ? "noopener noreferrer" : undefined}
                  className={`bg-card hover:bg-muted/60 rounded-2xl border border-border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors shadow-2xs ${
                    !hasPhone ? "opacity-45 pointer-events-none" : ""
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600 [.dark_&]:text-emerald-400" />
                  <span className="text-[11px] font-semibold text-foreground leading-tight">
                    WhatsApp Member
                  </span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setMobileMoreOpen((v) => !v)}
                className="bg-card hover:bg-muted/60 rounded-2xl border border-border p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer shadow-2xs"
              >
                <MoreVertical className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-semibold text-foreground leading-tight">
                  More Actions
                </span>
              </button>
            </div>

            {/* 6. Expandable Member Details Row */}
            <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setDetailsExpanded((v) => !v)}
                aria-expanded={detailsExpanded}
                className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-black text-foreground">
                    Member Details
                  </span>
                </div>
                {detailsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {detailsExpanded && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-border/70 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Member ID
                    </div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {shortMemberId}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Joined Date
                    </div>
                    <div className="font-semibold text-foreground mt-0.5">
                      {formatDate(member.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Branch
                    </div>
                    <div className="font-semibold text-foreground mt-0.5 truncate">
                      {member.branchName}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Phone
                    </div>
                    <div className="font-semibold text-foreground mt-0.5 truncate">
                      {member.phone || "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Email
                    </div>
                    <div className="font-semibold text-foreground mt-0.5 truncate">
                      {member.email || "—"}
                    </div>
                  </div>
                  {member.notes && (
                    <div className="col-span-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Notes
                      </div>
                      <div className="text-foreground/90 mt-0.5">
                        {member.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Overview Layout */}
          <div className="hidden md:block space-y-5">
          {/* 3 Overview Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Membership Summary Card */}
            <div className="bg-card bg-gradient-to-br from-purple-50/70 via-card to-purple-50/30 [.dark_&]:from-purple-500/[0.12] [.dark_&]:via-card [.dark_&]:to-purple-500/[0.04] rounded-3xl border border-purple-200/80 [.dark_&]:border-purple-500/25 shadow-xs p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-purple-500/12 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Membership
                    </div>
                    <div className="text-base font-black text-foreground truncate">
                      {activeMembership
                        ? activeMembership.planName
                        : latestMembership
                        ? latestMembership.planName
                        : "No Plan Assigned"}
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeInfo.className}`}
                >
                  {badgeInfo.label}
                </span>
              </div>

              {activeMembership ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formatDate(activeMembership.startDate)} –{" "}
                      {formatDate(activeMembership.endDate)}
                    </span>
                    <span className="font-bold text-foreground">
                      {activeMembership.daysLeft >= 0
                        ? `${activeMembership.daysLeft}d left`
                        : `${Math.abs(activeMembership.daysLeft)}d overdue`}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        activeMembership.daysLeft < 0
                          ? "bg-rose-500"
                          : activeMembership.daysLeft <= 7
                          ? "bg-amber-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${validityProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-2xl p-3 border border-border/60">
                  {latestMembership
                    ? `Last plan ended on ${formatDate(latestMembership.endDate)}.`
                    : "Assign a membership plan to activate gym access."}
                </div>
              )}
            </div>

            {/* 2. Attendance Summary Card */}
            <div className="bg-card bg-gradient-to-br from-emerald-50/70 via-card to-emerald-50/30 [.dark_&]:from-emerald-500/[0.12] [.dark_&]:via-card [.dark_&]:to-emerald-500/[0.04] rounded-3xl border border-emerald-200/80 [.dark_&]:border-emerald-500/25 shadow-xs p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Attendance
                    </div>
                    <div className="text-base font-black text-foreground">
                      {currentMonthAttendance} Check-ins This Month
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-muted/40 rounded-2xl p-3 border border-border/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Recent Sessions
                  </div>
                  <div className="text-sm font-black text-foreground mt-0.5">
                    {totalWorkouts} Visits
                  </div>
                </div>
                <div className="bg-muted/40 rounded-2xl p-3 border border-border/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Last Visit
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5 truncate">
                    {attendance.length > 0
                      ? formatDate(attendance[0].checkInDate)
                      : "No visits"}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Payments Summary Card */}
            <div className="bg-card bg-gradient-to-br from-blue-50/70 via-card to-blue-50/30 [.dark_&]:from-blue-500/[0.12] [.dark_&]:via-card [.dark_&]:to-blue-500/[0.04] rounded-3xl border border-blue-200/80 [.dark_&]:border-blue-500/25 shadow-xs p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Payments
                    </div>
                    <div className="text-base font-black text-foreground">
                      ₹{totalPaid.toLocaleString("en-IN")} Lifetime Paid
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    outstandingDues > 0
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                  }`}
                >
                  {outstandingDues > 0 ? "Dues Pending" : "All Cleared"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-muted/40 rounded-2xl p-2.5 border border-border/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Paid
                  </div>
                  <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                    ₹{totalPaid.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-2xl p-2.5 border border-border/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Due
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-black mt-0.5 truncate ${
                      outstandingDues > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-foreground"
                    }`}
                  >
                    ₹{outstandingDues.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-2xl p-2.5 border border-border/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Last Paid
                  </div>
                  <div className="text-xs font-bold text-foreground mt-0.5 truncate">
                    {lastConfirmedPayment
                      ? formatDate(lastConfirmedPayment.paymentDate)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Member Details + Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Member Details */}
            <div className="lg:col-span-7 bg-card rounded-3xl border border-border shadow-xs p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Member Details
                </h2>
                {permissions.canManageMembers && (
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    Edit Details
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                  <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">
                    Phone Number
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    {member.phone || "—"}
                  </span>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                  <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">
                    Email Address
                  </span>
                  <span className="font-bold text-foreground text-sm truncate block">
                    {member.email || "Not provided"}
                  </span>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                  <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">
                    Branch
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    {member.branchName}
                  </span>
                </div>
                <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                  <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">
                    Joining Date
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    {formatDate(member.createdAt)}
                  </span>
                </div>
              </div>

              {member.notes && (
                <div className="mt-4 p-3.5 bg-primary/5 rounded-2xl border border-primary/20 text-xs text-foreground">
                  <span className="font-bold text-primary block mb-1">
                    Notes
                  </span>
                  {member.notes}
                </div>
              )}
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="lg:col-span-5 space-y-5">
              {/* Quick Actions */}
              <div className="bg-card rounded-3xl border border-border shadow-xs p-5">
                <h2 className="text-sm font-bold text-foreground mb-3.5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                  {permissions.canRecordPayments && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayAmount(
                          outstandingDues > 0 ? String(outstandingDues) : ""
                        );
                        setIsPaymentModalOpen(true);
                      }}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 hover:bg-emerald-500/14 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <IndianRupee className="w-4 h-4" />
                        Record Payment
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  )}

                  {permissions.canManageMembers && (
                    <button
                      type="button"
                      onClick={() => setIsRenewOpen(true)}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl border border-purple-500/20 bg-purple-500/8 hover:bg-purple-500/14 text-purple-700 dark:text-purple-400 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <RefreshCw className="w-4 h-4" />
                        Renew / Change Plan
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  )}

                  {permissions.canRecordAttendance && (
                    <button
                      type="button"
                      disabled={checkInLoading}
                      onClick={() => handleMarkAttendance(false)}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl border border-blue-500/20 bg-blue-500/8 hover:bg-blue-500/14 text-blue-700 dark:text-blue-400 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2.5">
                        {checkInLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckSquare className="w-4 h-4" />
                        )}
                        Mark Attendance
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  )}

                  {showConvertToMembership && (
                    <button
                      type="button"
                      onClick={() => setIsRenewOpen(true)}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 hover:bg-amber-500/14 text-amber-700 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4" />
                        Convert to Membership
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-card rounded-3xl border border-border shadow-xs p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Recent Activity
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                {recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No recorded activity yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {recentActivity.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-muted/35 border border-border/50 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">
                            {ev.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {ev.subtitle}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                          {formatDate(ev.dateStr)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* TAB: MEMBERSHIP */}
      {activeTab === "membership" && (
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">
              Subscription History
            </div>
            {permissions.canManageMembers && (
              <button
                type="button"
                onClick={() => setIsRenewOpen(true)}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                + New Contract
              </button>
            )}
          </div>
          <div className="md:hidden divide-y divide-border">
            {memberships.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No membership contracts found.
              </div>
            ) : (
              memberships.map((m) => (
                <div key={m.id} className="p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground truncate">
                      {m.planName}
                    </span>
                    <span className={getStatusBadgeClass(m.status)}>
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>
                      {formatDate(m.startDate)} – {formatDate(m.endDate)}
                    </span>
                    <span className="font-bold text-foreground">
                      ₹{m.planPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-5">Plan Name</th>
                  <th className="p-4">Plan Price</th>
                  <th className="p-4">Start Date</th>
                  <th className="p-4">End Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {memberships.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No membership contracts found.
                    </td>
                  </tr>
                ) : (
                  memberships.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4 pl-5 font-bold text-foreground">
                        {m.planName}
                      </td>
                      <td className="p-4 font-semibold">
                        ₹{m.planPrice.toLocaleString("en-IN")}
                      </td>
                      <td className="p-4 font-medium text-muted-foreground">
                        {formatDate(m.startDate)}
                      </td>
                      <td className="p-4 font-medium text-muted-foreground">
                        {formatDate(m.endDate)}
                      </td>
                      <td className="p-4">
                        <span className={getStatusBadgeClass(m.status)}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-muted-foreground italic">
                        {m.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS */}
      {activeTab === "payments" && (
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">
              Payment Ledger & Receipts
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {payments.length} entries
            </div>
          </div>
          <div className="md:hidden divide-y divide-border">
            {payments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No payments recorded yet for this member.
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-black text-foreground">
                      ₹
                      {p.amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <span className={getStatusBadgeClass(p.paymentStatus)}>
                      {p.paymentStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>
                      {formatDate(p.paymentDate)} •{" "}
                      <span className="uppercase font-semibold">
                        {p.paymentMethod}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => openReceipt(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      Receipt
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-5">Receipt Ref</th>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No payments recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4 pl-5 font-mono font-bold text-foreground">
                        #{p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-4 font-medium text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </td>
                      <td className="p-4 font-black text-foreground">
                        ₹
                        {p.amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 uppercase font-bold text-muted-foreground text-[11px]">
                        {p.paymentMethod}
                      </td>
                      <td className="p-4">
                        <span className={getStatusBadgeClass(p.paymentStatus)}>
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => openReceipt(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl font-bold text-xs transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ATTENDANCE */}
      {activeTab === "attendance" && (
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">
              Workout & Visit History
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {attendance.length} check-ins
            </div>
          </div>
          <div className="md:hidden divide-y divide-border">
            {attendance.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No check-ins recorded yet for this member.
              </div>
            ) : (
              attendance.map((att) => (
                <div key={att.id} className="p-3.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">
                      {formatDate(att.checkInDate)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-[11px] border border-border">
                      {att.checkInMethod.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>
                      {new Date(att.checkInTime).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="truncate">
                      {att.branchName || member.branchName}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-5">Visit Date</th>
                  <th className="p-4">Check-in Time</th>
                  <th className="p-4">Check-in Method</th>
                  <th className="p-4 pr-5">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {attendance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No check-ins recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr
                      key={att.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-4 pl-5 font-bold text-foreground">
                        {formatDate(att.checkInDate)}
                      </td>
                      <td className="p-4 font-medium text-muted-foreground">
                        {new Date(att.checkInTime).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-[11px] border border-border">
                          {att.checkInMethod.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-muted-foreground font-medium">
                        {att.branchName || member.branchName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">
              Full Member Activity
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {activityEvents.length} events
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-2.5">
            {activityEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No activity recorded for this member yet.
              </div>
            ) : (
              activityEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/35 border border-border/60 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                        ev.type === "attendance"
                          ? "bg-blue-500/12 text-blue-600 dark:text-blue-400"
                          : ev.type === "payment"
                          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                          : "bg-purple-500/12 text-purple-600 dark:text-purple-400"
                      }`}
                    >
                      {ev.type === "attendance" ? (
                        <Clock className="w-4 h-4" />
                      ) : ev.type === "payment" ? (
                        <IndianRupee className="w-4 h-4" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {ev.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {formatDate(ev.dateStr)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Quick Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/12 text-emerald-600 rounded-xl">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">
                    Record Payment
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {member.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickPaymentSubmit} className="mt-4 space-y-3.5 text-xs">
              {payError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 font-semibold">
                  {payError}
                </div>
              )}

              <div>
                <label className="block font-bold text-foreground mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) =>
                      setPayMethod(
                        e.target.value as
                          | "cash"
                          | "upi"
                          | "card"
                          | "bank_transfer"
                          | "cheque"
                          | "other"
                      )
                    }
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Payment reference or note"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="h-9 px-4 rounded-xl border border-border bg-muted hover:bg-muted/80 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {payLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Modals */}
      <EditMemberModal
        gymId={gymId}
        member={{
          id: member.id,
          fullName: member.fullName,
          phone: member.phone,
          email: member.email,
          branchId: member.branchId,
          status: member.status,
          notes: member.notes,
        }}
        branches={branches}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <RenewMembershipModal
        gymId={gymId}
        branchId={member.branchId}
        memberId={member.id}
        memberName={member.fullName}
        currentPlanId={activeMembership?.planId}
        plans={plans}
        isOpen={isRenewOpen}
        onClose={() => setIsRenewOpen(false)}
        onSuccess={handleRenewalSuccess}
      />

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
