"use client";

import { useState } from "react";
import { RefreshCw, X, Loader2, CheckCircle2, IndianRupee } from "lucide-react";
import { renewMembershipAction } from "@/lib/actions/members";
import { getTodayIST } from "@/lib/utils";

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
  const [startDate, setStartDate] = useState<string>(getTodayIST());
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Renew Membership</h3>
              <p className="text-xs text-muted-foreground">Extend plan for {memberName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Select Plan *</label>
            <select
              value={selectedPlanId}
              onChange={(e) => handlePlanChange(e.target.value)}
              required
              className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price} ({p.durationDays} days)
                </option>
              ))}
            </select>
          </div>

          {/* 3 Payment Presets */}
          {currentPlan && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Payment Status Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAmountPaid(currentPlan.price)}
                  className={`h-11 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                    amountPaid >= currentPlan.price
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-2xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Full Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.round((currentPlan.price / 2) * 100) / 100;
                    setAmountPaid(half > 0 ? half : 500);
                  }}
                  className={`h-11 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                    amountPaid > 0 && amountPaid < currentPlan.price
                      ? "bg-amber-500/10 border-amber-500 text-amber-600 shadow-2xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Partial Payment
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPaid(0)}
                  className={`h-11 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                    amountPaid === 0
                      ? "bg-primary/10 border-primary text-primary shadow-2xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Pay Later
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 px-3 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Amount Collected (₹)</label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="w-full h-11 pl-9 pr-3 bg-muted/40 border border-input rounded-xl text-sm font-bold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
            </div>
          </div>

          {currentPlan && amountPaid >= currentPlan.price ? (
            <div className="text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Full renewal payment received. Balance due: ₹0.00</span>
            </div>
          ) : currentPlan && amountPaid > 0 && amountPaid < currentPlan.price ? (
            <div className="text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Partial payment recorded: Remaining dues ₹{(currentPlan.price - amountPaid).toLocaleString("en-IN")}.</span>
            </div>
          ) : currentPlan && amountPaid === 0 ? (
            <div className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary shrink-0" />
              <span>Pay Later: Renewal active immediately. Full fee of ₹{currentPlan.price.toLocaleString("en-IN")} tracked as pending dues.</span>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "card"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`h-11 px-3 text-xs font-bold rounded-xl border transition-all uppercase cursor-pointer flex items-center justify-center ${
                    paymentMethod === method
                      ? "bg-primary/10 border-primary text-primary shadow-2xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Renewal Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Festival offer, renewed for 3 months"
              className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 h-11 px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl shadow-md shadow-primary/25 transition-all disabled:opacity-50 cursor-pointer"
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
