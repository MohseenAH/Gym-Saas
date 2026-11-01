"use client";

import { useState, useMemo, useCallback } from "react";
import {
  FileSpreadsheet,
  TrendingUp,
  CalendarCheck,
  Users,
  IndianRupee,
  Layers,
  MessageSquare,
  Building,
  Download,
} from "lucide-react";
import { getTodayIST, getStatusBadgeClass } from "@/lib/utils";

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
  void gymId;
  const [reportType, setReportType] = useState<
    "collections" | "attendance" | "memberships" | "dues" | "pnl"
  >("collections");
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "all">("30days");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const todayStr = getTodayIST();

  const filterByDate = useCallback(
    (dateStr: string) => {
      if (dateRange === "all") return true;
      if (dateRange === "today") return dateStr === todayStr;

      const d = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

      if (dateRange === "7days") return diffDays <= 7;
      if (dateRange === "30days") return diffDays <= 30;
      return true;
    },
    [dateRange, todayStr]
  );

  // Filtered datasets
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (selectedBranchId !== "all" && p.branchId !== selectedBranchId) return false;
      return filterByDate(p.paymentDate);
    });
  }, [payments, selectedBranchId, filterByDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedBranchId !== "all" && e.branchId !== selectedBranchId) return false;
      return filterByDate(e.expenseDate);
    });
  }, [expenses, selectedBranchId, filterByDate]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (selectedBranchId !== "all" && a.branchId !== selectedBranchId) return false;
      return filterByDate(a.checkInDate);
    });
  }, [attendance, selectedBranchId, filterByDate]);

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

  function handleExportCsv() {
    let filename = "";
    let headers: string[] = [];
    let rows: (string | number | null | undefined)[][] = [];

    const cleanGym = gymName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    if (reportType === "collections") {
      filename = `${cleanGym}_collections_${dateRange}_${getTodayIST()}.csv`;
      headers = [
        "Receipt Ref",
        "Payment ID",
        "Date",
        "Member Name",
        "Member Phone",
        "Branch",
        "Method",
        "Status",
        "Amount (INR)",
      ];
      rows = filteredPayments.map((p) => [
        `#${p.id.slice(0, 8).toUpperCase()}`,
        p.id,
        p.paymentDate,
        p.memberName,
        p.memberPhone,
        p.branchName,
        p.paymentMethod.toUpperCase(),
        p.paymentStatus.toUpperCase(),
        p.amount.toFixed(2),
      ]);
    } else if (reportType === "dues") {
      filename = `${cleanGym}_dues_${getTodayIST()}.csv`;
      headers = [
        "Member Name",
        "Member Phone",
        "Branch",
        "Plan",
        "Plan Price (INR)",
        "Paid (INR)",
        "Due (INR)",
        "Start Date",
        "End Date",
        "Days Left",
      ];
      rows = duesList.map((m) => [
        m.memberName,
        m.memberPhone,
        m.branchName,
        m.planName,
        m.planPrice.toFixed(2),
        m.paidAmount.toFixed(2),
        m.dueAmount.toFixed(2),
        m.startDate,
        m.endDate,
        m.daysLeft,
      ]);
    } else if (reportType === "attendance") {
      filename = `${cleanGym}_attendance_${dateRange}_${getTodayIST()}.csv`;
      headers = ["Date", "Time", "Member Name", "Branch"];
      rows = filteredAttendance.map((a) => [
        a.checkInDate,
        a.checkInTime,
        a.memberName,
        a.branchName,
      ]);
    } else if (reportType === "memberships") {
      filename = `${cleanGym}_memberships_${getTodayIST()}.csv`;
      headers = [
        "Member Name",
        "Member Phone",
        "Branch",
        "Plan",
        "Plan Price (INR)",
        "Status",
        "Start Date",
        "End Date",
        "Days Left",
      ];
      rows = filteredMemberships.map((m) => [
        m.memberName,
        m.memberPhone,
        m.branchName,
        m.planName,
        m.planPrice.toFixed(2),
        m.status.toUpperCase(),
        m.startDate,
        m.endDate,
        m.daysLeft,
      ]);
    } else {
      // pnl
      filename = `${cleanGym}_pnl_${dateRange}_${getTodayIST()}.csv`;
      headers = [
        "Type",
        "Date",
        "Description / Member",
        "Branch",
        "Method",
        "Inflow (INR)",
        "Outflow (INR)",
      ];
      const inflowRows = filteredPayments.map((p) => [
        "COLLECTION",
        p.paymentDate,
        p.memberName,
        p.branchName,
        p.paymentMethod.toUpperCase(),
        p.amount.toFixed(2),
        "0.00",
      ]);
      const outflowRows = filteredExpenses.map((e) => [
        `EXPENSE (${e.category.toUpperCase()})`,
        e.expenseDate,
        e.description || e.category,
        e.branchName,
        e.paymentMethod.toUpperCase(),
        "0.00",
        e.amount.toFixed(2),
      ]);
      rows = [...inflowRows, ...outflowRows].sort((a, b) =>
        String(b[1]).localeCompare(String(a[1]))
      );
    }

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
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-6 rounded-3xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              Business & Financial Reports
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Reconciled collections, member dues, attendance volume, and operational cash movement
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range filter */}
          <div className="flex items-center bg-muted p-1 rounded-xl text-xs">
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
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  dateRange === opt.id
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Branch filter */}
          {branches.length > 1 && (
            <div className="flex items-center gap-2 h-10 px-3 bg-muted/40 border border-border rounded-xl text-xs font-semibold text-foreground">
              <Building className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent focus:outline-hidden font-bold text-foreground cursor-pointer"
              >
                <option value="all" className="bg-card text-card-foreground">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-card text-card-foreground">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 h-10 px-4 bg-foreground text-background hover:opacity-90 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Export currently displayed report as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Total Collections</div>
              <div className="text-2xl font-black text-emerald-500 mt-1">
                ₹{totalCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{filteredPayments.length} transactions</div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">UPI Collections</div>
              <div className="text-xl font-black text-foreground mt-1">
                ₹{upiCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {totalCollections > 0 ? `${Math.round((upiCollections / totalCollections) * 100)}% of total` : "0%"}
              </div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Cash Collections</div>
              <div className="text-xl font-black text-foreground mt-1">
                ₹{cashCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {totalCollections > 0 ? `${Math.round((cashCollections / totalCollections) * 100)}% of total` : "0%"}
              </div>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Card & Bank</div>
              <div className="text-xl font-black text-foreground mt-1">
                ₹{cardCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {totalCollections > 0 ? `${Math.round((cardCollections / totalCollections) * 100)}% of total` : "0%"}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Payment Transactions ({filteredPayments.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3.5 pl-4">Receipt Ref</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Member</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">Mode</th>
                    <th className="p-3.5 text-right pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-muted-foreground font-medium">
                        No transactions recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 pl-4 font-mono font-bold text-foreground">
                          #{p.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="p-3.5 text-muted-foreground">{p.paymentDate}</td>
                        <td className="p-3.5 font-bold text-foreground">{p.memberName}</td>
                        <td className="p-3.5 text-muted-foreground">{p.branchName}</td>
                        <td className="p-3.5 uppercase font-medium">{p.paymentMethod}</td>
                        <td className="p-3.5 text-right pr-4 font-black text-foreground">
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
          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-3xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-500 uppercase tracking-wider">Total Uncollected Balance</div>
              <div className="text-3xl font-black text-amber-500 mt-1">
                ₹{totalDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Across {duesList.length} members with partial payments on active contracts
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Members with Pending Dues
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3.5 pl-4">Member Name</th>
                    <th className="p-3.5">Phone</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Plan Price</th>
                    <th className="p-3.5">Paid so Far</th>
                    <th className="p-3.5 font-bold text-amber-500">Remaining Due</th>
                    <th className="p-3.5 text-right pr-4">Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {duesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-muted-foreground font-medium">
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
                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-foreground">{m.memberName}</td>
                          <td className="p-3.5 text-muted-foreground">{m.memberPhone}</td>
                          <td className="p-3.5 font-medium">{m.planName}</td>
                          <td className="p-3.5">₹{m.planPrice.toLocaleString("en-IN")}</td>
                          <td className="p-3.5 text-emerald-500 font-semibold">
                            ₹{m.paidAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3.5 font-black text-amber-500">
                            ₹{m.dueAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3.5 text-right pr-4">
                            <a
                              href={waReminder}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-xl text-xs font-bold transition-colors border border-[#25D366]/20"
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
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Total Visits Recorded</div>
              <div className="text-2xl font-black text-foreground mt-1">{filteredAttendance.length}</div>
              <div className="text-[11px] text-muted-foreground mt-1">During selected period</div>
            </div>
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Daily Average Check-Ins</div>
              <div className="text-2xl font-black text-primary mt-1">
                {dateRange === "today"
                  ? filteredAttendance.length
                  : Math.round(filteredAttendance.length / (dateRange === "7days" ? 7 : 30))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Check-ins per day</div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Check-In Logs ({filteredAttendance.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3.5 pl-4">Date</th>
                    <th className="p-3.5">Time</th>
                    <th className="p-3.5">Member</th>
                    <th className="p-3.5 pr-4">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-muted-foreground font-medium">
                        No check-ins recorded for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 pl-4 font-semibold text-foreground">{a.checkInDate}</td>
                        <td className="p-3.5 text-muted-foreground">
                          {new Date(a.checkInTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-foreground">{a.memberName}</td>
                        <td className="p-3.5 pr-4 text-muted-foreground">{a.branchName}</td>
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
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Active Subscriptions</div>
              <div className="text-2xl font-black text-emerald-500 mt-1">{activeMembershipsCount}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Currently valid contracts</div>
            </div>
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Expiring in 7 Days</div>
              <div className="text-2xl font-black text-amber-500 mt-1">{expiringSoonCount}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Requires renewal follow-up</div>
            </div>
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Total Contracts Tracked</div>
              <div className="text-2xl font-black text-foreground mt-1">{filteredMemberships.length}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Active, expired & renewed</div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Membership Contracts
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3.5 pl-4">Member Name</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Start Date</th>
                    <th className="p-3.5">End Date</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-4">Validity Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredMemberships.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-foreground">{m.memberName}</td>
                      <td className="p-3.5 font-semibold text-foreground">{m.planName}</td>
                      <td className="p-3.5 text-muted-foreground">{m.startDate}</td>
                      <td className="p-3.5 text-muted-foreground">{m.endDate}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider ${getStatusBadgeClass(m.status)}`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3.5 pr-4">
                        {m.status === "active" ? (
                          m.daysLeft >= 0 ? (
                            <span className={m.daysLeft <= 7 ? "text-amber-500 font-bold" : "text-emerald-500 font-semibold"}>
                              {m.daysLeft} days remaining
                            </span>
                          ) : (
                            <span className="text-rose-500 font-bold">Lapsed</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Total Revenue (Collections)</div>
              <div className="text-2xl font-black text-emerald-500 mt-1">
                ₹{totalCollections.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Operational Expenses</div>
              <div className="text-2xl font-black text-rose-500 mt-1">
                ₹{totalExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Net Operating Cash Flow</div>
              <div
                className={`text-2xl font-black mt-1 ${
                  netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {netCashFlow >= 0 ? "+" : ""}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Expenses Recorded ({filteredExpenses.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-3.5 pl-4">Date</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5 text-right pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-muted-foreground font-medium">
                        No expenses logged for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 pl-4 font-semibold text-foreground">{e.expenseDate}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold capitalize text-[10px] tracking-wider">
                            {e.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{e.branchName}</td>
                        <td className="p-3.5 text-muted-foreground">{e.description || "—"}</td>
                        <td className="p-3.5 text-right pr-4 font-black text-foreground">
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