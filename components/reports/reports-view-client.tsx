"use client";

import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  TrendingUp,
  CreditCard,
  CalendarCheck,
  Users,
  IndianRupee,
  Layers,
  Clock,
  MessageSquare,
  Building,
  Filter,
} from "lucide-react";

export interface ReportPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
  memberName: string;
  memberPhone: string;
  branchId: string;
  branchName: string;
}

export interface ReportExpense {
  id: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod: string;
  description?: string | null;
  branchId: string;
  branchName: string;
}

export interface ReportAttendance {
  id: string;
  checkInDate: string;
  checkInTime: string;
  memberName: string;
  branchId: string;
  branchName: string;
}

export interface ReportMembership {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  planName: string;
  planPrice: number;
  startDate: string;
  endDate: string;
  status: string;
  branchId: string;
  branchName: string;
  paidAmount: number;
  dueAmount: number;
  daysLeft: number;
}

interface ReportsViewClientProps {
  gymId: string;
  gymName: string;
  branches: { id: string; name: string }[];
  payments: ReportPayment[];
  expenses: ReportExpense[];
  attendance: ReportAttendance[];
  memberships: ReportMembership[];
}

export function ReportsViewClient({
  gymId,
  gymName,
  branches,
  payments,
  expenses,
  attendance,
  memberships,
}: ReportsViewClientProps) {
  const [reportType, setReportType] = useState<
    "collections" | "attendance" | "memberships" | "dues" | "pnl"
  >("collections");
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "all">("30days");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const todayStr = new Date().toISOString().split("T")[0];

  function filterByDate(dateStr: string) {
    if (dateRange === "all") return true;
    if (dateRange === "today") return dateStr === todayStr;

    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (dateRange === "7days") return diffDays <= 7;
    if (dateRange === "30days") return diffDays <= 30;
    return true;
  }

  // Filtered datasets
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedBranchId !== "all" && p.branchId !== selectedBranchId) return false;
      return filterByDate(p.paymentDate);
    });
  }, [payments, selectedBranchId, dateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedBranchId !== "all" && e.branchId !== selectedBranchId) return false;
      return filterByDate(e.expenseDate);
    });
  }, [expenses, selectedBranchId, dateRange]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (selectedBranchId !== "all" && a.branchId !== selectedBranchId) return false;
      return filterByDate(a.checkInDate);
    });
  }, [attendance, selectedBranchId, dateRange]);

  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      if (selectedBranchId !== "all" && m.branchId !== selectedBranchId) return false;
      return true; // Memberships reflect current / active lifecycle
    });
  }, [memberships, selectedBranchId]);

  // Aggregated calculations
  const totalCollections = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  const upiCollections = filteredPayments
    .filter((p) => p.paymentMethod === "upi")
    .reduce((acc, p) => acc + p.amount, 0);
  const cashCollections = filteredPayments
    .filter((p) => p.paymentMethod === "cash")
    .reduce((acc, p) => acc + p.amount, 0);
  const cardCollections = filteredPayments
    .filter((p) => p.paymentMethod === "card")
    .reduce((acc, p) => acc + p.amount, 0);

  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netCashFlow = totalCollections - totalExpenses;

  const totalDues = filteredMemberships.reduce((acc, m) => acc + m.dueAmount, 0);
  const duesList = filteredMemberships.filter((m) => m.dueAmount > 0);

  const activeMembershipsCount = filteredMemberships.filter((m) => m.status === "active").length;
  const expiringSoonCount = filteredMemberships.filter(
    (m) => m.status === "active" && m.daysLeft >= 0 && m.daysLeft <= 7
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Business & Financial Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciled collections, member dues, attendance volume, and operational cash movement
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "7days", label: "7 Days" },
                { id: "30days", label: "30 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateRange(opt.id)}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  dateRange === opt.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Branch filter */}
          {branches.length > 1 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent focus:outline-hidden font-bold text-slate-900"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {(
          [
            { id: "collections", label: "Collections & Revenue", icon: TrendingUp },
            { id: "dues", label: `Pending Dues (₹${totalDues.toLocaleString("en-IN")})`, icon: IndianRupee },
            { id: "attendance", label: "Attendance & Visits", icon: CalendarCheck },
            { id: "memberships", label: "Memberships & Renewals", icon: Users },
            { id: "pnl", label: "Cash Flow & Outflow", icon: Layers },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report 1: Collections & Revenue */}
      {reportType === "collections" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Collections</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                ₹{totalCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{filteredPayments.length} transactions</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">UPI Collections</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                ₹{upiCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {totalCollections > 0 ? `${Math.round((upiCollections / totalCollections) * 100)}% of total` : "0%"}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Cash Collections</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                ₹{cashCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {totalCollections > 0 ? `${Math.round((cashCollections / totalCollections) * 100)}% of total` : "0%"}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Card & Bank</div>
              <div className="text-xl font-black text-slate-900 mt-1">
                ₹{cardCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {totalCollections > 0 ? `${Math.round((cardCollections / totalCollections) * 100)}% of total` : "0%"}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Payment Transactions ({filteredPayments.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">Receipt Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Branch</th>
                    <th className="p-3">Mode</th>
                    <th className="p-3 text-right pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No transactions recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="p-3 pl-4 font-mono font-bold text-slate-900">
                          #{p.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="p-3">{p.paymentDate}</td>
                        <td className="p-3 font-semibold text-slate-900">{p.memberName}</td>
                        <td className="p-3">{p.branchName}</td>
                        <td className="p-3 uppercase font-medium">{p.paymentMethod}</td>
                        <td className="p-3 text-right pr-4 font-black text-slate-900">
                          ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Outstanding Dues */}
      {reportType === "dues" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-800 uppercase">Total Uncollected Balance</div>
              <div className="text-3xl font-black text-amber-700 mt-1">
                ₹{totalDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                Across {duesList.length} members with partial payments on active contracts
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Members with Pending Dues
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">Member Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Plan Price</th>
                    <th className="p-3">Paid so Far</th>
                    <th className="p-3 font-bold text-amber-700">Remaining Due</th>
                    <th className="p-3 text-right pr-4">Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {duesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        All member fees are fully cleared! No pending dues. 🎉
                      </td>
                    </tr>
                  ) : (
                    duesList.map((m) => {
                      const cleanPhone = m.memberPhone.replace(/\D/g, "");
                      const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                      const waReminder = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                        `Hello ${m.memberName}! 💪\nThis is a friendly reminder from *${gymName}* regarding your ${m.planName} membership.\nYou have a pending balance of *₹${m.dueAmount.toLocaleString("en-IN")}*.\nPlease clear the dues at the reception during your next visit. Thank you! 🙏`
                      )}`;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="p-3 pl-4 font-bold text-slate-900">{m.memberName}</td>
                          <td className="p-3">{m.memberPhone}</td>
                          <td className="p-3 font-medium">{m.planName}</td>
                          <td className="p-3">₹{m.planPrice.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-emerald-600 font-semibold">
                            ₹{m.paidAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 font-black text-amber-700">
                            ₹{m.dueAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <a
                              href={waReminder}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 3: Attendance & Visits */}
      {reportType === "attendance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Visits Recorded</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{filteredAttendance.length}</div>
              <div className="text-[11px] text-slate-400 mt-1">During selected period</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Daily Average Check-Ins</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {dateRange === "today"
                  ? filteredAttendance.length
                  : Math.round(filteredAttendance.length / (dateRange === "7days" ? 7 : 30))}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Check-ins per day</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Check-In Logs ({filteredAttendance.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">Date</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Member</th>
                    <th className="p-3 pr-4">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        No check-ins recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/60">
                        <td className="p-3 pl-4 font-semibold text-slate-900">{a.checkInDate}</td>
                        <td className="p-3">
                          {new Date(a.checkInTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3 font-bold text-slate-900">{a.memberName}</td>
                        <td className="p-3 pr-4">{a.branchName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 4: Memberships & Renewals */}
      {reportType === "memberships" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Active Subscriptions</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{activeMembershipsCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">Currently valid contracts</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Expiring in 7 Days</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{expiringSoonCount}</div>
              <div className="text-[11px] text-slate-400 mt-1">Requires renewal follow-up</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Contracts Tracked</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{filteredMemberships.length}</div>
              <div className="text-[11px] text-slate-400 mt-1">Active, expired & renewed</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Membership Contracts
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">Member Name</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Start Date</th>
                    <th className="p-3">End Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-4">Validity Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredMemberships.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="p-3 pl-4 font-bold text-slate-900">{m.memberName}</td>
                      <td className="p-3 font-semibold">{m.planName}</td>
                      <td className="p-3">{m.startDate}</td>
                      <td className="p-3">{m.endDate}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                            m.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3 pr-4">
                        {m.status === "active" ? (
                          m.daysLeft >= 0 ? (
                            <span className={m.daysLeft <= 7 ? "text-amber-600 font-bold" : "text-emerald-700 font-semibold"}>
                              {m.daysLeft} days remaining
                            </span>
                          ) : (
                            <span className="text-red-600 font-bold">Lapsed</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 5: Cash Flow & Outflow */}
      {reportType === "pnl" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Revenue (Collections)</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                ₹{totalCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Operational Expenses</div>
              <div className="text-2xl font-black text-red-600 mt-1">
                ₹{totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Net Operating Cash Flow</div>
              <div
                className={`text-2xl font-black mt-1 ${
                  netCashFlow >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {netCashFlow >= 0 ? "+" : ""}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Expenses Recorded ({filteredExpenses.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3 pl-4">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Branch</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No expenses logged for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/60">
                        <td className="p-3 pl-4 font-semibold text-slate-900">{e.expenseDate}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold capitalize text-[10px]">
                            {e.category}
                          </span>
                        </td>
                        <td className="p-3">{e.branchName}</td>
                        <td className="p-3 text-slate-500">{e.description || "—"}</td>
                        <td className="p-3 text-right pr-4 font-black text-slate-900">
                          ₹{e.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
