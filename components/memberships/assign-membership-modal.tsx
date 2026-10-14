"use client";

import { useState, useMemo } from "react";
import { UserPlus, X, Loader2, IndianRupee, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";
import { assignMembershipAction } from "@/lib/actions/memberships";

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
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || members[0]?.id || ""
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
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
      return e.toISOString().split("T")[0];
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

    const res = await assignMembershipAction({
      gymId,
      branchId: selectedMember.branchId,
      memberId: selectedMember.id,
      planId: currentPlan.id,
      startDate,
      amountPaid: numPaid,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to assign membership");
    } else {
      onSuccess?.({
        memberName: selectedMember.fullName,
        planName: currentPlan.name,
        amountPaid: numPaid,
        startDate: res.startDate!,
        endDate: res.endDate!,
      });
      onClose();
    }
  }

  const numPaid = parseFloat(amountPaid) || 0;
  const isPartial = currentPlan && numPaid < currentPlan.price;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign Membership Plan</h3>
              <p className="text-xs text-slate-500">Create a contract and schedule validity for a member</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Member Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Member *
            </label>
            {members.length > 5 && (
              <input
                type="text"
                placeholder="Search member by name or phone..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full mb-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            )}
            <select
              value={selectedMemberId}
              onChange={(e) => {
                setSelectedMemberId(e.target.value);
                setSelectedPlanId(""); // Reset plan when member changes
              }}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {filteredMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.phone}) {m.branchName ? `• ${m.branchName}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Plan Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Membership Plan *
            </label>
            {availablePlans.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>No active membership plans available for this member&apos;s branch. Please create a plan first.</span>
              </div>
            ) : (
              <select
                value={effectivePlanId}
                onChange={(e) => handleSelectPlan(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.price.toLocaleString("en-IN")} ({p.durationDays} days)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Validity Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date *
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Computed End Date
              </label>
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium">
                {calculatedEndDate || "—"}
              </div>
            </div>
          </div>

          {/* Financials & Payment Collection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Collected (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={currentPlan ? String(currentPlan.price) : "0.00"}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="upi">UPI / GPay / PhonePe</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Partial payment alert */}
          {isPartial && (
            <div className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl p-2.5">
              ⚠️ Partial payment: Remaining balance of ₹{(currentPlan.price - numPaid).toLocaleString("en-IN")} will be tracked as outstanding dues.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contract Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Enrolled during anniversary promotion"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || availablePlans.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
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
