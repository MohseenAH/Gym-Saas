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
import { getStatusBadgeClass } from "@/lib/utils";

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
        activeCount++;
        if (m.isExpiringSoon) expiringCount++;
      } else if (m.status === "expired") {
        expiredCount++;
      }
      totalOutstanding += m.totalDue;
    });

    return {
      active: activeCount,
      expiring: expiringCount,
      expired: expiredCount,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    };
  }, [memberships]);

  // Filtered memberships
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          m.memberName.toLowerCase().includes(term) ||
          m.memberPhone.includes(term) ||
          m.planName.toLowerCase().includes(term) ||
          m.branchName.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // 2. Status filter
      if (statusFilter === "active" && m.status !== "active") return false;
      if (statusFilter === "expiring" && (!m.isExpiringSoon || m.status !== "active"))
        return false;
      if (statusFilter === "expired" && m.status !== "expired") return false;

      // 3. Plan filter
      if (selectedPlanFilter !== "all" && m.planId !== selectedPlanFilter)
        return false;

      return true;
    });
  }, [memberships, searchTerm, statusFilter, selectedPlanFilter]);

  function handleOpenRenew(membership: MembershipItem) {
    setTargetMembership(membership);
    setRenewModalOpen(true);
  }

  function handleRenewSuccess() {
    setSuccessNotice("Membership renewed successfully! Roster updated.");
    setTimeout(() => setSuccessNotice(null), 5000);
  }

  function handleAssignSuccess() {
    setSuccessNotice("Membership assigned successfully! Active contract created.");
    setTimeout(() => setSuccessNotice(null), 5000);
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Memberships & Plans
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track active member subscription contracts and manage gym pricing plan tiers
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {canManageMembers && membersList.length > 0 && activeTab === "contracts" && (
            <button
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Assign Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/60 rounded-2xl w-fit border border-border/60">
        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "contracts"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <IdCard className="w-4 h-4" />
          <span>Active Contracts</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
            {memberships.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "plans"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Membership Plans</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-bold">
            {detailedPlans.length}
          </span>
        </button>
      </div>

      {/* Success alert */}
      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="hover:opacity-75 cursor-pointer"
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Active Memberships */}
            <div
              onClick={() => setStatusFilter("active")}
              className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer text-card-foreground ${
                statusFilter === "active"
                  ? "bg-card border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                  : "bg-card border-border hover:border-border/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Active Contracts</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-foreground mt-1 truncate">
                {stats.active}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">In good standing</div>
            </div>

            {/* Expiring Soon */}
            <div
              onClick={() => setStatusFilter("expiring")}
              className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer text-card-foreground ${
                statusFilter === "expiring"
                  ? "bg-card border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                  : "bg-card border-border hover:border-border/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Expiring (7d)</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-amber-600 mt-1 truncate">
                {stats.expiring}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Due for renewal</div>
            </div>

            {/* Expired Contracts */}
            <div
              onClick={() => setStatusFilter("expired")}
              className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer text-card-foreground ${
                statusFilter === "expired"
                  ? "bg-card border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                  : "bg-card border-border hover:border-border/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Expired</span>
                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-rose-600 mt-1 truncate">
                {stats.expired}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Require follow-up</div>
            </div>

            {/* Outstanding Balances */}
            <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Pending Balances</span>
                <CreditCard className="w-3.5 h-3.5 text-primary shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-foreground mt-1 truncate">
                ₹{stats.totalOutstanding.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Uncollected dues</div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-card p-4 sm:p-5 rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-card-foreground">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl w-full sm:w-auto overflow-x-auto border border-border/60">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({memberships.length})
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-card text-emerald-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active ({stats.active})
              </button>
              <button
                onClick={() => setStatusFilter("expiring")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "expiring"
                    ? "bg-card text-amber-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Expiring ({stats.expiring})
              </button>
              <button
                onClick={() => setStatusFilter("expired")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "expired"
                    ? "bg-card text-rose-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Expired ({stats.expired})
              </button>
            </div>

            {/* Search Input & Plan Filter */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search member, phone, plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>

              {plans.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedPlanFilter}
                    onChange={(e) => setSelectedPlanFilter(e.target.value)}
                    className="h-11 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
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
          <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
            {filteredMemberships.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <IdCard className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No Memberships Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm || statusFilter !== "all" || selectedPlanFilter !== "all"
                    ? "No membership contracts match the current search or filter criteria."
                    : "No membership contracts have been registered yet for this branch context."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {canManageMembers && membersList.length > 0 && (
                    <button
                      onClick={() => setAssignModalOpen(true)}
                      className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" /> Assign Plan
                    </button>
                  )}
                  <Link
                    href={`/app/${gymId}/members`}
                    className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-xs transition-opacity"
                  >
                    Enroll New Member
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                    <tr>
                      <th className="px-5 py-4">Member</th>
                      <th className="px-4 py-4">Branch</th>
                      <th className="px-4 py-4">Plan & Duration</th>
                      <th className="px-4 py-4">Validity Dates</th>
                      <th className="px-4 py-4">Balance</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {filteredMemberships.map((m) => {
                      return (
                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                          {/* Member Info */}
                          <td className="px-5 py-4">
                            <Link
                              href={`/app/${gymId}/members/${m.memberId}`}
                              className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
                            >
                              <span>{m.memberName}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {m.memberPhone}
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-4 text-muted-foreground font-medium">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                              <span>{m.branchName}</span>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-4">
                            <div className="font-bold text-foreground">{m.planName}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              ₹{m.planPrice.toLocaleString("en-IN")} &bull; {m.durationDays} days
                            </div>
                          </td>

                          {/* Dates & Expiry */}
                          <td className="px-4 py-4">
                            <div className="text-foreground font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>{m.startDate} &rarr; {m.endDate}</span>
                            </div>
                            <div className="text-[11px] mt-0.5 font-bold">
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
                                <span className="text-rose-600">
                                  Expired {Math.abs(m.daysRemaining)} days ago
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Financial Balance */}
                          <td className="px-4 py-4">
                            {m.totalDue > 0 ? (
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  Due: ₹{m.totalDue.toLocaleString("en-IN")}
                                </span>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Paid: ₹{m.totalPaid.toLocaleString("en-IN")}
                                </div>
                              </div>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                Fully Paid
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-4">
                            <span className={getStatusBadgeClass(m.status)}>
                              {m.status}
                            </span>
                          </td>

                          {/* Action Links */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenRenew(m)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs transition-colors cursor-pointer"
                                title="Renew membership contract"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Renew
                              </button>
                              <Link
                                href={`/app/${gymId}/payments?memberId=${m.memberId}`}
                                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="View member payments"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </Link>
                              <Link
                                href={`/app/${gymId}/members/${m.memberId}`}
                                className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
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
