"use client";

import { useState } from "react";
import { CreditCard, X, QrCode, Copy, Check } from "lucide-react";

interface PayDuesModalProps {
  gymName: string;
  planName?: string;
  amount: number;
}

export function PayDuesModal({ gymName, planName, amount }: PayDuesModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // In zero-cost development, generate UPI payment string
  const upiId = "gym@upi";
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(gymName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(planName ? `Renewal: ${planName}` : "Gym Dues")}`;

  function handleCopy() {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
      >
        <CreditCard className="w-3.5 h-3.5" />
        Pay / Clear Dues
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-left">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pay Membership Dues</h3>
                <p className="text-[11px] text-slate-500">{gymName}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-5">
              <div className="text-xs text-slate-500 uppercase font-semibold">Total Payable</div>
              <div className="text-3xl font-black text-slate-900 mt-1">₹{amount.toFixed(2)}</div>
              {planName && (
                <div className="mt-1 inline-block px-2.5 py-0.5 bg-slate-100 rounded-md text-[11px] font-semibold text-slate-700">
                  {planName}
                </div>
              )}
            </div>

            {/* UPI QR Display Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-4">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mx-auto mb-2">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-900">Direct UPI Payment</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Pay instantly with Google Pay, PhonePe, or Paytm
              </div>

              <div className="mt-3 flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <span className="font-mono text-slate-700">{upiId}</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy UPI ID"}
                </button>
              </div>

              <a
                href={upiLink}
                className="mt-3 block w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Open UPI App on Phone
              </a>
            </div>

            <div className="text-[11px] text-slate-500 leading-relaxed">
              Once paid, your front-desk staff will verify and instantly update your active status in the system.
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
