"use client";

import { useState } from "react";
import { Receipt, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";

interface PortalPaymentItem {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
  notes?: string | null;
}

interface PortalPaymentsClientProps {
  gymName: string;
  branchName: string;
  memberName: string;
  memberPhone: string;
  planName?: string;
  payments: PortalPaymentItem[];
}

export function PortalPaymentsClient({
  gymName,
  branchName,
  memberName,
  memberPhone,
  planName,
  payments,
}: PortalPaymentsClientProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  function openReceipt(p: PortalPaymentItem) {
    setSelectedReceipt({
      id: p.id,
      gymName,
      branchName,
      memberName,
      memberPhone,
      planName: p.notes || planName || "Gym Membership Subscription",
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      paymentDate: p.paymentDate,
      notes: p.notes || undefined,
    });
  }

  return (
    <>
      <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-bold text-card-foreground">Payment Receipts</div>
          <div className="text-xs text-muted-foreground font-medium">{payments.length} transactions</div>
        </div>

        <div className="divide-y divide-border">
          {payments.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground font-medium">
              No payment receipts recorded yet.
            </div>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      Receipt #{p.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.paymentDate} &bull; <span className="uppercase font-semibold">{p.paymentMethod}</span>
                      {p.notes && ` &bull; ${p.notes}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-black text-foreground">
                      ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    {p.paymentStatus === "pending" ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
                        <Clock className="w-3 h-3" /> Pending Verification
                      </div>
                    ) : p.paymentStatus === "rejected" ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-wider">
                        <XCircle className="w-3 h-3" /> Claim Declined
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => openReceipt(p)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </>
  );
}