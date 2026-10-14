"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  IdCard,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  CreditCard,
  Building2,
  Clock,
  UserPlus,
} from "lucide-react";
import {
  RenewMembershipModal,
  MembershipPlanOption,
} from "@/components/members/renew-membership-modal";
import {
  PlansManagerClient,
  PlanDetailItem,
} from "./plans-manager-client";
import {
  AssignMembershipModal,
  AssignableMember,
} from "./assign-membership-modal";

export interface MembershipItem {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  memberEmail?: string | null;
  branchId: string;
  branchName: string;
  planId: string;
  planName: string;
  planPrice: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  status: "active" | "expired" | "frozen" | "cancelled";
  daysRemaining: number;
  isExpiringSoon: boolean;
  totalPaid: number;
  totalDue: number;
  notes?: string | null;
}

interface MembershipsClientProps {
  gymId: string;
  memberships: MembershipItem[];
  plans: MembershipPlanOption[];
  detailedPlans?: PlanDetailItem[];
  branches?: { id: string; name: string }[];
  membersList?: AssignableMember[];
  canManagePlans?: boolean;
  canManageMembers?: boolean;
  selectedBranchId?: string;
  branchName?: string;
  initialTab?: "contracts" | "plans";
}

type StatusFilter = "all" | "active" | "expiring" | "expired";

export function MembershipsClient({
  gymId,
  memberships,
  plans,
  detailedPlans = [],
  branches = [],
  membersList = [],
  canManagePlans = true,
  canManageMembers = true,
  selectedBranchId,
  branchName,
  initialTab = "contracts",
}: MembershipsClientProps) {
  const [activeTab, setActiveTab] = useState<"contracts" | "plans">(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("all");

  // Modals state
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetMembership, setTargetMembership] = useState<MembershipItem | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Compute KPI metrics for contracts
  const stats = useMemo(() => {
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let totalOutstanding = 0;

    memberships.forEach((m) => {
      if (m.status === "active") {
        if (m.isExpiringSoon) {
          expiringCount++;
        } else {
          activeCount++;
        }
      } else if (m.status === "expired") {
        expiredCount++;
      }
      totalOutstanding += m.totalDue;
    });

    return {
      total: memberships.length,
      active: activeCount,
      expiring: expiringCount,
      expired: expiredCount,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    };
  }, [memberships]);

  // Filtered memberships
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      // 1. Text search
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        m.memberName.toLowerCase().includes(term) ||
        m.memberPhone.includes(term) ||
        m.planName.toLowerCase().includes(term) ||
        m.branchName.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. Status filter
      if (statusFilter === "active") {
        if (m.status !== "active" || m.isExpiringSoon) return false;
      } else if (statusFilter === "expiring") {
        if (!m.isExpiringSoon || m.status !== "active") return false;
      } else if (statusFilter === "expired") {
        if (m.status !== "expired") return false;
      }

      // 3. Plan filter
      if (selectedPlanFilter !== "all" && m.planId !== selectedPlanFilter) {
        return false;
      }

      return true;
    });
  }, [memberships, searchTerm, statusFilter, selectedPlanFilter]);

  function handleOpenRenew(membership: MembershipItem) {
    setTargetMembership(membership);
    setRenewModalOpen(true);
  }

  function handleRenewSuccess(result: { planName: string; amountPaid: number }) {
    setRenewModalOpen(false);
    setSuccessNotice(
      `Successfully renewed ${targetMembership?.memberName}'s membership for ${result.planName}!`
    );
    setTimeout(() => setSuccessNotice(null), 5000);
  }

  function handleAssignSuccess(result: { memberName: string; planName: string }) {
    setAssignModalOpen(false);
    setSuccessNotice(
      `Successfully assigned ${result.planName} to ${result.memberName}!`
    );
    setTimeout(() => setSuccessNotice(null), 5000);
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <IdCard className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Membership Contracts & Plans
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {branchName ? `Filtered to ${branchName} • ` : "All Branches • "}
            Manage membership plans, contract timelines, renewal schedules, and dues collection
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManageMembers && activeTab === "contracts" && membersList.length > 0 && (
            <button
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Assign Membership
            </button>
          )}

          <Link
            href={`/app/${gymId}/members`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Manage Members <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main View Switcher Tabs: Contracts vs Plans */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1">
        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "contracts"
              ? "bg-white text-indigo-600 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <IdCard className="w-4 h-4" />
          <span>Contracts</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {memberships.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "plans"
              ? "bg-white text-indigo-600 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Membership Plans</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {detailedPlans.length}
          </span>
        </button>
      </div>

      {/* Success alert */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Content: Plans Manager */}
      {activeTab === "plans" && (
        <PlansManagerClient
          gymId={gymId}
          plans={detailedPlans}
          branches={branches}
          canManagePlans={canManagePlans}
          selectedBranchId={selectedBranchId}
        />
      )}

      {/* Tab Content: Contracts Roster */}
      {activeTab === "contracts" && (
        <>
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Memberships */}
            <div
              onClick={() => setStatusFilter("active")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Active Contracts</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {stats.active}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">In good standing</div>
            </div>

            {/* Expiring Soon */}
            <div
              onClick={() => setStatusFilter("expiring")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "expiring"
                  ? "bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/20"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Expiring (7 Days)</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-2">
                {stats.expiring}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Due for renewal</div>
            </div>

            {/* Expired Contracts */}
            <div
              onClick={() => setStatusFilter("expired")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === "expired"
                  ? "bg-red-50/60 border-red-300 ring-2 ring-red-500/20"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Expired</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-black text-red-600 mt-2">
                {stats.expired}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Require follow-up</div>
            </div>

            {/* Outstanding Balances */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Pending Balances</span>
                <CreditCard className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                ₹{stats.totalOutstanding.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Uncollected plan dues</div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "active"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Active ({stats.active})
              </button>
              <button
                onClick={() => setStatusFilter("expiring")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "expiring"
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Expiring Soon ({stats.expiring})
              </button>
              <button
                onClick={() => setStatusFilter("expired")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "expired"
                    ? "bg-white text-red-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Expired ({stats.expired})
              </button>
            </div>

            {/* Search & Plan Filter */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search member, phone, plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {plans.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedPlanFilter}
                    onChange={(e) => setSelectedPlanFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    aria-label="Filter by membership plan"
                  >
                    <option value="all">All Plans</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Memberships Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {filteredMemberships.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <IdCard className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No Memberships Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {searchTerm || statusFilter !== "all" || selectedPlanFilter !== "all"
                    ? "No membership contracts match the current search or filter criteria."
                    : "No membership contracts have been registered yet for this branch context."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {canManageMembers && membersList.length > 0 && (
                    <button
                      onClick={() => setAssignModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Assign Plan
                    </button>
                  )}
                  <Link
                    href={`/app/${gymId}/members`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                  >
                    Enroll New Member
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Member</th>
                      <th className="px-4 py-3.5">Branch</th>
                      <th className="px-4 py-3.5">Plan & Duration</th>
                      <th className="px-4 py-3.5">Validity Dates</th>
                      <th className="px-4 py-3.5">Balance</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMemberships.map((m) => {
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Member Info */}
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/app/${gymId}/members/${m.memberId}`}
                              className="font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1.5 group"
                            >
                              <span>{m.memberName}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {m.memberPhone}
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-3.5 text-slate-600 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{m.branchName}</span>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-slate-900">{m.planName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              ₹{m.planPrice.toLocaleString("en-IN")} &bull; {m.durationDays} days
                            </div>
                          </td>

                          {/* Dates & Expiry */}
                          <td className="px-4 py-3.5">
                            <div className="text-slate-700 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{m.startDate} &rarr; {m.endDate}</span>
                            </div>
                            <div className="text-[11px] mt-0.5 font-semibold">
                              {m.status === "active" ? (
                                m.isExpiringSoon ? (
                                  <span className="text-amber-600">
                                    Expires in {m.daysRemaining} {m.daysRemaining === 1 ? "day" : "days"}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">
                                    {m.daysRemaining} days left
                                  </span>
                                )
                              ) : (
                                <span className="text-red-500">
                                  Expired {Math.abs(m.daysRemaining)} days ago
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Financial Balance */}
                          <td className="px-4 py-3.5">
                            {m.totalDue > 0 ? (
                              <div>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Due: ₹{m.totalDue.toLocaleString("en-IN")}
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Paid: ₹{m.totalPaid.toLocaleString("en-IN")}
                                </div>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Fully Paid
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3.5">
                            {m.status === "active" ? (
                              m.isExpiringSoon ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" /> Expiring
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Active
                                </span>
                              )
                            ) : m.status === "expired" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="w-3 h-3" /> Expired
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 capitalize">
                                {m.status}
                              </span>
                            )}
                          </td>

                          {/* Action Links */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenRenew(m)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors"
                                title="Renew membership contract"
                              >
                                <RefreshCw className="w-3 h-3" /> Renew
                              </button>
                              <Link
                                href={`/app/${gymId}/payments?memberId=${m.memberId}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="View member payments"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </Link>
                              <Link
                                href={`/app/${gymId}/members/${m.memberId}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                                title="Open member profile"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Renew Membership Modal */}
      {targetMembership && (
        <RenewMembershipModal
          gymId={gymId}
          branchId={targetMembership.branchId}
          memberId={targetMembership.memberId}
          memberName={targetMembership.memberName}
          plans={plans}
          isOpen={renewModalOpen}
          onClose={() => {
            setRenewModalOpen(false);
            setTargetMembership(null);
          }}
          onSuccess={handleRenewSuccess}
        />
      )}

      {/* Assign Membership Modal */}
      <AssignMembershipModal
        gymId={gymId}
        members={membersList}
        plans={detailedPlans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          durationDays: p.durationDays,
          branchId: p.branchId,
          isActive: p.isActive,
        }))}
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onSuccess={handleAssignSuccess}
      />
    </div>
  );
}
