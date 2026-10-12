"use client";

import { useState } from "react";
import { Receipt, CheckCircle2, FileText, Printer } from "lucide-react";
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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">Payment Receipts</div>
          <div className="text-xs text-slate-400">{payments.length} transactions</div>
        </div>

        <div className="divide-y divide-slate-100">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No payment receipts recorded yet.
            </div>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Receipt #{p.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.paymentDate} &bull; <span className="uppercase">{p.paymentMethod}</span>
                      {p.notes && ` &bull; ${p.notes}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">
                      ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> Paid
                    </div>
                  </div>
                  <button
                    onClick={() => openReceipt(p)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
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
