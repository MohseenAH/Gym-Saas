"use client";

import { useState } from "react";
import { Plus, X, CreditCard, Loader2, MessageSquare, CheckCircle2 } from "lucide-react";
import { recordPaymentAction } from "@/lib/actions/payments";

interface RecordPaymentModalProps {
  gymId: string;
  branches: { id: string; name: string }[];
  members: { id: string; fullName: string; phone: string; branchId: string }[];
}

export function RecordPaymentModal({ gymId, branches, members }: RecordPaymentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waReceiptUrl, setWaReceiptUrl] = useState<string | null>(null);

  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");

  const selectedMember = members.find((m) => m.id === memberId);
  const branchId = selectedMember?.branchId || branches[0]?.id || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWaReceiptUrl(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    if (!memberId) {
      setError("Please select a gym member");
      return;
    }

    setLoading(true);
    const res = await recordPaymentAction({
      gymId,
      branchId,
      memberId,
      amount: numAmount,
      paymentMethod: paymentMethod as any,
      paymentDate,
      notes: notes || null,
      paymentStatus: "paid",
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to record payment");
    } else {
      if (res.receiptUrl) {
        setWaReceiptUrl(res.receiptUrl);
      } else {
        setIsOpen(false);
        setAmount("");
        setNotes("");
      }
    }
  }

  function handleClose() {
    setIsOpen(false);
    setWaReceiptUrl(null);
    setAmount("");
    setNotes("");
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
      >
        <Plus className="w-4 h-4" />
        Record Payment
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Member Payment</h3>
                  <p className="text-xs text-slate-500">Collect fees and generate instant receipt</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {waReceiptUrl ? (
              <div className="mt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Payment Recorded Successfully!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Send the official digital receipt directly to {selectedMember?.fullName}&apos;s WhatsApp
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <a
                    href={waReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Receipt via WhatsApp
                  </a>
                  <button
                    onClick={handleClose}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Member
                  </label>
                  {members.length === 0 ? (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      No members enrolled yet. Please add a member first.
                    </div>
                  ) : (
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName} ({m.phone})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount Collected (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["cash", "upi", "card", "bank_transfer", "cheque", "other"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border capitalize transition-all ${
                          paymentMethod === method
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {method.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-Month Renewal, Personal Training Fee"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || members.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm & Record Payment
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
