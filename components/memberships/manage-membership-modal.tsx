"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Sparkles,
  Ban,
  Layers,
} from "lucide-react";
import { manageMembershipAction } from "@/lib/actions/memberships";
import { formatDate, getISTDateString, calculateMembershipEndDate } from "@/lib/utils";
import { MembershipItem } from "./memberships-client";

export interface ManageMembershipPlanOption {
  id: string;
  name: string;
  price: number;
  durationDays: number;
}

export type MembershipPlanOption = ManageMembershipPlanOption;

interface ManageMembershipModalProps {
  gymId: string;
  membership: MembershipItem | null;
  plans: ManageMembershipPlanOption[];
  isOpen: boolean;
  onClose: () => void;
  onOpenAssignModal?: (memberId: string) => void;
  onSuccess?: (message: string) => void;
}

export function ManageMembershipModal({
  gymId,
  membership,
  plans,
  isOpen,
  onClose,
  onOpenAssignModal,
  onSuccess,
}: ManageMembershipModalProps) {
  // 1. Declare ALL React Hooks unconditionally at the very top
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"validity" | "plan">("validity");
  const [freezeDays, setFreezeDays] = useState<number | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedNewPlanId, setSelectedNewPlanId] = useState<string>("");
  const [allowEarlyRenew, setAllowEarlyRenew] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever selected membership changes
  useEffect(() => {
    if (membership && isOpen) {
      setError(null);
      setLoading(false);
      setIsCancelling(false);
      setAllowEarlyRenew(false);
      setReason("");
      setFreezeDays(null);
      setCustomEndDate(membership.endDate);
      setSelectedNewPlanId(membership.planId || plans[0]?.id || "");
      setActiveTab("validity");
    }
  }, [membership, isOpen, plans]);

  // Available plans (excluding current plan for clean change dropdown)
  const currentPlan = useMemo(() => {
    if (!membership) return null;
    return plans.find((p) => p.id === membership.planId) || null;
  }, [plans, membership]);

  const selectedNewPlan = useMemo(() => {
    if (!selectedNewPlanId) return null;
    return plans.find((p) => p.id === selectedNewPlanId) || null;
  }, [plans, selectedNewPlanId]);

  // Projected new end date when changing plan
  const projectedNewPlanEndDate = useMemo(() => {
    if (!membership || !selectedNewPlan) return "";
    return calculateMembershipEndDate(membership.startDate, selectedNewPlan.durationDays);
  }, [membership, selectedNewPlan]);

  // Price difference for upgrade/switch
  const priceDifference = useMemo(() => {
    if (!membership || !selectedNewPlan) return 0;
    return selectedNewPlan.price - membership.planPrice;
  }, [membership, selectedNewPlan]);

  // Check renewal eligibility
  const daysLeft = membership?.daysRemaining ?? 0;
  const isExpiringSoonOrExpired =
    !membership || daysLeft <= 7 || membership.status === "expired";
  const canProceedToRenew = isExpiringSoonOrExpired || allowEarlyRenew;

  // 2. Early return strictly AFTER all hooks have executed
  if (!isOpen || !membership) return null;

  // Quick freeze button handler
  function handleSelectFreeze(days: number) {
    setFreezeDays(days);
    try {
      const cur = new Date(membership!.endDate);
      cur.setDate(cur.getDate() + days);
      setCustomEndDate(getISTDateString(cur));
    } catch {
      // Fallback
    }
  }

  // Adjust validity handler
  async function handleSaveValidity(e: React.FormEvent) {
    e.preventDefault();
    if (!membership) return;
    setLoading(true);
    setError(null);

    try {
      const res = await manageMembershipAction({
        gymId,
        membershipId: membership.id,
        memberId: membership.memberId,
        operation: "adjust_dates",
        endDate: customEndDate,
        freezeDays: freezeDays || undefined,
        reason: reason.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to adjust validity");
        setLoading(false);
        return;
      }

      onClose();
      onSuccess?.(`Validity updated for ${membership.memberName}!`);
      setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
      }, 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to adjust validity");
      setLoading(false);
    }
  }

  // Change plan handler
  async function handleSaveChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!membership) return;
    if (!selectedNewPlanId || selectedNewPlanId === membership.planId) {
      setError("Please select a different membership plan");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await manageMembershipAction({
        gymId,
        membershipId: membership.id,
        memberId: membership.memberId,
        operation: "change_plan",
        newPlanId: selectedNewPlanId,
        reason: reason.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to change membership plan");
        setLoading(false);
        return;
      }

      onClose();
      onSuccess?.(`Plan changed to ${res.planName} for ${membership.memberName}!`);
      setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
      }, 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change membership plan");
      setLoading(false);
    }
  }

  // Cancel membership handler
  async function handleCancelMembership() {
    if (!membership) return;
    setLoading(true);
    setError(null);

    try {
      const res = await manageMembershipAction({
        gymId,
        membershipId: membership.id,
        memberId: membership.memberId,
        operation: "cancel_membership",
        reason: reason.trim() || "Cancelled via plan management",
      });

      if (!res.success) {
        setError(res.error || "Failed to cancel membership");
        setLoading(false);
        return;
      }

      onClose();
      onSuccess?.(`Membership cancelled for ${membership.memberName}.`);
      setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
      }, 200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel membership");
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-membership-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-border animate-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl border border-emerald-500/20">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 id="manage-membership-title" className="text-sm sm:text-base font-bold text-foreground">
                Manage Plan & Validity
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {membership.memberName} · {membership.planName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Controls */}
        <div className="mt-4 grid grid-cols-2 gap-1 p-1 bg-muted/60 border border-border/50 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("validity")}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "validity"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Validity & Freeze</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "plan"
                ? "bg-card text-foreground shadow-xs border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade / Change Plan</span>
          </button>
        </div>

        {/* Tab 1: Validity & Freeze */}
        {activeTab === "validity" && (
          <form onSubmit={handleSaveValidity} className="mt-4 space-y-4">
            {/* Current Contract Status Box */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Current Schedule</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    membership.status === "expired"
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                      : membership.isExpiringSoon
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {membership.status === "expired"
                    ? "Expired"
                    : `${membership.daysRemaining}d remaining`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Start Date</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatDate(membership.startDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Expiry Date</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatDate(membership.endDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Freeze / Extension Buttons */}
            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Quick Freeze & Validity Extension
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "+7 Days Freeze", days: 7 },
                  { label: "+15 Days Freeze", days: 15 },
                  { label: "+30 Days Extension", days: 30 },
                ].map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => handleSelectFreeze(item.days)}
                    className={`h-10 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                      freezeDays === item.days
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Expiry Date */}
            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Adjust Expiry Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="date"
                  value={customEndDate}
                  min={membership.startDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setFreezeDays(null);
                  }}
                  required
                  className="w-full h-10 sm:h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer tabular-nums"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Reason / Internal Note (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Travel freeze, medical leave, goodwill extension"
                className="w-full h-10 px-3.5 bg-muted/40 border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>

            {/* Actions for Validity */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCancelling(!isCancelling)}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Plan...</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="h-10 px-3.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading || customEndDate === membership.endDate}
                  className="flex items-center gap-1.5 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Validity</span>
                </button>
              </div>
            </div>

            {/* Inline Cancellation Drawer */}
            {isCancelling && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2 mt-2">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirm Plan Cancellation</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This terminates this membership contract immediately. Check-ins will be gated.
                </p>
                <button
                  type="button"
                  onClick={handleCancelMembership}
                  disabled={loading}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Upgrade / Change Plan */}
        {activeTab === "plan" && (
          <form onSubmit={handleSaveChangePlan} className="mt-4 space-y-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Select New Membership Plan *
              </label>
              <select
                value={selectedNewPlanId}
                onChange={(e) => setSelectedNewPlanId(e.target.value)}
                required
                className="w-full h-10 sm:h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id} className="bg-popover text-popover-foreground">
                    {p.name} — ₹{p.price.toLocaleString("en-IN")} ({p.durationDays} Days)
                  </option>
                ))}
              </select>
            </div>

            {/* Switch Plan Preview */}
            {selectedNewPlan && (
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border space-y-2 text-xs">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span>Plan Switch Preview</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      priceDifference > 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {priceDifference > 0
                      ? `+₹${priceDifference.toLocaleString("en-IN")} Upgrade`
                      : priceDifference < 0
                      ? `₹${Math.abs(priceDifference).toLocaleString("en-IN")} Difference`
                      : "Same Price"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">New Plan Price</span>
                    <span className="font-bold text-foreground">
                      ₹{selectedNewPlan.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Calculated Expiry</span>
                    <span className="font-bold text-foreground">
                      {formatDate(projectedNewPlanEndDate)}
                    </span>
                  </div>
                </div>

                {/* Ledger Invariant Callout */}
                <div className="pt-2 border-t border-border/80 text-[11px] text-muted-foreground">
                  ℹ️ <strong>Financial Guardrail:</strong> Switching plans updates contract validity. Any
                  unpaid plan balance remains on the member&apos;s ledger for the financial desk.
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Reason for Plan Change (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Member requested upgrade to Annual Pro"
                className="w-full h-10 px-3.5 bg-muted/40 border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="h-10 px-3.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedNewPlanId === membership.planId}
                className="flex items-center gap-1.5 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Confirm Plan Change</span>
              </button>
            </div>
          </form>
        )}

        {/* Section 3: Renewal & Financial Guardrails (Persistent Bottom Section) */}
        <div className="mt-5 pt-4 border-t border-border space-y-3">
          {/* A. Pending Dues Guardrail */}
          {membership.totalDue > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Pending Balance: ₹{membership.totalDue.toLocaleString("en-IN")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Direct cash settlement is locked in plan management to prevent unrecorded payments.
                </p>
              </div>
              <Link
                href={`/app/${gymId}/follow-ups?search=${encodeURIComponent(membership.memberName)}`}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>Go to Follow-Ups & Dues</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* B. Renewal Guardrail */}
          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Renewal Operations</span>
              {membership.status === "active" && daysLeft > 7 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  Locked ({daysLeft}d left)
                </span>
              )}
            </div>

            {membership.status === "active" && daysLeft > 7 && !allowEarlyRenew ? (
              <div className="text-[11px] text-muted-foreground space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>
                    Renewal unlocks when plan is within 7 days of expiry (currently {daysLeft}d left).
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={allowEarlyRenew}
                    onChange={(e) => setAllowEarlyRenew(e.target.checked)}
                    className="rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Override & Early Renew (Stack contract in advance)</span>
                </label>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <p className="text-[11px] text-muted-foreground">
                  Eligible for contract renewal and validity extension.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAssignModal?.(membership.memberId);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Proceed to Renew Plan</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
