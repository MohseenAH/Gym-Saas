"use client";

import { useState } from "react";
import { Receipt, X, Printer, Share2, Check, Dumbbell } from "lucide-react";

export interface ReceiptData {
  id: string;
  gymName: string;
  branchName: string;
  gymPhone?: string;
  memberName: string;
  memberPhone: string;
  memberEmail?: string;
  planName?: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
  notes?: string;
  outstandingDues?: number;
}

interface ReceiptModalProps {
  receipt: ReceiptData;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptModal({ receipt, isOpen, onClose }: ReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const cleanPhone = receipt.memberPhone.replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waShareUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `🧾 *${receipt.gymName} — Payment Receipt*\n\n` +
      `Receipt No: #${receipt.id.slice(0, 8).toUpperCase()}\n` +
      `Date: ${receipt.paymentDate}\n` +
      `Member: ${receipt.memberName}\n` +
      `Item: ${receipt.planName || "Membership Fee"}\n` +
      `Amount Paid: ₹${receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
      `Payment Mode: ${receipt.paymentMethod.toUpperCase()}\n` +
      `Status: ${receipt.paymentStatus.toUpperCase()}\n` +
      (receipt.outstandingDues && receipt.outstandingDues > 0
        ? `Remaining Dues: ₹${receipt.outstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`
        : "") +
      `\nThank you for choosing ${receipt.gymName}! 💪`
  )}`;

  function handlePrint() {
    window.print();
  }

  function handleCopyDetails() {
    const text =
      `Receipt #${receipt.id.slice(0, 8).toUpperCase()}\n` +
      `Gym: ${receipt.gymName} (${receipt.branchName})\n` +
      `Member: ${receipt.memberName}\n` +
      `Amount: ₹${receipt.amount} (${receipt.paymentMethod.toUpperCase()})\n` +
      `Date: ${receipt.paymentDate}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Receipt className="w-4 h-4 text-indigo-600" />
            Official Payment Receipt
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div id="printable-receipt" className="p-6 text-slate-800 bg-white space-y-5">
          {/* Gym Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-200">
            <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-2 shadow-xs">
              <Dumbbell className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {receipt.gymName}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {receipt.branchName} {receipt.gymPhone ? `• Ph: ${receipt.gymPhone}` : ""}
            </p>
            <div className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider">
              {receipt.paymentStatus === "paid" ? "Payment Received" : "Partial Payment"}
            </div>
          </div>

          {/* Receipt Metadata */}
          <div className="grid grid-cols-2 text-xs gap-3">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Receipt No.</div>
              <div className="font-mono font-bold text-slate-900">
                #{receipt.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Payment Date</div>
              <div className="font-bold text-slate-900">{receipt.paymentDate}</div>
            </div>
          </div>

          {/* Member Details */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Billed To</div>
            <div className="font-bold text-slate-900">{receipt.memberName}</div>
            <div className="text-slate-500">{receipt.memberPhone}</div>
            {receipt.memberEmail && <div className="text-slate-400">{receipt.memberEmail}</div>}
          </div>

          {/* Itemized Line */}
          <div className="border-t border-b border-slate-100 py-3 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>{receipt.planName || "Gym Membership Subscription"}</span>
              <span>₹{receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            {receipt.notes && (
              <p className="text-[11px] text-slate-400 italic">{receipt.notes}</p>
            )}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-50">
              <span>Payment Mode</span>
              <span className="uppercase font-semibold text-slate-700">
                {receipt.paymentMethod}
              </span>
            </div>
          </div>

          {/* Total Box */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-base font-black text-slate-900">
              <span>Amount Paid</span>
              <span className="text-emerald-600">
                ₹{receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {receipt.outstandingDues !== undefined && receipt.outstandingDues > 0 && (
              <div className="flex items-center justify-between text-xs font-bold text-amber-600">
                <span>Remaining Balance</span>
                <span>
                  ₹{receipt.outstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center pt-3 border-t border-dashed border-slate-200 text-[10px] text-slate-400">
            Computer-generated gym receipt &bull; Thank you for training at {receipt.gymName}!
          </div>
        </div>

        {/* Modal Sharing Actions (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 print:hidden">
          <a
            href={waShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            Send on WhatsApp
          </a>
          <button
            onClick={handleCopyDetails}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
