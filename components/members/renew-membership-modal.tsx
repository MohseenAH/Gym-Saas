"use client";

import { useState } from "react";
import { RefreshCw, X, Loader2, CheckCircle2, IndianRupee } from "lucide-react";
import { renewMembershipAction } from "@/lib/actions/members";

export interface MembershipPlanOption {
  id: string;
  name: string;
  price: number;
  durationDays: number;
}

interface RenewMembershipModalProps {
  gymId: string;
  branchId: string;
  memberId: string;
  memberName: string;
  plans: MembershipPlanOption[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    membershipId: string;
    paymentId?: string | null;
    planName: string;
    startDate: string;
    endDate: string;
    amountPaid: number;
    paymentMethod: string;
  }) => void;
}

export function RenewMembershipModal({
  gymId,
  branchId,
  memberId,
  memberName,
  plans,
  isOpen,
  onClose,
  onSuccess,
}: RenewMembershipModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || "");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [amountPaid, setAmountPaid] = useState<number>(plans[0]?.price || 0);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other"
  >("upi");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPlan = plans.find((p) => p.id === selectedPlanId);

  function handlePlanChange(planId: string) {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setAmountPaid(plan.price);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPlanId) {
      setError("Please select a membership plan");
      return;
    }

    setLoading(true);
    const res = await renewMembershipAction({
      gymId,
      branchId,
      memberId,
      planId: selectedPlanId,
      startDate,
      amountPaid: Number(amountPaid) || 0,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to renew membership");
    } else {
      onSuccess?.({
        membershipId: res.membershipId!,
        paymentId: res.paymentId,
        planName: res.planName!,
        startDate: res.startDate!,
        endDate: res.endDate!,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod,
      });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Renew Membership</h3>
              <p className="text-xs text-slate-500">Extend plan for {memberName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Plan *</label>
            <select
              value={selectedPlanId}
              onChange={(e) => handlePlanChange(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price} ({p.durationDays} days)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Collected (₹)</label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {currentPlan && amountPaid < currentPlan.price && (
            <div className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 rounded-xl p-2.5">
              ⚠️ Partial payment detected: Remaining dues ₹{currentPlan.price - amountPaid} will be logged.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "card"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-colors uppercase ${
                    paymentMethod === method
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Renewal Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Festival offer, renewed for 3 months"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

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
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirm Renewal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
