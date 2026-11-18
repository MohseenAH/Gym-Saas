"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  Clock,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Users,
  CheckCircle2,
  UserMinus,
  RotateCcw,
  Mail,
  UserPlus,
} from "lucide-react";
import { EditMemberModal } from "@/components/members/edit-member-modal";

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
    isExpiringSoon: boolean; // within 7 days
  } | null;
  hasPendingInvite: boolean;
}

interface MembersTableClientProps {
  gymId: string;
  members: MemberListItem[];
  branches: { id: string; name: string }[];
}

type FilterType = "all" | "active" | "expiring" | "expired" | "unassigned";

function MiniSparkline({ color = "currentColor" }: { color?: string }) {
  return (
    <svg className="w-12 h-5 opacity-40 shrink-0" viewBox="0 0 48 16" fill="none">
      <path
        d="M0 12C8 12 12 4 20 8C28 12 36 2 48 6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getPlanSubtext(activePlan: MemberListItem["activePlan"]): { text: string; colorClass: string } {
  if (!activePlan) {
    return { text: "No plan assigned", colorClass: "text-muted-foreground" };
  }
  if (activePlan.isExpired) {
    const absDays = Math.abs(activePlan.daysLeft);
    return {
      text: absDays === 0 ? "Expired today" : `Expired ${absDays}d ago`,
      colorClass: "text-rose-600 dark:text-rose-400 font-semibold",
    };
  }
  if (activePlan.isExpiringSoon) {
    return {
      text: activePlan.daysLeft === 0 ? "Expires today" : `${activePlan.daysLeft}d left`,
      colorClass: "text-amber-600 dark:text-amber-400 font-semibold",
    };
  }
  return {
    text: `${activePlan.daysLeft}d left`,
    colorClass: "text-emerald-600 dark:text-emerald-400 font-semibold",
  };
}

function getValidityPill(activePlan: MemberListItem["activePlan"]) {
  if (!activePlan) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Unassigned
      </span>
    );
  }
  if (activePlan.isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Expired
      </span>
    );
  }
  if (activePlan.isExpiringSoon) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Expiring
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

function getPortalStatusIndicator(member: MemberListItem) {
  if (member.userId) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Enabled
      </span>
    );
  }
  if (member.hasPendingInvite) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
        <Mail className="w-3 h-3 text-amber-600" />
        Invite Sent
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs font-medium pl-3">—</span>;
}

export function MembersTableClient({
  gymId,
  members,
  branches,
}: MembersTableClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingMember, setEditingMember] = useState<MemberListItem | null>(null);
  const pageSize = 15;

  // Calculate 5 interactive summary stats
  const stats = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let unassigned = 0;

    members.forEach((m) => {
      if (!m.activePlan) {
        unassigned++;
      } else if (m.activePlan.isExpired) {
        expired++;
      } else if (m.activePlan.isExpiringSoon) {
        expiring++;
        active++;
      } else {
        active++;
      }
    });

    return {
      total: members.length,
      active,
      expiring,
      expired,
      unassigned,
    };
  }, [members]);

  // Filtered roster
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Branch filter
      if (selectedBranch !== "all" && m.branchName !== selectedBranch) {
        return false;
      }

      // Status / Plan filter
      if (filterType === "active") {
        if (!m.activePlan || m.activePlan.isExpired) return false;
      } else if (filterType === "expiring") {
        if (!m.activePlan || m.activePlan.isExpired || !m.activePlan.isExpiringSoon) return false;
      } else if (filterType === "expired") {
        if (!m.activePlan || !m.activePlan.isExpired) return false;
      } else if (filterType === "unassigned") {
        if (m.activePlan) return false;
      }

      // Search query across name, phone, email, and short ID
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

  // Pagination calculation
  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredMembers.length);

  function resetAllFilters() {
    setSearch("");
    setFilterType("all");
    setSelectedBranch("all");
    setCurrentPage(1);
  }

  return (
    <div className="space-y-4 text-foreground">
      {/* 1. Interactive 5-Stat Filter Cards */}

      {/* Desktop (hidden md:grid md:grid-cols-5 gap-3.5) */}
      <div className="hidden md:grid md:grid-cols-5 gap-3.5">
        {/* Stat 1: Total Members (Blue/Indigo) */}
        <button
          type="button"
          onClick={() => {
            setFilterType("all");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            filterType === "all"
              ? "bg-indigo-500/10 border-indigo-500/40 ring-2 ring-indigo-500/30 shadow-sm"
              : "bg-card border-border hover:border-indigo-500/30 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Members
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <div className="text-2xl sm:text-3xl font-black text-foreground tabular-nums tracking-tight">
              {stats.total}
            </div>
            <MiniSparkline color="#6366f1" />
          </div>
          <div
            className={`h-1 w-full rounded-full mt-2.5 transition-all ${
              filterType === "all" ? "bg-indigo-500" : "bg-transparent"
            }`}
          />
        </button>

        {/* Stat 2: Active (Emerald) */}
        <button
          type="button"
          onClick={() => {
            setFilterType("active");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            filterType === "active"
              ? "bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/30 shadow-sm"
              : "bg-card border-border hover:border-emerald-500/30 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Active
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
              {stats.active}
            </div>
            <MiniSparkline color="#10b981" />
          </div>
          <div
            className={`h-1 w-full rounded-full mt-2.5 transition-all ${
              filterType === "active" ? "bg-emerald-500" : "bg-transparent"
            }`}
          />
        </button>

        {/* Stat 3: Expiring (Amber) */}
        <button
          type="button"
          onClick={() => {
            setFilterType("expiring");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            filterType === "expiring"
              ? "bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/30 shadow-sm"
              : "bg-card border-border hover:border-amber-500/30 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Expiring (7d)
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
              {stats.expiring}
            </div>
            <MiniSparkline color="#f59e0b" />
          </div>
          <div
            className={`h-1 w-full rounded-full mt-2.5 transition-all ${
              filterType === "expiring" ? "bg-amber-500" : "bg-transparent"
            }`}
          />
        </button>

        {/* Stat 4: Expired (Rose) */}
        <button
          type="button"
          onClick={() => {
            setFilterType("expired");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            filterType === "expired"
              ? "bg-rose-500/10 border-rose-500/40 ring-2 ring-rose-500/30 shadow-sm"
              : "bg-card border-border hover:border-rose-500/30 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
              Expired
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tight">
              {stats.expired}
            </div>
            <MiniSparkline color="#f43f5e" />
          </div>
          <div
            className={`h-1 w-full rounded-full mt-2.5 transition-all ${
              filterType === "expired" ? "bg-rose-500" : "bg-transparent"
            }`}
          />
        </button>

        {/* Stat 5: Unassigned (Violet/Slate) */}
        <button
          type="button"
          onClick={() => {
            setFilterType("unassigned");
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            filterType === "unassigned"
              ? "bg-violet-500/10 border-violet-500/40 ring-2 ring-violet-500/30 shadow-sm"
              : "bg-card border-border hover:border-violet-500/30 hover:bg-muted/40 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
              Unassigned
            </span>
            <div className="p-2 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <UserMinus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <div className="text-2xl sm:text-3xl font-black text-violet-600 dark:text-violet-400 tabular-nums tracking-tight">
              {stats.unassigned}
            </div>
            <MiniSparkline color="#8b5cf6" />
          </div>
          <div
            className={`h-1 w-full rounded-full mt-2.5 transition-all ${
              filterType === "unassigned" ? "bg-violet-500" : "bg-transparent"
            }`}
          />
        </button>
      </div>

      {/* Mobile 5-Column Stat Filter Strip (md:hidden) */}
      <div className="md:hidden rounded-2xl border border-border bg-card p-2 shadow-xs">
        <div className="grid grid-cols-5 gap-1">
          {/* Mobile Col 1: Total */}
          <button
            type="button"
            onClick={() => {
              setFilterType("all");
              setCurrentPage(1);
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-indigo-500/15 ring-1 ring-indigo-500/30"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 tabular-nums">
              {stats.total}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground mt-1 truncate">
              Total
            </span>
          </button>

          {/* Mobile Col 2: Active */}
          <button
            type="button"
            onClick={() => {
              setFilterType("active");
              setCurrentPage(1);
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              filterType === "active"
                ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 tabular-nums">
              {stats.active}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">
              Active
            </span>
          </button>

          {/* Mobile Col 3: Expiring */}
          <button
            type="button"
            onClick={() => {
              setFilterType("expiring");
              setCurrentPage(1);
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              filterType === "expiring"
                ? "bg-amber-500/15 ring-1 ring-amber-500/30"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 tabular-nums">
              {stats.expiring}
            </span>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-1 truncate">
              Expiring
            </span>
          </button>

          {/* Mobile Col 4: Expired */}
          <button
            type="button"
            onClick={() => {
              setFilterType("expired");
              setCurrentPage(1);
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              filterType === "expired"
                ? "bg-rose-500/15 ring-1 ring-rose-500/30"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-700 dark:text-rose-300 tabular-nums">
              {stats.expired}
            </span>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 mt-1 truncate">
              Expired
            </span>
          </button>

          {/* Mobile Col 5: Unassigned */}
          <button
            type="button"
            onClick={() => {
              setFilterType("unassigned");
              setCurrentPage(1);
            }}
            className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              filterType === "unassigned"
                ? "bg-violet-500/15 ring-1 ring-violet-500/30"
                : "hover:bg-muted/50"
            }`}
          >
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-violet-500/20 text-violet-700 dark:text-violet-300 tabular-nums">
              {stats.unassigned}
            </span>
            <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 mt-1 truncate">
              Unassigned
            </span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Container (Search & Filter Pills Toolbar + Table / Cards + Pagination) */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
        {/* Search & Filter Toolbar */}
        <div className="p-3.5 sm:p-5 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name, phone, or ID..."
              className="w-full h-10 sm:h-11 pl-10 pr-4 bg-muted/50 border border-input rounded-xl text-xs sm:text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
            />
          </div>

          {/* Filter Pills with Live Count Badges & Branch Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 shrink-0">
              {/* All Pill */}
              <button
                type="button"
                onClick={() => {
                  setFilterType("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "all"
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>All</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterType === "all"
                      ? "bg-white/20 text-white"
                      : "bg-card text-muted-foreground border border-border/60"
                  }`}
                >
                  {stats.total}
                </span>
              </button>

              {/* Active Pill */}
              <button
                type="button"
                onClick={() => {
                  setFilterType("active");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "active"
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Active</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterType === "active"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {stats.active}
                </span>
              </button>

              {/* Expiring Pill */}
              <button
                type="button"
                onClick={() => {
                  setFilterType("expiring");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "expiring"
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Expiring</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterType === "expiring"
                      ? "bg-white/20 text-white"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {stats.expiring}
                </span>
              </button>

              {/* Expired Pill */}
              <button
                type="button"
                onClick={() => {
                  setFilterType("expired");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "expired"
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Expired</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterType === "expired"
                      ? "bg-white/20 text-white"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {stats.expired}
                </span>
              </button>

              {/* Unassigned Pill */}
              <button
                type="button"
                onClick={() => {
                  setFilterType("unassigned");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "unassigned"
                    ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Unassigned</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterType === "unassigned"
                      ? "bg-white/20 text-white"
                      : "bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20"
                  }`}
                >
                  {stats.unassigned}
                </span>
              </button>
            </div>

            {branches.length > 1 && (
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-3 bg-muted/60 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer shrink-0 ml-1"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Desktop Presentation: Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-xs">
              <tr>
                <th className="p-4 pl-5">Member Name</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Current Plan</th>
                <th className="p-4">Validity Status</th>
                <th className="p-4">Portal Status</th>
                <th className="p-4 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="text-base font-bold text-foreground">
                        {members.length === 0
                          ? "No members registered yet"
                          : "No members match the selected filters"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {members.length === 0
                          ? "Click '+ Add Member' or 'Import CSV' above to onboard your gym members."
                          : "Try adjusting your search query or reset your filter pills."}
                      </p>
                      {members.length > 0 && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => {
                  const cleanPhone = member.phone.replace(/\D/g, "");
                  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                  const waShare = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                    `Hello ${member.fullName}! 💪\nHere is your link to access your Member Portal:\n${
                      typeof window !== "undefined" ? window.location.origin : ""
                    }/portal/${gymId}/dashboard`
                  )}`;
                  const shortId = member.id.slice(0, 6).toUpperCase();
                  const planSub = getPlanSubtext(member.activePlan);

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Member Name (Avatar + Name with ↗ + #ID) */}
                      <td className="p-4 pl-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                            {member.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/app/${gymId}/members/${member.id}`}
                              className="font-bold text-foreground hover:text-primary transition-colors text-sm inline-flex items-center gap-1 group-hover:underline"
                            >
                              <span>{member.fullName}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            <div className="text-xs font-mono text-muted-foreground mt-0.5">
                              #{shortId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-semibold text-sm tabular-nums">
                            {member.phone}
                          </span>
                          <a
                            href={waShare}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#25D366] hover:opacity-80 p-0.5"
                            title="Send WhatsApp Link"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        {member.email && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                            {member.email}
                          </div>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="p-4 whitespace-nowrap text-muted-foreground font-medium">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                          {member.branchName}
                        </span>
                      </td>

                      {/* Current Plan */}
                      <td className="p-4 whitespace-nowrap">
                        {member.activePlan ? (
                          <div>
                            <div className="font-bold text-foreground text-sm">
                              {member.activePlan.name}
                            </div>
                            <div className={`text-xs mt-0.5 ${planSub.colorClass}`}>
                              {planSub.text}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs font-medium">
                            No Active Plan
                          </span>
                        )}
                      </td>

                      {/* Validity Status Badge */}
                      <td className="p-4 whitespace-nowrap">
                        {getValidityPill(member.activePlan)}
                      </td>

                      {/* Portal Status Badge */}
                      <td className="p-4 whitespace-nowrap">
                        {getPortalStatusIndicator(member)}
                      </td>

                      {/* Actions: Edit Info + 360° Profile */}
                      <td className="p-4 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMember(member)}
                            className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                          >
                            Edit Info
                          </button>
                          <Link
                            href={`/app/${gymId}/members/${member.id}`}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View 360° Profile"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Presentation: App-Grade Member Cards (md:hidden) */}
        <div className="md:hidden p-3.5 space-y-3">
          {paginatedMembers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-foreground">
                {members.length === 0
                  ? "No members registered yet"
                  : "No members match the selected filters"}
              </div>
              {members.length > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          ) : (
            paginatedMembers.map((member) => {
              const cleanPhone = member.phone.replace(/\D/g, "");
              const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
              const waShare = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                `Hello ${member.fullName}! 💪\nHere is your link to access your Member Portal:\n${
                  typeof window !== "undefined" ? window.location.origin : ""
                }/portal/${gymId}/dashboard`
              )}`;
              const shortId = member.id.slice(0, 6).toUpperCase();
              const planSub = getPlanSubtext(member.activePlan);

              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-2xl bg-card border border-border shadow-xs hover:shadow-sm transition-all flex items-center justify-between gap-3 ${
                    !member.activePlan
                      ? "border-l-3 border-l-slate-400"
                      : member.activePlan.isExpired
                      ? "border-l-3 border-l-rose-500"
                      : member.activePlan.isExpiringSoon
                      ? "border-l-3 border-l-amber-500"
                      : "border-l-3 border-l-emerald-500"
                  }`}
                >
                  {/* Left Column: Avatar + #ID */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20">
                      {member.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground mt-1">
                      #{shortId}
                    </span>
                  </div>

                  {/* Center Column: Name ↗ + Phone/Branch + Plan validity */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/app/${gymId}/members/${member.id}`}
                      className="font-bold text-foreground hover:text-primary transition-colors text-sm flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{member.fullName}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate tabular-nums">
                      {member.phone} &bull; {member.branchName}
                    </div>
                    <div className="text-xs mt-0.5 truncate">
                      {member.activePlan ? (
                        <span className={planSub.colorClass}>
                          {member.activePlan.name} &bull; {planSub.text}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-medium">
                          No Active Plan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Edit Info Button + 360° View & WhatsApp */}
                  <div className="flex flex-col items-end justify-between gap-2.5 shrink-0 self-stretch">
                    <button
                      type="button"
                      onClick={() => setEditingMember(member)}
                      className="h-7 px-2.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-[11px] font-semibold text-foreground transition-colors cursor-pointer"
                    >
                      Edit Info
                    </button>
                    <div className="flex items-center gap-2">
                      <a
                        href={waShare}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#25D366] hover:opacity-80 p-0.5"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                      <Link
                        href={`/app/${gymId}/members/${member.id}`}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                      >
                        <span>360° View</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Clean Pagination Footer */}
        <div className="p-3.5 sm:p-4 bg-muted/20 border-t border-border text-xs sm:text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="tabular-nums">
            Showing{" "}
            <span className="font-bold text-foreground">
              {filteredMembers.length === 0 ? 0 : startIndex}
            </span>
            –
            <span className="font-bold text-foreground">{endIndex}</span> of{" "}
            <span className="font-bold text-foreground">{filteredMembers.length}</span> members
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    );
                  })
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && page - prev > 1;

                    return (
                      <div key={page} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-7 h-7 sm:min-w-8 sm:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === page
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <EditMemberModal
          gymId={gymId}
          member={{
            id: editingMember.id,
            fullName: editingMember.fullName,
            phone: editingMember.phone,
            email: editingMember.email,
            branchId: editingMember.branchId || branches[0]?.id || "",
            status: editingMember.status,
          }}
          branches={branches}
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={() => {
            setEditingMember(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
