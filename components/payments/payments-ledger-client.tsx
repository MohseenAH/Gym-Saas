"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  FileText,
  Download,
  Check,
  Loader2,
  Clock,
  Filter,
} from "lucide-react";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";
import { verifyPaymentAction } from "@/lib/actions/payments";
import { getTodayIST } from "@/lib/utils";

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
  payments: initialPayments,
}: PaymentsLedgerClientProps) {
  const router = useRouter();
  const [paymentsList, setPaymentsList] = useState<PaymentLedgerItem[]>(initialPayments);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync if initialPayments props change
  useMemo(() => {
    setPaymentsList(initialPayments);
  }, [initialPayments]);

  const filteredPayments = useMemo(() => {
    return paymentsList.filter((p) => {
      if (methodFilter !== "all" && p.paymentMethod !== methodFilter) {
        return false;
      }
      if (statusFilter !== "all" && p.paymentStatus !== statusFilter) {
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
  }, [paymentsList, search, methodFilter, statusFilter]);

  async function handleVerifyPayment(paymentId: string) {
    setVerifyingId(paymentId);
    setActionMessage(null);

    try {
      const res = await verifyPaymentAction({ gymId, paymentId });
      if (!res.success) {
        setActionMessage({ type: "error", text: res.error || "Failed to verify payment" });
        setVerifyingId(null);
        return;
      }

      // Optimistic local state update
      setPaymentsList((prev) =>
        prev.map((item) =>
          item.id === paymentId ? { ...item, paymentStatus: "paid" } : item
        )
      );
      setActionMessage({ type: "success", text: "Payment verified and recorded as paid!" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error verifying payment";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setVerifyingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  }

  function handleExportCsv() {
    const headers = [
      "Receipt Ref",
      "Payment ID",
      "Date",
      "Member Name",
      "Member Phone",
      "Branch",
      "Method",
      "Amount (INR)",
      "Status",
      "Notes",
    ];

    const rows = filteredPayments.map((p) => [
      `#${p.id.slice(0, 8).toUpperCase()}`,
      p.id,
      p.paymentDate,
      p.memberName,
      p.memberPhone,
      p.branchName,
      p.paymentMethod.toUpperCase(),
      p.amount.toFixed(2),
      p.paymentStatus.toUpperCase(),
      p.notes || "",
    ]);

    const escapeCell = (cell: string | number | null | undefined): string => {
      if (cell === null || cell === undefined) return '""';
      const str = String(cell);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headerLine = headers.map(escapeCell).join(",");
    const rowLines = rows.map((r) => r.map(escapeCell).join(","));
    const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cleanGym = gymName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `${cleanGym}_payments_${getTodayIST()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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

  const pendingCount = paymentsList.filter((p) => p.paymentStatus === "pending").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {actionMessage && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            &times;
          </button>
        </div>
      )}

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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                statusFilter === "paid"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Paid
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-colors ${
                statusFilter === "pending"
                  ? "bg-white text-amber-700 shadow-2xs"
                  : "text-slate-600 hover:text-amber-700"
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Method Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
            {["all", "upi", "cash", "card"].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-colors ${
                  methodFilter === m
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={filteredPayments.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Export filtered transactions as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
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
                    <td className="p-3.5 whitespace-nowrap">
                      {p.paymentStatus === "pending" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[11px] uppercase">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-md font-bold text-[11px] uppercase">
                          {p.paymentStatus}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 max-w-xs truncate text-slate-500">
                      {p.notes || "—"}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.paymentStatus === "pending" && (
                          <button
                            onClick={() => handleVerifyPayment(p.id)}
                            disabled={verifyingId === p.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors"
                            title="Verify and approve this pending payment"
                          >
                            {verifyingId === p.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Approve</span>
                          </button>
                        )}
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
        <div>Showing {filteredPayments.length} of {paymentsList.length} transactions</div>
        {pendingCount > 0 && (
          <div className="text-amber-700 font-semibold text-[11px] flex items-center gap-1">
            <Clock className="w-3 h-3" /> {pendingCount} payment(s) awaiting verification
          </div>
        )}
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
