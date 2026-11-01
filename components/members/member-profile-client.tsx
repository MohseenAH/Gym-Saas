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
import { getStatusBadgeClass } from "@/lib/utils";

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
    endDate: string;
  }) {
    router.refresh();
    if (res.paymentId) {
      const receiptData: ReceiptData = {
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
      };
      setSelectedReceipt(receiptData);
    }
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Back Link */}
      <div>
        <Link
          href={`/app/${gymId}/members`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Members Roster
        </Link>
      </div>

      {/* Member Header Card */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-card-foreground">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-2xl font-black shadow-xs shrink-0">
            {member.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                {member.fullName}
              </h1>
              <span className={getStatusBadgeClass(member.status)}>
                {member.status}
              </span>
              {member.userId && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="w-3 h-3" /> Portal Connected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
              <span>{member.phone}</span>
              {member.email && (
                <>
                  <span>•</span>
                  <span>{member.email}</span>
                </>
              )}
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Building className="w-3 h-3 text-muted-foreground" /> {member.branchName}
              </span>
            </p>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={waDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-11 px-3.5 bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/30 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </a>
          <button
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 h-11 px-3.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          <button
            onClick={() => setIsRenewOpen(true)}
            className="inline-flex items-center gap-1.5 h-11 px-4 bg-primary hover:opacity-95 text-primary-foreground rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Renew / Change Plan
          </button>
        </div>
      </div>

      {/* KPI 4-Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Membership Status */}
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center gap-4 text-card-foreground">
          <div
            className={`p-3.5 rounded-2xl shadow-2xs ${
              activeMembership && activeMembership.daysLeft > 0
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-rose-500/10 text-rose-600"
            }`}
          >
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Plan</div>
            <div className="text-base font-black text-foreground truncate mt-0.5">
              {activeMembership ? activeMembership.planName : "No Active Plan"}
            </div>
            <div className="text-[11px] font-semibold mt-1">
              {activeMembership ? (
                activeMembership.daysLeft > 0 ? (
                  <span className="text-emerald-600">
                    {activeMembership.daysLeft}d left (Exp {activeMembership.endDate})
                  </span>
                ) : (
                  <span className="text-rose-600">
                    Expired on {activeMembership.endDate}
                  </span>
                )
              ) : (
                <span className="text-muted-foreground">Needs plan assignment</span>
              )}
            </div>
          </div>
        </div>

        {/* Total Payments */}
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center gap-4 text-card-foreground">
          <div className="p-3.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Paid</div>
            <div className="text-2xl font-black text-foreground mt-0.5">
              ₹{totalPaid.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Across {payments.length} transactions
            </div>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center gap-4 text-card-foreground">
          <div
            className={`p-3.5 rounded-2xl shadow-2xs ${
              outstandingDues > 0
                ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Remaining Dues</div>
            <div
              className={`text-2xl font-black mt-0.5 ${
                outstandingDues > 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              ₹{outstandingDues.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] font-semibold mt-1">
              {outstandingDues > 0 ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Balance Pending
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All Dues Cleared
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Workouts Check-in count */}
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center gap-4 text-card-foreground">
          <div className="p-3.5 bg-purple-500/10 text-purple-600 rounded-2xl shadow-2xs">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gym Attendance</div>
            <div className="text-2xl font-black text-foreground mt-0.5">{totalWorkouts} Visits</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {attendance.length > 0
                ? `Last visit: ${attendance[0].checkInDate}`
                : "No visits recorded yet"}
            </div>
          </div>
        </div>
      </div>

      {/* Member Details Summary Card */}
      <div className="bg-card rounded-3xl border border-border shadow-xs p-6 text-card-foreground">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Member Details & Health Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
            <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">Contact Phone</span>
            <span className="font-bold text-foreground text-sm">{member.phone}</span>
          </div>
          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
            <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">Email Address</span>
            <span className="font-bold text-foreground text-sm">{member.email || "—"}</span>
          </div>
          <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
            <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px] mb-1">Registration Date</span>
            <span className="font-bold text-foreground text-sm">
              {new Date(member.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {member.notes && (
          <div className="mt-3.5 p-3.5 bg-primary/5 rounded-2xl border border-primary/20 text-xs text-foreground">
            <span className="font-bold text-primary block mb-0.5">
              Trainer & Medical Notes:
            </span>
            {member.notes}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("memberships")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "memberships"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Membership Plans ({memberships.length})
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "payments"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payments & Receipts ({payments.length})
        </button>

        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "attendance"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Clock className="w-4 h-4" />
          Attendance History ({attendance.length})
        </button>
      </div>

      {/* Tab 1: Memberships History */}
      {activeTab === "memberships" && (
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">Subscription History</div>
            <button
              onClick={() => setIsRenewOpen(true)}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              + New Contract
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-5">Plan Name</th>
                  <th className="p-4">Plan Price</th>
                  <th className="p-4">Start Date</th>
                  <th className="p-4">End Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {memberships.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No membership contracts found. Click &quot;Renew / Change Plan&quot; to assign a plan.
                    </td>
                  </tr>
                ) : (
                  memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 pl-5 font-bold text-foreground">{m.planName}</td>
                      <td className="p-4 font-semibold">₹{m.planPrice.toLocaleString("en-IN")}</td>
                      <td className="p-4 font-medium text-muted-foreground">{m.startDate}</td>
                      <td className="p-4 font-medium text-muted-foreground">{m.endDate}</td>
                      <td className="p-4">
                        <span className={getStatusBadgeClass(m.status)}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-muted-foreground italic">{m.notes || "—"}</td>
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
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">Payment Ledger & Invoices</div>
            <div className="text-xs text-muted-foreground font-medium">{payments.length} entries</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-5">Receipt Ref</th>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4 pr-5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No payments recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 pl-5 font-mono font-bold text-foreground">
                        #{p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="p-4 font-medium text-muted-foreground">{p.paymentDate}</td>
                      <td className="p-4 font-black text-foreground">
                        ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 uppercase font-bold text-muted-foreground text-[11px]">
                        {p.paymentMethod}
                      </td>
                      <td className="p-4">
                        <span className={getStatusBadgeClass(p.paymentStatus)}>
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground italic">{p.notes || "—"}</td>
                      <td className="p-4 pr-5 text-right">
                        <button
                          onClick={() => openReceipt(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl font-bold text-xs transition-colors cursor-pointer"
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
        <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
          <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">Workout & Visit History</div>
            <div className="text-xs text-muted-foreground font-medium">{attendance.length} check-ins</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-5">Visit Date</th>
                  <th className="p-4">Check-in Time</th>
                  <th className="p-4">Check-in Method</th>
                  <th className="p-4 pr-5">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No check-ins recorded yet for this member.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 pl-5 font-bold text-foreground">{att.checkInDate}</td>
                      <td className="p-4 font-medium text-muted-foreground">
                        {new Date(att.checkInTime).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-[11px] border border-border">
                          {att.checkInMethod.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-muted-foreground font-medium">
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
