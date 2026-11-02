"use client";

import { useState } from "react";
import { CreditCard, X, QrCode, Copy, Check, Loader2, CheckCircle2 } from "lucide-react";
import { submitMemberUpiPaymentAction } from "@/lib/actions/payments";

interface PayDuesModalProps {
  gymId: string;
  branchId: string;
  memberId: string;
  membershipId?: string | null;
  gymName: string;
  planName?: string;
  amount: number;
}

export function PayDuesModal({
  gymId,
  branchId,
  memberId,
  membershipId,
  gymName,
  planName,
  amount,
}: PayDuesModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [utrRef, setUtrRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In zero-cost development, generate UPI payment string
  const upiId = "gym@upi";
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(gymName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(planName ? `Renewal: ${planName}` : "Gym Dues")}`;

  function handleCopy() {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmitUpiClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await submitMemberUpiPaymentAction({
        gymId,
        branchId,
        memberId,
        membershipId: membershipId || null,
        amount,
        utrRef: utrRef.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to submit payment verification claim");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit payment claim";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setSubmitted(false);
    setUtrRef("");
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-10 sm:h-11 inline-flex items-center justify-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] w-full sm:w-auto"
      >
        <CreditCard className="w-4 h-4" />
        Pay / Clear Dues
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-border text-left">
              <div>
                <h3 className="text-sm font-bold text-card-foreground">Pay Membership Dues</h3>
                <p className="text-[11px] text-muted-foreground">{gymName}</p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="py-8 space-y-4">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-card-foreground">Payment Submitted!</h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed px-2">
                    Your UPI payment claim has been submitted for <span className="font-bold text-foreground">₹{amount.toFixed(2)}</span>.
                    It is now <span className="font-bold text-amber-500">Pending Verification</span> by the front-desk staff.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="my-5">
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Payable</div>
                  <div className="text-3xl font-black text-foreground mt-1">₹{amount.toFixed(2)}</div>
                  {planName && (
                    <div className="mt-2 inline-block px-3 py-1 bg-muted rounded-full text-[11px] font-bold text-foreground">
                      {planName}
                    </div>
                  )}
                </div>

                {/* UPI QR Display Card */}
                <div className="bg-muted/30 p-4 rounded-2xl border border-border mb-4">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-2">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-foreground">Direct UPI Payment</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Pay instantly with Google Pay, PhonePe, or Paytm
                  </div>

                  <div className="mt-3 flex items-center justify-between bg-card px-3 py-2 rounded-xl border border-border text-xs">
                    <span className="font-mono font-medium text-foreground">{upiId}</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary hover:opacity-80 transition-opacity"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy UPI ID"}
                    </button>
                  </div>

                  <a
                    href={upiLink}
                    className="mt-3 h-10 flex items-center justify-center w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98]"
                  >
                    Open UPI App on Phone
                  </a>
                </div>

                {/* Claim / UTR Form */}
                <form onSubmit={handleSubmitUpiClaim} className="text-left space-y-3 pt-2 border-t border-border">
                  <div>
                    <label className="block text-[11px] font-bold text-foreground uppercase mb-1">
                      Already paid? Submit UTR / Reference ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12-digit UPI UTR / Transaction ID"
                      value={utrRef}
                      onChange={(e) => setUtrRef(e.target.value)}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-[11px] text-destructive font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 bg-foreground text-background hover:opacity-90 disabled:opacity-50 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Payment for Verification</span>
                  </button>
                </form>

                <div className="text-[11px] text-muted-foreground leading-relaxed mt-3">
                  Submitted payments are recorded as pending until verified by front-desk staff.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}