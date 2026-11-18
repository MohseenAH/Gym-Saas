"use client";

import { useState, useMemo, startTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, IndianRupee, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";
import { assignMembershipAction } from "@/lib/actions/memberships";
import { getTodayIST, getISTDateString } from "@/lib/utils";

export interface AssignableMember {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
  branchName?: string;
}

export interface AssignablePlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  branchId: string;
  isActive: boolean;
}

interface AssignMembershipModalProps {
  gymId: string;
  members: AssignableMember[];
  plans: AssignablePlan[];
  initialMemberId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    memberName: string;
    planName: string;
    amountPaid: number;
    startDate: string;
    endDate: string;
  }) => void;
}

export function AssignMembershipModal({
  gymId,
  members,
  plans,
  initialMemberId,
  isOpen,
  onClose,
  onSuccess,
}: AssignMembershipModalProps) {
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || members[0]?.id || ""
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(getTodayIST());
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other"
  >("upi");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter members by search term
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const term = memberSearch.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(term) || m.phone.includes(term)
    );
  }, [members, memberSearch]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  // Available active plans (filtered by member's branch if member is selected)
  const availablePlans = useMemo(() => {
    return plans.filter((p) => {
      if (!p.isActive) return false;
      if (selectedMember && p.branchId !== selectedMember.branchId) {
        return false;
      }
      return true;
    });
  }, [plans, selectedMember]);

  // Set default plan when plans or member changes
  const effectivePlanId = selectedPlanId || availablePlans[0]?.id || "";
  const currentPlan = availablePlans.find((p) => p.id === effectivePlanId);

  // Compute calculated end date
  const calculatedEndDate = useMemo(() => {
    if (!currentPlan || !startDate) return "";
    try {
      const s = new Date(startDate);
      const e = new Date(s);
      e.setDate(e.getDate() + currentPlan.durationDays - 1);
      return getISTDateString(e);
    } catch {
      return "";
    }
  }, [startDate, currentPlan]);

  if (!isOpen) return null;

  function handleSelectPlan(planId: string) {
    setSelectedPlanId(planId);
    const plan = availablePlans.find((p) => p.id === planId);
    if (plan) {
      setAmountPaid(String(plan.price));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedMember) {
      setError("Please select a member to assign the membership to");
      return;
    }

    if (!currentPlan) {
      setError("Please select an active membership plan");
      return;
    }

    const numPaid = parseFloat(amountPaid) || 0;
    if (numPaid < 0) {
      setError("Amount paid cannot be negative");
      return;
    }

    setLoading(true);

    let res;
    try {
      res = await assignMembershipAction({
        gymId,
        branchId: selectedMember.branchId,
        memberId: selectedMember.id,
        planId: currentPlan.id,
        startDate,
        amountPaid: numPaid,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign membership");
      setLoading(false);
      return;
    }

    if (!res || !res.success) {
      setError(res?.error || "Failed to assign membership");
      setLoading(false);
      return;
    }

    setLoading(false);
    onClose();

    try {
      onSuccess?.({
        memberName: selectedMember.fullName,
        planName: currentPlan.name,
        amountPaid: numPaid,
        startDate: res.startDate!,
        endDate: res.endDate!,
      });
    } catch (e) {
      console.error("Post-assign callback warning:", e);
    }

    setTimeout(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 200);
  }

  const numPaid = parseFloat(amountPaid) || 0;
  const isPartial = currentPlan && numPaid < currentPlan.price;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Assign Membership Plan</h3>
              <p className="text-xs text-muted-foreground">Create a contract and schedule validity for a member</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Select Member *
            </label>
            {members.length > 5 && (
              <input
                type="text"
                placeholder="Search member by name or phone..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full mb-2 px-3 py-1.5 bg-muted/40 border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            )}
            <select
              value={selectedMemberId}
              onChange={(e) => {
                setSelectedMemberId(e.target.value);
                setSelectedPlanId(""); // Reset plan when member changes
              }}
              required
              className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            >
              {filteredMembers.map((m) => (
                <option key={m.id} value={m.id} className="bg-popover text-popover-foreground">
                  {m.fullName} ({m.phone}) {m.branchName ? `• ${m.branchName}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Plan Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Membership Plan *
            </label>
            {availablePlans.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>No active membership plans available for this member&apos;s branch. Please create a plan first.</span>
              </div>
            ) : (
              <select
                value={effectivePlanId}
                onChange={(e) => handleSelectPlan(e.target.value)}
                required
                className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              >
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id} className="bg-popover text-popover-foreground">
                    {p.name} — ₹{p.price.toLocaleString("en-IN")} ({p.durationDays} days)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Validity Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Start Date *
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Computed End Date
              </label>
              <div className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm text-foreground font-semibold">
                {calculatedEndDate || "—"}
              </div>
            </div>
          </div>

          {/* Financials & Payment Collection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Amount Collected (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={currentPlan ? String(currentPlan.price) : "0.00"}
                  className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Payment Method
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
                className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 capitalize cursor-pointer"
              >
                <option value="upi" className="bg-popover text-popover-foreground">UPI / GPay / PhonePe</option>
                <option value="cash" className="bg-popover text-popover-foreground">Cash</option>
                <option value="card" className="bg-popover text-popover-foreground">Card</option>
                <option value="bank_transfer" className="bg-popover text-popover-foreground">Bank Transfer</option>
                <option value="cheque" className="bg-popover text-popover-foreground">Cheque</option>
              </select>
            </div>
          </div>

          {/* Partial payment alert */}
          {isPartial && (
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
              ⚠️ Partial payment: Remaining balance of ₹{(currentPlan.price - numPaid).toLocaleString("en-IN")} will be tracked as outstanding dues.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Contract Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Enrolled during anniversary promotion"
              className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || availablePlans.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Confirm Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
