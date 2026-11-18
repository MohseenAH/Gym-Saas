"use client";

import { useState, useEffect } from "react";
import { X, Loader2, IndianRupee, CreditCard, Banknote, QrCode, AlertCircle, CheckCircle2 } from "lucide-react";
import { MembershipItem } from "./memberships-client";
import { recordPaymentAction } from "@/lib/actions/payments";
import { getTodayIST } from "@/lib/utils";

interface CollectDueModalProps {
  gymId: string;
  membership: MembershipItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amountCollected: number, memberName: string) => void;
}

export function CollectDueModal({
  gymId,
  membership,
  isOpen,
  onClose,
  onSuccess,
}: CollectDueModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "bank_transfer">("cash");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (membership) {
      setAmount(membership.totalDue > 0 ? membership.totalDue.toString() : "");
      setNotes(`Due collection for ${membership.planName}`);
      setError(null);
    }
  }, [membership]);

  if (!isOpen || !membership) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!membership) return;
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (parsedAmount > membership.totalDue) {
      setError(`Amount cannot exceed the total due of ₹${membership.totalDue.toLocaleString("en-IN")}`);
      return;
    }

    setLoading(true);
    try {
      const isFull = parsedAmount >= membership.totalDue;
      const res = await recordPaymentAction({
        gymId,
        branchId: membership.branchId,
        memberId: membership.memberId,
        membershipId: membership.id,
        amount: parsedAmount,
        paymentMethod,
        paymentStatus: isFull ? "paid" : "partial",
        paymentDate: getTodayIST(),
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to record payment");
        setLoading(false);
        return;
      }

      onSuccess(parsedAmount, membership.memberName);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="collect-due-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h2 id="collect-due-title" className="text-lg font-bold text-slate-900 leading-tight">
                Collect Outstanding Due
              </h2>
              <p className="text-xs text-slate-500">
                {membership.memberName} · {membership.planName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dues Summary Banner */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Total Pending Due
              </div>
              <div className="text-xl font-bold text-amber-900 tabular-nums">
                ₹{membership.totalDue.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="text-right text-xs text-amber-700 font-medium">
              <div>Plan Price: ₹{membership.planPrice.toLocaleString("en-IN")}</div>
              <div>Already Paid: ₹{membership.totalPaid.toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* Amount to Collect */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Amount to Collect (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="1"
                max={membership.totalDue}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={membership.totalDue.toString()}
                className="w-full pl-8 pr-4 py-2 text-base font-bold bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-slate-900 placeholder:text-slate-400 tabular-nums"
              />
            </div>
            {parseFloat(amount) < membership.totalDue && parseFloat(amount) > 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                Partial payment: ₹{(membership.totalDue - parseFloat(amount)).toLocaleString("en-IN")} will remain pending.
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === "cash"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Banknote className="w-4 h-4 mb-1" />
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === "upi"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <QrCode className="w-4 h-4 mb-1" />
                UPI
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === "card"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CreditCard className="w-4 h-4 mb-1" />
                Card
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared pending quarterly fee"
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Collection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
