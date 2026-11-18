"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  X,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { bulkAssignMembershipsAction, SkippedBulkMember } from "@/lib/actions/memberships";
import { getTodayIST, calculateMembershipEndDate, formatDate } from "@/lib/utils";

export interface AssignableUnassignedMember {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
  branchName: string;
  createdAt?: string;
}

export interface PlanOptionItem {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  branchId: string;
  isActive: boolean;
}

interface BulkAssignModalProps {
  gymId: string;
  selectedMembers: AssignableUnassignedMember[];
  plans: PlanOptionItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignModal({
  gymId,
  selectedMembers,
  plans,
  isOpen,
  onClose,
  onSuccess,
}: BulkAssignModalProps) {
  // 1. All React Hooks declared strictly at the top of the component
  const router = useRouter();
  const [startDate, setStartDate] = useState<string>(getTodayIST());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedList, setSkippedList] = useState<SkippedBulkMember[]>([]);
  const [assignedCount, setAssignedCount] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  // Branch consistency check
  const firstBranchId = selectedMembers[0]?.branchId || "";
  const firstBranchName = selectedMembers[0]?.branchName || "Main Branch";

  const hasBranchMismatch = useMemo(() => {
    return selectedMembers.some((m) => m.branchId !== firstBranchId);
  }, [selectedMembers, firstBranchId]);

  // Filter plans strictly for this branch and active only
  const availablePlans = useMemo(() => {
    return plans.filter(
      (p) => p.isActive && (!p.branchId || p.branchId === firstBranchId)
    );
  }, [plans, firstBranchId]);

  // Sync selectedPlanId with availablePlans
  useEffect(() => {
    if (availablePlans.length > 0) {
      if (!selectedPlanId || !availablePlans.some((p) => p.id === selectedPlanId)) {
        setSelectedPlanId(availablePlans[0].id);
      }
    }
  }, [availablePlans, selectedPlanId]);

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSkippedList([]);
      setAssignedCount(null);
      setLoading(false);
      setStartDate(getTodayIST());
    }
  }, [isOpen]);

  // Selected plan calculation
  const selectedPlan = useMemo(() => {
    return availablePlans.find((p) => p.id === selectedPlanId) || availablePlans[0] || null;
  }, [availablePlans, selectedPlanId]);

  // Compute live expiry preview
  const todayIST = getTodayIST();
  const calculatedEndDate = useMemo(() => {
    return selectedPlan
      ? calculateMembershipEndDate(startDate, selectedPlan.durationDays)
      : "";
  }, [selectedPlan, startDate]);

  const isHistoricalExpired = calculatedEndDate ? calculatedEndDate < todayIST : false;

  // 2. Early return strictly AFTER all hooks have executed
  if (!isOpen) return null;

  function handleClose() {
    const shouldRefresh = assignedCount !== null && assignedCount > 0;
    setError(null);
    setSkippedList([]);
    setAssignedCount(null);
    onClose();
    if (shouldRefresh) {
      setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
      }, 150);
    }
  }

  async function handleAssign() {
    if (!selectedPlanId || !selectedPlan) {
      setError("Please select a valid membership plan");
      return;
    }

    if (hasBranchMismatch) {
      setError("Selected members belong to multiple branches. Please filter by one branch to assign plans.");
      return;
    }

    if (selectedMembers.length === 0) {
      setError("No members selected for assignment");
      return;
    }

    setLoading(true);
    setError(null);
    setSkippedList([]);

    let res;
    try {
      res = await bulkAssignMembershipsAction({
        gymId,
        branchId: firstBranchId,
        memberIds: selectedMembers.map((m) => m.id),
        planId: selectedPlanId,
        startDate,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign membership contracts");
      setLoading(false);
      return;
    }

    if (!res || !res.success) {
      setError(res?.error || "Failed to assign membership contracts");
      setLoading(false);
      return;
    }

    setLoading(false);
    setAssignedCount(res.assignedCount);
    setSkippedList(res.skippedMembers || []);
    if (res.assignedCount > 0) {
      try {
        onSuccess();
      } catch (e) {
        console.error("Post-assignment callback warning:", e);
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-assign-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleClose();
      }}
    >
      <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-border animate-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl border border-emerald-500/20">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 id="bulk-assign-title" className="text-sm sm:text-base font-bold text-foreground">
                Bulk Assign Membership Plan
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Assign contracts to {selectedMembers.length} selected member(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Completion Feedback */}
        {assignedCount !== null ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Assignment Complete</span>
              </div>
              <p className="text-xs mt-1 text-emerald-600 dark:text-emerald-400">
                Successfully assigned <strong>{assignedCount}</strong> membership contract(s) on{" "}
                <strong>{selectedPlan?.name}</strong>.
              </p>
            </div>

            {skippedList.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <div className="font-bold flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{skippedList.length} member(s) were skipped:</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {skippedList.map((s) => (
                    <div
                      key={s.memberId}
                      className="flex flex-col sm:flex-row sm:justify-between text-[11px] border-b border-amber-500/20 pb-1"
                    >
                      <span className="font-semibold text-foreground">{s.fullName}</span>
                      <span className="text-amber-600 dark:text-amber-400">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            {hasBranchMismatch ? (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The selected members belong to multiple branches. Please filter by a single branch to bulk assign plans.
                </span>
              </div>
            ) : availablePlans.length === 0 ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl text-xs">
                No active membership plans found for branch <strong>{firstBranchName}</strong>. Please create an active plan in the Plans tab first.
              </div>
            ) : (
              <>
                {/* Branch Context Tag */}
                <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-xl border border-border text-xs">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-muted-foreground">Branch Context:</span>
                  <span className="font-bold text-foreground">{firstBranchName}</span>
                </div>

                {/* Plan Selector */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Select Membership Plan *
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full h-10 sm:h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                  >
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id} className="bg-popover text-popover-foreground">
                        {p.name} — ₹{p.price.toLocaleString("en-IN")} ({p.durationDays} Days)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Contract Start Date *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full h-10 sm:h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Supports past dates for gym migration history or future dates.
                  </span>
                </div>

                {/* Live Expiry & Contract Preview Box */}
                {selectedPlan && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-muted/30 border border-border space-y-2.5">
                    <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Contract Preview</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isHistoricalExpired
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {isHistoricalExpired ? "Historical / Expired" : "Active Contract"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Target Members</div>
                        <div className="font-bold text-foreground">{selectedMembers.length} members</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Plan Duration</div>
                        <div className="font-bold text-foreground">{selectedPlan.durationDays} Days</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Plan Price</div>
                        <div className="font-bold text-foreground">₹{selectedPlan.price.toLocaleString("en-IN")}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Calculated End Date</div>
                        <div className="font-bold text-foreground">{formatDate(calculatedEndDate)}</div>
                      </div>
                    </div>

                    {/* Financial Invariant Notice */}
                    <div className="pt-2 border-t border-border flex items-start gap-2 text-[11px] text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Creates individual membership contracts with pending dues equal to plan price (₹
                        {selectedPlan.price.toLocaleString("en-IN")}). <strong>No payment records will be created.</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="h-10 sm:h-11 px-3.5 sm:px-4 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={loading || !selectedPlan || hasBranchMismatch}
                    className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    <span>Assign to {selectedMembers.length} Member(s)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
