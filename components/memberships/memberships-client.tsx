"use client";

import { useState, useMemo, useEffect } from "react";
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
  Users,
  CheckSquare,
  Square,
  Sparkles,
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
import {
  BulkAssignModal,
  AssignableUnassignedMember,
} from "./bulk-assign-modal";
import { getStatusBadgeClass, formatDate } from "@/lib/utils";

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
  unassignedMembers?: AssignableUnassignedMember[];
  plans: MembershipPlanOption[];
  detailedPlans?: PlanDetailItem[];
  branches?: { id: string; name: string }[];
  membersList?: AssignableMember[];
  canManagePlans?: boolean;
  canManageMembers?: boolean;
  selectedBranchId?: string;
  branchName?: string;
  initialTab?: "contracts" | "plans" | "unassigned" | "active" | "expired";
}

type WorkspaceTab = "unassigned" | "active" | "expired" | "plans";

export function MembershipsClient({
  gymId,
  memberships,
  unassignedMembers = [],
  plans,
  detailedPlans = [],
  branches = [],
  membersList = [],
  canManagePlans = true,
  canManageMembers = true,
  selectedBranchId,
  branchName,
  initialTab = "active",
}: MembershipsClientProps) {
  // Normalize initial tab
  const normalizedInitialTab: WorkspaceTab =
    initialTab === "plans"
      ? "plans"
      : initialTab === "unassigned"
      ? "unassigned"
      : initialTab === "expired"
      ? "expired"
      : "active";

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(normalizedInitialTab);

  // Sync activeTab if initialTab changes via deep-link navigation
  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("all");

  // Selection state for Unassigned view
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Modals state
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [bulkAssignMembers, setBulkAssignMembers] = useState<AssignableUnassignedMember[]>([]);
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

  // Active contracts filter
  const activeContracts = useMemo(() => {
    return memberships.filter((m) => {
      if (m.status !== "active") return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          m.memberName.toLowerCase().includes(term) ||
          m.memberPhone.includes(term) ||
          m.planName.toLowerCase().includes(term) ||
          m.branchName.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (selectedPlanFilter !== "all" && m.planId !== selectedPlanFilter) {
        return false;
      }
      return true;
    });
  }, [memberships, searchTerm, selectedPlanFilter]);

  // Expired contracts filter (strictly separated from unassigned)
  const expiredContracts = useMemo(() => {
    return memberships.filter((m) => {
      if (m.status !== "expired") return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          m.memberName.toLowerCase().includes(term) ||
          m.memberPhone.includes(term) ||
          m.planName.toLowerCase().includes(term) ||
          m.branchName.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (selectedPlanFilter !== "all" && m.planId !== selectedPlanFilter) {
        return false;
      }
      return true;
    });
  }, [memberships, searchTerm, selectedPlanFilter]);

  // Filtered Unassigned Members
  const filteredUnassignedMembers = useMemo(() => {
    return unassignedMembers.filter((m) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          m.fullName.toLowerCase().includes(term) ||
          m.phone.includes(term) ||
          m.branchName.toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [unassignedMembers, searchTerm]);

  // Unassigned selection handlers
  const allVisibleSelected =
    filteredUnassignedMembers.length > 0 &&
    filteredUnassignedMembers.every((m) => selectedMemberIds.has(m.id));

  function handleToggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedMemberIds(new Set());
    } else {
      const next = new Set(selectedMemberIds);
      filteredUnassignedMembers.forEach((m) => next.add(m.id));
      setSelectedMemberIds(next);
    }
  }

  function handleToggleMember(id: string) {
    const next = new Set(selectedMemberIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMemberIds(next);
  }

  function handleOpenBulkAssign(membersToAssign: AssignableUnassignedMember[]) {
    setBulkAssignMembers(membersToAssign);
    setBulkAssignModalOpen(true);
  }

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

  function handleBulkAssignSuccess() {
    setSelectedMemberIds(new Set());
    setSuccessNotice("Bulk plan assignment completed successfully! Contracts updated.");
    setTimeout(() => {
      setSuccessNotice(null);
      window.location.reload();
    }, 1500);
  }

  const selectedUnassignedList = useMemo(() => {
    return unassignedMembers.filter((m) => selectedMemberIds.has(m.id));
  }, [unassignedMembers, selectedMemberIds]);

  return (
    <div className="space-y-6 text-foreground">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Memberships & Plans Workspace
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">
            Assign plans to unassigned members, track active contracts, and manage plan pricing tiers
          </p>
        </div>

        {/* Global Quick Action button */}
        <div className="flex items-center gap-2">
          {canManageMembers && membersList.length > 0 && (
            <button
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Assign Plan (Single)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 bg-muted/60 rounded-2xl w-full sm:w-fit border border-border/60">
        {/* Unassigned Tab */}
        <button
          onClick={() => {
            setActiveTab("unassigned");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "unassigned"
              ? "bg-card text-foreground shadow-xs border border-border"
              : unassignedMembers.length > 0
              ? "text-amber-600 dark:text-amber-400 hover:text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Unassigned</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              unassignedMembers.length > 0
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {unassignedMembers.length}
          </span>
        </button>

        {/* Active Contracts Tab */}
        <button
          onClick={() => {
            setActiveTab("active");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "active"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <IdCard className="w-4 h-4" />
          <span>Active Contracts</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
            {stats.active}
          </span>
        </button>

        {/* Expired Contracts Tab */}
        <button
          onClick={() => {
            setActiveTab("expired");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "expired"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Expired</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-600 font-bold">
            {stats.expired}
          </span>
        </button>

        {/* Plans Studio Tab */}
        <button
          onClick={() => {
            setActiveTab("plans");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "plans"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Plans Studio</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-bold">
            {detailedPlans.length}
          </span>
        </button>
      </div>

      {/* Success alert */}
      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
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

      {/* TAB 1: UNASSIGNED MEMBERS QUEUE */}
      {activeTab === "unassigned" && (
        <div className="space-y-4">
          {/* Action bar and Search */}
          <div className="bg-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-card-foreground">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  Unassigned Members Queue ({unassignedMembers.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Members with zero contract history awaiting initial plan assignment
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search unassigned..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>

              {canManageMembers && filteredUnassignedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-border bg-muted/30 text-xs font-bold text-foreground hover:bg-muted cursor-pointer shrink-0"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span>{allVisibleSelected ? "Deselect All" : "Select All"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Unassigned Table / Cards */}
          <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
            {filteredUnassignedMembers.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  {searchTerm ? "No Matching Unassigned Members" : "All Members Have Contracts"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm
                    ? "Try adjusting your search criteria."
                    : "There are currently no members awaiting plan assignment in this branch context."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setActiveTab("active")}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-colors cursor-pointer"
                  >
                    View Active Contracts
                  </button>
                  <Link
                    href={`/app/${gymId}/members`}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-xs transition-opacity"
                  >
                    Enroll or Import Members
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                    <tr>
                      <th className="px-4 py-3.5 w-10">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          aria-label="Select all unassigned members"
                          className="cursor-pointer"
                        >
                          {allVisibleSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3.5">Member Name</th>
                      <th className="px-4 py-3.5">Phone</th>
                      <th className="px-4 py-3.5">Branch</th>
                      <th className="px-4 py-3.5">Added Date</th>
                      <th className="px-4 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {filteredUnassignedMembers.map((m) => {
                      const isChecked = selectedMemberIds.has(m.id);
                      return (
                        <tr
                          key={m.id}
                          className={`transition-colors cursor-pointer ${
                            isChecked ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                          }`}
                          onClick={() => handleToggleMember(m.id)}
                        >
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleMember(m.id)}
                              className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 font-bold text-foreground">
                            <Link
                              href={`/app/${gymId}/members/${m.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-primary transition-colors flex items-center gap-1.5 group"
                            >
                              <span>{m.fullName}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground font-medium">
                            {m.phone}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                              <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span>{m.branchName}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            {formatDate(m.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            {canManageMembers && (
                              <button
                                type="button"
                                onClick={() => handleOpenBulkAssign([m])}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold shadow-xs transition-opacity cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Assign Plan</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky Action Bar when items selected */}
          {selectedMemberIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur-md border border-border shadow-2xl px-5 py-3 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-xs font-bold text-foreground">
                <span className="text-primary font-black">{selectedMemberIds.size}</span> member(s) selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberIds(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer font-semibold"
                >
                  Deselect
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenBulkAssign(selectedUnassignedList)}
                  className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md cursor-pointer hover:opacity-95"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Assign Plan to {selectedMemberIds.size} Members</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE CONTRACTS */}
      {activeTab === "active" && (
        <div className="space-y-4">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xs text-card-foreground">
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Active Contracts</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-foreground mt-1 truncate">
                {stats.active}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">In good standing</div>
            </div>

            <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xs text-card-foreground">
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Expiring (7d)</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-amber-600 mt-1 truncate">
                {stats.expiring}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Due for renewal</div>
            </div>

            <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xs text-card-foreground">
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Expired Contracts</span>
                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-rose-600 mt-1 truncate">
                {stats.expired}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">In Expired tab</div>
            </div>

            <div className="p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xs text-card-foreground">
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider truncate">
                <span className="truncate">Pending Dues</span>
                <CreditCard className="w-3.5 h-3.5 text-primary shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-foreground mt-1 truncate">
                ₹{stats.totalOutstanding.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Active balances</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-card-foreground">
            <div className="text-xs font-bold text-foreground">
              Active Member Contracts ({activeContracts.length})
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search member, phone, plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>

              {plans.length > 0 && (
                <select
                  value={selectedPlanFilter}
                  onChange={(e) => setSelectedPlanFilter(e.target.value)}
                  className="h-10 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                  aria-label="Filter by membership plan"
                >
                  <option value="all">All Plans</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Active Contracts Table */}
          <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
            {activeContracts.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <IdCard className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No Active Contracts Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm || selectedPlanFilter !== "all"
                    ? "No active contracts match your search."
                    : "No members currently have active subscriptions in this branch."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
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
                  <tbody className="divide-y divide-border text-foreground">
                    {activeContracts.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/app/${gymId}/members/${m.memberId}`}
                            className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
                          >
                            <span>{m.memberName}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{m.memberPhone}</div>
                        </td>

                        <td className="px-4 py-3.5 text-muted-foreground font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                            <span>{m.branchName}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">{m.planName}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            ₹{m.planPrice.toLocaleString("en-IN")} &bull; {m.durationDays} days
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-foreground font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>{m.startDate} &rarr; {m.endDate}</span>
                          </div>
                          <div className="text-[11px] mt-0.5 font-bold">
                            {m.isExpiringSoon ? (
                              <span className="text-amber-600">
                                Expires in {m.daysRemaining} {m.daysRemaining === 1 ? "day" : "days"}
                              </span>
                            ) : (
                              <span className="text-emerald-600">{m.daysRemaining} days left</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
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

                        <td className="px-4 py-3.5">
                          <span className={getStatusBadgeClass(m.status)}>{m.status}</span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
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
                              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="View member payments"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </Link>
                            <Link
                              href={`/app/${gymId}/members/${m.memberId}`}
                              className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                              title="Open member profile"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXPIRED CONTRACTS */}
      {activeTab === "expired" && (
        <div className="space-y-4">
          <div className="bg-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-card-foreground">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  Expired Contracts ({expiredContracts.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Members with lapsed memberships requiring renewal follow-up
                </p>
              </div>
            </div>

            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search expired members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
            {expiredContracts.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No Expired Contracts</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  All active gym contracts are currently in good standing!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Member</th>
                      <th className="px-4 py-3.5">Branch</th>
                      <th className="px-4 py-3.5">Previous Plan</th>
                      <th className="px-4 py-3.5">Ended On</th>
                      <th className="px-4 py-3.5">Balance</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {expiredContracts.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/app/${gymId}/members/${m.memberId}`}
                            className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
                          >
                            <span>{m.memberName}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{m.memberPhone}</div>
                        </td>

                        <td className="px-4 py-3.5 text-muted-foreground">
                          {m.branchName}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">{m.planName}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            ₹{m.planPrice.toLocaleString("en-IN")}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-rose-600 font-bold">{m.endDate}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Expired {Math.abs(m.daysRemaining)} days ago
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {m.totalDue > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              Due: ₹{m.totalDue.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Cleared</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleOpenRenew(m)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-xs shadow-xs transition-opacity cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Renew Plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PLANS STUDIO */}
      {activeTab === "plans" && (
        <PlansManagerClient
          gymId={gymId}
          plans={detailedPlans}
          branches={branches}
          canManagePlans={canManagePlans}
          selectedBranchId={selectedBranchId}
        />
      )}

      {/* Modals */}
      {/* 1. Bulk Assign Modal */}
      <BulkAssignModal
        gymId={gymId}
        selectedMembers={bulkAssignMembers}
        plans={detailedPlans}
        isOpen={bulkAssignModalOpen}
        onClose={() => setBulkAssignModalOpen(false)}
        onSuccess={handleBulkAssignSuccess}
      />

      {/* 2. Renew Membership Modal */}
      {targetMembership && (
        <RenewMembershipModal
          gymId={gymId}
          branchId={targetMembership.branchId}
          memberId={targetMembership.memberId}
          memberName={targetMembership.memberName}
          currentPlanId={targetMembership.planId}
          plans={plans}
          isOpen={renewModalOpen}
          onClose={() => {
            setRenewModalOpen(false);
            setTargetMembership(null);
          }}
          onSuccess={handleRenewSuccess}
        />
      )}

      {/* 3. Assign Membership Modal (Single) */}
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
