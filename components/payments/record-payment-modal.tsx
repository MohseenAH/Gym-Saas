"use client";

import { useState } from "react";
import { Plus, X, CreditCard, Loader2, MessageSquare, CheckCircle2 } from "lucide-react";
import { recordPaymentAction } from "@/lib/actions/payments";
import { getTodayIST } from "@/lib/utils";

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
  const [paymentDate, setPaymentDate] = useState<string>(getTodayIST());
  const [notes, setNotes] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

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
      paymentMethod: paymentMethod as "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other",
      paymentDate,
      notes: notes || null,
      paymentStatus: "paid",
      idempotencyKey,
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
        setIdempotencyKey(
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        );
      }
    }
  }

  function handleClose() {
    setIsOpen(false);
    setWaReceiptUrl(null);
    setAmount("");
    setNotes("");
    setIdempotencyKey(
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-10 sm:h-11 flex items-center justify-center gap-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] w-full sm:w-auto"
      >
        <Plus className="w-4 h-4" />
        Record Payment
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">Record Member Payment</h3>
                  <p className="text-xs text-muted-foreground">Collect fees and generate instant receipt</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                  <h4 className="text-base font-bold text-card-foreground">Payment Recorded Successfully!</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send the official digital receipt directly to {selectedMember?.fullName}&apos;s WhatsApp
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2.5">
                  <a
                    href={waReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 flex items-center justify-center gap-2 w-full px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Receipt via WhatsApp
                  </a>
                  <button
                    onClick={handleClose}
                    className="h-10 w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Select Member
                  </label>
                  {members.length === 0 ? (
                    <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 font-medium">
                      No members enrolled yet. Please add a member first.
                    </div>
                  ) : (
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
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
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Amount Collected (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full h-12 px-3.5 bg-background border border-border rounded-xl text-lg text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-black tracking-tight transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full h-12 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["cash", "upi", "card", "bank_transfer", "cheque", "other"].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`h-10 px-3 text-xs font-bold rounded-xl border capitalize transition-all ${
                          paymentMethod === method
                            ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20"
                            : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {method.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-Month Renewal, Personal Training Fee"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-11 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || members.length === 0}
                    className="h-11 flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
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