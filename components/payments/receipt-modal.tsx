"use client";

import { useState } from "react";
import { Receipt, X, Printer, Share2, Check, Dumbbell } from "lucide-react";
import { formatDate, getISTDateString } from "@/lib/utils";

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

  const istDateStr = getISTDateString(receipt.paymentDate);
  const formattedDate = formatDate(receipt.paymentDate);

  const cleanPhone = receipt.memberPhone.replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const duesText =
    receipt.outstandingDues !== undefined && receipt.outstandingDues > 0
      ? `Remaining Dues: ₹${receipt.outstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`
      : "Remaining Dues: ₹0.00 (Cleared)\n";

  const waShareUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `🧾 *${receipt.gymName} — Official Payment Receipt*\n\n` +
      `Receipt No: #${receipt.id.slice(0, 8).toUpperCase()}\n` +
      `Date: ${formattedDate} (${istDateStr})\n` +
      `Member: ${receipt.memberName}\n` +
      `Phone: ${receipt.memberPhone}\n` +
      `Branch: ${receipt.branchName}\n` +
      `Item: ${receipt.planName || "Membership Fee"}\n` +
      `Amount Paid: ₹${receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
      `Payment Mode: ${receipt.paymentMethod.toUpperCase()}\n` +
      `Status: ${receipt.paymentStatus.toUpperCase()}\n` +
      duesText +
      `\nThank you for choosing ${receipt.gymName}! 💪`
  )}`;

  function handlePrint() {
    window.print();
  }

  function handleCopyDetails() {
    const text =
      `Receipt #${receipt.id.slice(0, 8).toUpperCase()}\n` +
      `Gym: ${receipt.gymName} (${receipt.branchName})\n` +
      `Member: ${receipt.memberName} (${receipt.memberPhone})\n` +
      `Amount: ₹${receipt.amount} (${receipt.paymentMethod.toUpperCase()})\n` +
      `Date: ${formattedDate} (${istDateStr})\n` +
      `Status: ${receipt.paymentStatus.toUpperCase()}` +
      (receipt.outstandingDues !== undefined ? `\nRemaining Dues: ₹${receipt.outstandingDues}` : "");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between p-4 bg-muted/30 border-b border-border print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Receipt className="w-4 h-4 text-primary" />
            Official Payment Receipt
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div id="printable-receipt" className="p-6 text-card-foreground bg-card print:bg-white print:text-black space-y-5">
          {/* Gym Header */}
          <div className="text-center pb-4 border-b border-dashed border-border print:border-slate-300">
            <div className="w-11 h-11 mx-auto rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-2 shadow-xs">
              <Dumbbell className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-foreground print:text-black tracking-tight">
              {receipt.gymName}
            </h2>
            <p className="text-xs text-muted-foreground print:text-slate-600 font-medium">
              {receipt.branchName} {receipt.gymPhone ? `• Ph: ${receipt.gymPhone}` : ""}
            </p>
            <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wider">
              {receipt.paymentStatus === "paid" ? "Payment Received" : `${receipt.paymentStatus} Payment`}
            </div>
          </div>

          {/* Receipt Metadata */}
          <div className="grid grid-cols-2 text-xs gap-3">
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Receipt No.</div>
              <div className="font-mono font-bold text-foreground print:text-black">
                #{receipt.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Payment Date (IST)</div>
              <div className="font-bold text-foreground print:text-black">{formattedDate}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{istDateStr}</div>
            </div>
          </div>

          {/* Member Details */}
          <div className="p-3.5 bg-muted/40 print:bg-slate-50 rounded-2xl border border-border print:border-slate-200 text-xs">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Billed To</div>
            <div className="font-bold text-foreground print:text-black">{receipt.memberName}</div>
            <div className="text-muted-foreground print:text-slate-700 font-medium">{receipt.memberPhone}</div>
            <div className="text-muted-foreground text-[11px] mt-0.5">Branch: {receipt.branchName}</div>
            {receipt.memberEmail && <div className="text-muted-foreground">{receipt.memberEmail}</div>}
          </div>

          {/* Itemized Line */}
          <div className="border-t border-b border-border print:border-slate-200 py-3 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-foreground print:text-black">
              <span>{receipt.planName || "Gym Membership Subscription"}</span>
              <span>₹{receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            {receipt.notes && (
              <p className="text-[11px] text-muted-foreground print:text-slate-600 italic">{receipt.notes}</p>
            )}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border print:border-slate-100">
              <span>Payment Mode</span>
              <span className="uppercase font-semibold text-foreground print:text-black">
                {receipt.paymentMethod}
              </span>
            </div>
          </div>

          {/* Total & Outstanding Box */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-base font-black text-foreground print:text-black">
              <span>Amount Paid</span>
              <span className="text-emerald-500 font-black">
                ₹{receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {receipt.outstandingDues !== undefined && (
              <div
                className={`flex items-center justify-between text-xs font-bold ${
                  receipt.outstandingDues > 0 ? "text-amber-500" : "text-emerald-500"
                }`}
              >
                <span>Remaining Dues</span>
                <span>
                  {receipt.outstandingDues > 0
                    ? `₹${receipt.outstandingDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : "₹0.00 (Cleared)"}
                </span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center pt-3 border-t border-dashed border-border print:border-slate-300 text-[10px] text-muted-foreground">
            Computer-generated gym receipt &bull; Thank you for training at {receipt.gymName}!
          </div>
        </div>

        {/* Modal Sharing Actions (Hidden in Print) */}
        <div className="p-4 bg-muted/30 border-t border-border flex items-center gap-2 print:hidden">
          <a
            href={waShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 flex-1 inline-flex items-center justify-center gap-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            Send on WhatsApp
          </a>
          <button
            onClick={handleCopyDetails}
            className="h-11 px-4 bg-card border border-border hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}