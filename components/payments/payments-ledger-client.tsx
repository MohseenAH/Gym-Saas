"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  MessageSquare,
  FileText,
  CreditCard,
  IndianRupee,
  Building,
} from "lucide-react";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";

export interface PaymentLedgerItem {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  memberEmail?: string | null;
  branchName: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
  notes?: string | null;
}

interface PaymentsLedgerClientProps {
  gymId: string;
  gymName: string;
  payments: PaymentLedgerItem[];
}

export function PaymentsLedgerClient({
  gymId,
  gymName,
  payments,
}: PaymentsLedgerClientProps) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter !== "all" && p.paymentMethod !== methodFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.memberName.toLowerCase().includes(q) ||
        p.memberPhone.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    });
  }, [payments, search, methodFilter]);

  function handleOpenReceipt(p: PaymentLedgerItem) {
    setSelectedReceipt({
      id: p.id,
      gymName,
      branchName: p.branchName,
      memberName: p.memberName,
      memberPhone: p.memberPhone,
      memberEmail: p.memberEmail || undefined,
      planName: p.notes || "Gym Membership / Subscription Fee",
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      paymentDate: p.paymentDate,
      notes: p.notes || undefined,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by member, phone, receipt #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        {/* Method Filter */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-xl text-xs">
          {["all", "upi", "cash", "card"].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1 rounded-lg font-bold capitalize transition-colors ${
                methodFilter === m
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3.5 pl-4">Receipt Ref</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Member</th>
              <th className="p-3.5">Branch</th>
              <th className="p-3.5">Method</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Notes</th>
              <th className="p-3.5 text-right">Amount (₹)</th>
              <th className="p-3.5 pr-4 text-right">Receipt Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  No payment transactions found.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => {
                const cleanPhone = p.memberPhone.replace(/\D/g, "");
                const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `🧾 *${gymName} — Payment Receipt*\n\n` +
                    `Receipt No: #${p.id.slice(0, 8).toUpperCase()}\n` +
                    `Date: ${p.paymentDate}\n` +
                    `Member: ${p.memberName}\n` +
                    `Amount: ₹${p.amount.toFixed(2)} (${p.paymentMethod.toUpperCase()})\n` +
                    `Status: ${p.paymentStatus.toUpperCase()}\n\n` +
                    `Thank you for training with us! 💪`
                )}`;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 font-mono font-bold text-slate-900">
                      #{p.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">
                      {p.paymentDate}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                      <Link
                        href={`/app/${gymId}/members/${p.memberId}`}
                        className="hover:text-indigo-600 transition-colors"
                      >
                        {p.memberName}
                      </Link>
                      <div className="text-[11px] font-normal text-slate-400">
                        {p.memberPhone}
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-600">
                      {p.branchName}
                    </td>
                    <td className="p-3.5 uppercase font-semibold text-slate-700">
                      {p.paymentMethod}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-md font-bold text-[11px] uppercase">
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3.5 max-w-xs truncate text-slate-500">
                      {p.notes || "—"}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenReceipt(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                          title="Share Receipt on WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
        <div>Showing {filteredPayments.length} of {payments.length} transactions</div>
      </div>

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
