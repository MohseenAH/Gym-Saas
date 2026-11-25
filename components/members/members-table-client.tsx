"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  MoreVertical,
  Layers,
  Sparkles,
  Calendar,
  IndianRupee,
  ArrowRight,
  MessageSquare,
  Edit3,
  UserCheck,
  X,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { EditMemberModal } from "@/components/members/edit-member-modal";
import { QuickEnrollModal } from "@/components/members/quick-enroll-modal";
import { BulkImportModal } from "@/components/members/bulk-import-modal";

export interface MemberListItem {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  userId?: string | null;
  branchId?: string;
  branchName: string;
  activePlan?: {
    name: string;
    endDate: string;
    daysLeft: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
    isTrial?: boolean;
  } | null;
  outstandingDues?: number;
  hasPendingInvite: boolean;
}

interface MembersTableClientProps {
  gymId: string;
  branchId?: string;
  members: MemberListItem[];
  branches: { id: string; name: string }[];
  plans?: Array<{
    id: string;
    name: string;
    price: number;
    durationDays: number;
  }>;
}

type FilterType = "all" | "active" | "expiring" | "expired" | "trial" | "unassigned";

type StatusMeta = {
  label: string;
  pillClass: string;
  dotClass: string;
  accentClass: string;
};

function getMemberStatusMeta(m: MemberListItem): StatusMeta {
  if (!m.activePlan) {
    return {
      label: "Unassigned",
      pillClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
      dotClass: "bg-slate-400",
      accentClass: "bg-slate-400/70",
    };
  }
  if (m.activePlan.isExpired) {
    return {
      label: "Expired",
      pillClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
      dotClass: "bg-rose-500",
      accentClass: "bg-rose-500",
    };
  }
  if (m.activePlan.isTrial) {
    return {
      label: "Trial",
      pillClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      dotClass: "bg-purple-500",
      accentClass: "bg-purple-500",
    };
  }
  if (m.activePlan.isExpiringSoon) {
    return {
      label: "Expiring",
      pillClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
      dotClass: "bg-amber-500",
      accentClass: "bg-amber-500",
    };
  }
  return {
    label: "Active",
    pillClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dotClass: "bg-emerald-500",
    accentClass: "bg-emerald-500",
  };
}

function getExpiryDisplay(activePlan: MemberListItem["activePlan"]): {
  label: string;
  value: string;
  colorClass: string;
} {
  if (!activePlan) {
    return {
      label: "No Plan",
      value: "Assigned",
      colorClass: "text-muted-foreground",
    };
  }
  if (activePlan.isExpired) {
    const formatted = new Date(activePlan.endDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return {
      label: "Expired On",
      value: formatted,
      colorClass: "text-rose-600 dark:text-rose-400 font-semibold",
    };
  }
  if (activePlan.isTrial) {
    return {
      label: "Trial Ends In",
      value: activePlan.daysLeft === 0 ? "Today" : `${activePlan.daysLeft} days`,
      colorClass: "text-purple-600 dark:text-purple-400 font-semibold",
    };
  }
  if (activePlan.isExpiringSoon) {
    return {
      label: "Expires In",
      value: activePlan.daysLeft === 0 ? "Today" : `${activePlan.daysLeft} days`,
      colorClass: "text-amber-600 dark:text-amber-400 font-semibold",
    };
  }
  return {
    label: "Expires In",
    value: `${activePlan.daysLeft} days`,
    colorClass: "text-emerald-600 dark:text-emerald-400 font-semibold",
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MembersTableClient({
  gymId,
  branchId = "",
  members,
  branches,
  plans = [],
}: MembersTableClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingMember, setEditingMember] = useState<MemberListItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Calculate 6 interactive summary stats across complete authorized member scope
  const stats = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let trial = 0;
    let unassigned = 0;

    members.forEach((m) => {
      if (!m.activePlan) {
        unassigned++;
      } else if (m.activePlan.isExpired) {
        expired++;
      } else {
        active++;
        if (m.activePlan.isExpiringSoon) expiring++;
        if (m.activePlan.isTrial) trial++;
      }
    });

    return {
      total: members.length,
      active,
      expiring,
      expired,
      trial,
      unassigned,
    };
  }, [members]);

  // Filtered roster
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedBranch !== "all" && m.branchName !== selectedBranch) {
        return false;
      }

      if (filterType === "active") {
        if (!m.activePlan || m.activePlan.isExpired) return false;
      } else if (filterType === "expiring") {
        if (!m.activePlan || m.activePlan.isExpired || !m.activePlan.isExpiringSoon) {
          return false;
        }
      } else if (filterType === "expired") {
        if (!m.activePlan || !m.activePlan.isExpired) return false;
      } else if (filterType === "trial") {
        if (!m.activePlan || m.activePlan.isExpired || !m.activePlan.isTrial) {
          return false;
        }
      } else if (filterType === "unassigned") {
        if (m.activePlan) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const shortId = m.id.slice(0, 6).toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        shortId.includes(q)
      );
    });
  }, [members, search, filterType, selectedBranch]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMembers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, safePage, pageSize]);

  const startIndex = filteredMembers.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, filteredMembers.length);

  function handleFilterSelect(next: FilterType) {
    setFilterType((prev) => (prev === next && next !== "all" ? "all" : next));
    setCurrentPage(1);
  }

  function resetAllFilters() {
    setSearch("");
    setFilterType("all");
    setSelectedBranch("all");
    setCurrentPage(1);
  }

  const effectiveBranchId = branchId || branches[0]?.id || "";

  return (
    <div className="space-y-4 text-foreground">
      {/* 1. Six Compact Interactive KPI Cards */}
      <section
        aria-label="Member summary"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3"
      >
        <KpiCard
          compact
          label="Total Members"
          value={stats.total.toLocaleString("en-IN")}
          variant="purple"
          icon={<Users className="w-4 h-4" />}
          active={filterType === "all"}
          onClick={() => handleFilterSelect("all")}
        />
        <KpiCard
          compact
          label="Active"
          value={stats.active.toLocaleString("en-IN")}
          variant="green"
          icon={<CheckCircle2 className="w-4 h-4" />}
          active={filterType === "active"}
          onClick={() => handleFilterSelect("active")}
        />
        <KpiCard
          compact
          label="Expiring"
          value={stats.expiring.toLocaleString("en-IN")}
          variant="amber"
          icon={<Clock className="w-4 h-4" />}
          active={filterType === "expiring"}
          onClick={() => handleFilterSelect("expiring")}
        />
        <KpiCard
          compact
          label="Expired"
          value={stats.expired.toLocaleString("en-IN")}
          variant="red"
          icon={<AlertCircle className="w-4 h-4" />}
          active={filterType === "expired"}
          onClick={() => handleFilterSelect("expired")}
        />
        <KpiCard
          compact
          label="Trial"
          value={stats.trial.toLocaleString("en-IN")}
          variant="purple"
          icon={<Sparkles className="w-4 h-4" />}
          active={filterType === "trial"}
          onClick={() => handleFilterSelect("trial")}
        />
        <KpiCard
          compact
          label="Unassigned"
          value={stats.unassigned.toLocaleString("en-IN")}
          variant="slate"
          icon={<Layers className="w-4 h-4" />}
          active={filterType === "unassigned"}
          onClick={() => handleFilterSelect("unassigned")}
        />
      </section>

      {/* 2. Search & Actions Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search member by name, phone, or member ID..."
              aria-label="Search members"
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 shrink-0">
            <BulkImportModal
              gymId={gymId}
              branchId={effectiveBranchId}
              branches={branches}
              triggerLabel="Import CSV"
              triggerClassName="h-10 px-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-card hover:bg-muted text-foreground text-xs sm:text-sm font-semibold border border-border shadow-xs transition-all cursor-pointer flex-1 sm:flex-initial"
            />
            <QuickEnrollModal
              gymId={gymId}
              branchId={effectiveBranchId}
              plans={plans}
              triggerLabel="Add Member"
              triggerClassName="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:opacity-95 active:scale-[0.99] text-primary-foreground text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer flex-1 sm:flex-initial"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
              className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 ${
                showFilters || selectedBranch !== "all" || filterType !== "all"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Filter Strip */}
        {showFilters && (
          <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "active", "expiring", "expired", "trial", "unassigned"] as FilterType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFilterType(t);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      filterType === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              {branches.length > 1 && (
                <select
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by branch"
                  className="h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              {(filterType !== "all" || selectedBranch !== "all" || search) && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Empty State */}
      {filteredMembers.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {members.length === 0 ? "No members yet" : "No matching members found"}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {members.length === 0
              ? "Add your first member or import a CSV roster to get started."
              : "Try adjusting your search query or clearing active filters."}
          </p>
          {members.length > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 transition-opacity cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 4. Desktop Horizontal Member Rows */}
          <div className="hidden md:flex flex-col gap-2.5">
            {paginatedMembers.map((m) => {
              const statusMeta = getMemberStatusMeta(m);
              const expiry = getExpiryDisplay(m.activePlan);
              const dues = m.outstandingDues ?? 0;
              const shortId = `#MBR-${m.id.slice(0, 4).toUpperCase()}`;

              return (
                <div
                  key={m.id}
                  className="relative bg-card border border-border hover:border-primary/40 rounded-2xl px-4 py-3 shadow-xs transition-all flex items-center justify-between gap-4 overflow-visible"
                >
                  {/* Subtle status-colored left accent */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full ${statusMeta.accentClass}`}
                  />

                  {/* Member Identity */}
                  <div className="flex items-center gap-3 min-w-[200px] flex-1 pl-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                      {getInitials(m.fullName)}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/app/${gymId}/members/${m.id}`}
                        className="text-sm font-bold text-foreground hover:text-primary transition-colors truncate block"
                      >
                        {m.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground tabular-nums truncate">
                        {shortId} · {m.phone}
                      </div>
                    </div>
                  </div>

                  {/* Plan */}
                  <div className="min-w-[120px]">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>Plan</span>
                    </div>
                    <div className="text-xs font-bold text-foreground truncate">
                      {m.activePlan ? m.activePlan.name : "—"}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div className="min-w-[120px]">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{expiry.label}</span>
                    </div>
                    <div className={`text-xs ${expiry.colorClass}`}>{expiry.value}</div>
                  </div>

                  {/* Dues */}
                  <div className="min-w-[85px]">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" />
                      <span>Dues</span>
                    </div>
                    <div
                      className={`text-xs font-bold tabular-nums ${
                        dues > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      ₹{dues.toLocaleString("en-IN")}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="min-w-[110px] flex justify-start">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.pillClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Primary Action + Overflow Menu */}
                  <div className="flex items-center gap-2 shrink-0 relative">
                    {!m.activePlan ? (
                      <Link
                        href={`/app/${gymId}/memberships?tab=unassigned`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 text-xs font-bold transition-colors"
                      >
                        <span>Assign Plan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        href={`/app/${gymId}/members/${m.id}`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 text-xs font-bold transition-colors"
                      >
                        <span>View Profile</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                      aria-label={`More actions for ${m.fullName}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === m.id && (
                      <div className="absolute right-0 top-10 z-30 w-44 rounded-xl bg-popover border border-border shadow-lg py-1 text-xs">
                        <Link
                          href={`/app/${gymId}/members/${m.id}`}
                          onClick={() => setOpenMenuId(null)}
                          className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                          <span>View Profile</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setEditingMember(m);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Edit Member</span>
                        </button>
                        <a
                          href={`https://wa.me/${m.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpenMenuId(null)}
                          className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Mobile Compact Member Cards */}
          <div className="md:hidden flex flex-col gap-2.5">
            {paginatedMembers.map((m) => {
              const statusMeta = getMemberStatusMeta(m);
              const expiry = getExpiryDisplay(m.activePlan);
              const dues = m.outstandingDues ?? 0;
              const shortId = `#MBR-${m.id.slice(0, 4).toUpperCase()}`;

              return (
                <div
                  key={m.id}
                  onClick={() => router.push(`/app/${gymId}/members/${m.id}`)}
                  className="relative bg-card border border-border rounded-2xl p-3.5 shadow-xs space-y-2.5 cursor-pointer active:scale-[0.99] transition-all"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${statusMeta.accentClass}`}
                  />

                  {/* Upper Section */}
                  <div className="flex items-center justify-between gap-2 pl-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                        {getInitials(m.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">
                          {m.fullName}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {shortId}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.pillClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                        {statusMeta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        aria-label={`More actions for ${m.fullName}`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === m.id && (
                        <div className="absolute right-0 top-8 z-30 w-40 rounded-xl bg-popover border border-border shadow-lg py-1 text-xs">
                          <Link
                            href={`/app/${gymId}/members/${m.id}`}
                            onClick={() => setOpenMenuId(null)}
                            className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-primary" />
                            <span>View Profile</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setEditingMember(m);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted text-left cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Edit Member</span>
                          </button>
                          {!m.activePlan && (
                            <Link
                              href={`/app/${gymId}/memberships?tab=unassigned`}
                              onClick={() => setOpenMenuId(null)}
                              className="flex items-center gap-2 px-3 py-2 text-primary font-semibold hover:bg-muted"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Assign Plan</span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lower Section */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs pl-1">
                    <div className="flex items-center gap-1 text-foreground font-semibold truncate">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {m.activePlan ? m.activePlan.name : "No Plan"}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 shrink-0 ${expiry.colorClass}`}>
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{expiry.value}</span>
                    </div>
                    <div
                      className={`font-bold tabular-nums shrink-0 ${
                        dues > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      ₹{dues.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 6. Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-bold text-foreground">{startIndex}–{endIndex}</span> of{" "}
              <span className="font-bold text-foreground">{filteredMembers.length}</span> members
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center text-foreground disabled:opacity-40 hover:bg-muted cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 font-semibold text-foreground tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                  className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center text-foreground disabled:opacity-40 hover:bg-muted cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                  className="h-8 px-2 rounded-lg bg-card border border-border text-foreground font-semibold"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <EditMemberModal
          isOpen={true}
          onClose={() => setEditingMember(null)}
          gymId={gymId}
          member={{
            id: editingMember.id,
            fullName: editingMember.fullName,
            phone: editingMember.phone,
            email: editingMember.email,
            status: editingMember.status,
            branchId: editingMember.branchId || effectiveBranchId,
          }}
          branches={branches}
        />
      )}
    </div>
  );
}
