"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Dumbbell,
  Edit2,
  FileText,
  IndianRupee,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
} from "lucide-react";
import { EditMemberModal } from "@/components/members/edit-member-modal";
import {
  RenewMembershipModal,
  MembershipPlanOption,
} from "@/components/members/renew-membership-modal";
import { ReceiptModal, ReceiptData } from "@/components/payments/receipt-modal";

export interface MemberProfileClientProps {
  gymId: string;
  gymName: string;
  gymPhone?: string;
  member: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
    branchId: string;
    branchName: string;
    status: "active" | "inactive" | "suspended";
    notes?: string | null;
    createdAt: string;
    userId?: string | null;
  };
  branches: { id: string; name: string }[];
  plans: MembershipPlanOption[];
  activeMembership: {
    id: string;
    planName: string;
    planPrice: number;
    startDate: string;
    endDate: string;
    status: string;
    daysLeft: number;
  } | null;
  memberships: {
    id: string;
    planName: string;
    planPrice: number;
    startDate: string;
    endDate: string;
    status: string;
    notes?: string | null;
    createdAt: string;
  }[];
  payments: {
    id: string;
    membershipId?: string | null;
    amount: number;
    paymentMethod: string;
    paymentStatus: string;
    paymentDate: string;
    notes?: string | null;
  }[];
  attendance: {
    id: string;
    checkInDate: string;
    checkInTime: string;
    checkInMethod: string;
    branchName?: string;
  }[];
  totalPaid: number;
  outstandingDues: number;
  totalWorkouts: number;
}

export function MemberProfileClient({
  gymId,
  gymName,
  gymPhone,
  member,
  branches,
  plans,
  activeMembership,
  memberships,
  payments,
  attendance,
  totalPaid,
  outstandingDues,
  totalWorkouts,
}: MemberProfileClientProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [activeTab, setActiveTab] = useState<"memberships" | "payments" | "attendance">("memberships");

  const cleanPhone = member.phone.replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const waDirectUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `Hello ${member.fullName}! This is ${gymName}. 💪`
  )}`;

  function openReceipt(p: (typeof payments)[0]) {
    const receiptData: ReceiptData = {
      id: p.id,
      gymName,
      branchName: member.branchName,
      gymPhone,
      memberName: member.fullName,
      memberPhone: member.phone,
      memberEmail: member.email || undefined,
      planName: activeMembership?.planName || "Membership Fee",
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      paymentDate: p.paymentDate,
      notes: p.notes || undefined,
      outstandingDues: outstandingDues > 0 ? outstandingDues : 0,
    };
    setSelectedReceipt(receiptData);
  }

  function handleRenewalSuccess(res: {
    paymentId?: string | null;
    planName: string;
    amountPaid: number;
    paymentMethod: string;
    startDate: string;
  }) {
    router.refresh();
    if (res.paymentId && res.amountPaid > 0) {
      setSelectedReceipt({
        id: res.paymentId,
        gymName,
        branchName: member.branchName,
        gymPhone,
        memberName: member.fullName,
        memberPhone: member.phone,
        memberEmail: member.email || undefined,
        planName: res.planName,
        amount: res.amountPaid,
        paymentMethod: res.paymentMethod,
        paymentStatus: "paid",
        paymentDate: res.startDate,
        outstandingDues: 0,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/${gymId}/members`}
            className="p-2 bg-white border border-slate-200/80 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {member.fullName}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                  member.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    : member.status === "suspended"
                    ? "bg-red-50 text-red-700 border border-red-200/60"
                    : "bg-slate-100 text-slate-600 border border-slate-200/60"
                }`}
              >
                {member.status}
              </span>
              {member.userId && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                  <ShieldCheck className="w-3 h-3" />
                  Portal Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
              <span>Member ID: {member.id.slice(0, 8).toUpperCase()}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="w-3 h-3" /> {member.branchName}
              </span>
            </p>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={waDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-xl text-xs font-bold transition-colors shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </a>
          <button
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-colors shadow-2xs"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          <button
            onClick={() => setIsRenewOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Renew / Change Plan
          </button>
        </div>
      </div>

      {/* KPI 4-Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Membership Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              activeMembership && activeMembership.daysLeft > 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Active Plan</div>
            <div className="text-base font-black text-slate-900 truncate">
              {activeMembership ? activeMembership.planName : "No Active Plan"}
            </div>
            <div className="text-[11px] font-semibold mt-0.5">
              {activeMembership ? (
                activeMembership.daysLeft > 0 ? (
                  <span className="text-emerald-600">
                    {activeMembership.daysLeft} days remaining (Expires {activeMembership.endDate})
                  </span>
                ) : (
                  <span className="text-red-600">
                    Expired on {activeMembership.endDate}
                  </span>
                )
              ) : (
                <span className="text-slate-400">Needs membership renewal</span>
              )}
            </div>
          </div>
        </div>

        {/* Total Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Paid</div>
            <div className="text-xl font-black text-slate-900">
              ₹{totalPaid.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across {payments.length} transactions
            </div>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              outstandingDues > 0
                ? "bg-amber-50 text-amber-600"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Remaining Dues</div>
            <div
              className={`text-xl font-black ${
                outstandingDues > 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              ₹{outstandingDues.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] font-semibold mt-0.5">
              {outstandingDues > 0 ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Balance Pending
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> All Dues Cleared
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Workouts Check-in count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Gym Attendance</div>
            <div className="text-xl font-black text-slate-900">{totalWorkouts} Workouts</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {attendance.length > 0
                ? `Last visit: ${attendance[0].checkInDate}`
                : "No visits recorded yet"}
            </div>
          </div>
        </div>
      </div>

      {/* Member Details Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Member Details & Health Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block font-semibold mb-1">Contact Phone</span>
            <span className="font-bold text-slate-800">{member.phone}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block font-semibold mb-1">Email Address</span>
            <span className="font-bold text-slate-800">{member.email || "—"}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block font-semibold mb-1">Registration Date</span>
            <span className="font-bold text-slate-800">
              {new Date(member.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {member.notes && (
          <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-slate-700">
            <span className="font-bold text-indigo-900 block mb-0.5">
              Trainer & Medical Notes:
            </span>
            {member.notes}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          onClick={() => setActiveTab("memberships")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "memberships"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Membership Plans ({memberships.length})
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "payments"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payments & Receipts ({payments.length})
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "attendance"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock className="w-4 h-4" />
          Attendance History ({attendance.length})
        </button>
      </div>

      {/* Tab 1: Memberships History */}
      {activeTab === "memberships" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900">Subscription History</div>
            <button
              onClick={() => setIsRenewOpen(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              + New Contract
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5 pl-4">Plan Name</th>
                  <th className="p-3.5">Plan Price</th>
                  <th className="p-3.5">Start Date</th>
                  <th className="p-3.5">End Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {memberships.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No membership contracts found. Click &quot;Renew / Change Plan&quot; to assign a plan.
                    </td>
                  </tr>
                ) : (
                  memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-slate-900">{m.planName}</td>
                      <td className="p-3.5 font-semibold">₹{m.planPrice.toLocaleString("en-IN")}</td>
                      <td className="p-3.5 font-medium text-slate-600">{m.startDate}</td>
                      <td className="p-3.5 font-medium text-slate-600">{m.endDate}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${
                            m.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : m.status === "expired"
                              ? "bg-red-50 text-red-700 border border-red-200/60"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3.5 pr-4 text-slate-500 italic">{m.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payments Ledger */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900">Payment Ledger & Invoices</div>
            <div className="text-xs text-slate-400">{payments.length} entries</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5 pl-4">Receipt Ref</th>
                  <th className="p-3.5">Payment Date</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Notes</th>
                  <th className="p-3.5 pr-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No payments recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 pl-4 font-mono font-bold text-slate-900">
                        #{p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-3.5 font-medium text-slate-600">{p.paymentDate}</td>
                      <td className="p-3.5 font-black text-slate-900">
                        ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 uppercase font-semibold text-slate-700">
                        {p.paymentMethod}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                            p.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 italic">{p.notes || "—"}</td>
                      <td className="p-3.5 pr-4 text-right">
                        <button
                          onClick={() => openReceipt(p)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Attendance History */}
      {activeTab === "attendance" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900">Workout & Visit History</div>
            <div className="text-xs text-slate-400">{attendance.length} check-ins</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3.5 pl-4">Visit Date</th>
                  <th className="p-3.5">Check-in Time</th>
                  <th className="p-3.5">Check-in Method</th>
                  <th className="p-3.5 pr-4">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      No check-ins recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-slate-900">{att.checkInDate}</td>
                      <td className="p-3.5 font-medium text-slate-600">
                        {new Date(att.checkInTime).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {att.checkInMethod.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3.5 pr-4 text-slate-600">
                        {att.branchName || member.branchName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditMemberModal
        gymId={gymId}
        member={{
          id: member.id,
          fullName: member.fullName,
          phone: member.phone,
          email: member.email,
          branchId: member.branchId,
          status: member.status,
          notes: member.notes,
        }}
        branches={branches}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <RenewMembershipModal
        gymId={gymId}
        branchId={member.branchId}
        memberId={member.id}
        memberName={member.fullName}
        plans={plans}
        isOpen={isRenewOpen}
        onClose={() => setIsRenewOpen(false)}
        onSuccess={handleRenewalSuccess}
      />

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
