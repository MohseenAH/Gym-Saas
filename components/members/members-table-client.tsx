"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Clock,
  AlertCircle,
  Building2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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

  return (
    <div className="space-y-4 text-foreground">
      {/* 1. Unified 5-Stat Interactive Filter Bar */}
      <div className="rounded-2xl sm:rounded-3xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden">
        {/* Desktop: 5-column divided grid */}
        <div className="hidden sm:grid grid-cols-5 divide-x divide-border">
          <button
            type="button"
            onClick={() => {
              setFilterType("all");
              setCurrentPage(1);
            }}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              filterType === "all"
                ? "bg-muted/80 ring-inset ring-2 ring-primary"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Members
            </div>
            <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
              {stats.total}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("active");
              setCurrentPage(1);
            }}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              filterType === "active"
                ? "bg-emerald-500/10 ring-inset ring-2 ring-emerald-500"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 truncate">
              Active Plans
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
              {stats.active}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("expiring");
              setCurrentPage(1);
            }}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              filterType === "expiring"
                ? "bg-amber-500/10 ring-inset ring-2 ring-amber-500"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 truncate">
              Expiring (7d)
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
              {stats.expiring}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("expired");
              setCurrentPage(1);
            }}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              filterType === "expired"
                ? "bg-rose-500/10 ring-inset ring-2 ring-rose-500"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-rose-600 truncate">
              Expired
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
              {stats.expired}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("unassigned");
              setCurrentPage(1);
            }}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer flex flex-col justify-between ${
              filterType === "unassigned"
                ? "bg-blue-500/10 ring-inset ring-2 ring-blue-500"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600 truncate">
              Unassigned
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
              {stats.unassigned}
            </div>
          </button>
        </div>

        {/* Mobile: Compact 5-column horizontal stat strip (count above label) */}
        <div className="sm:hidden grid grid-cols-5 divide-x divide-border">
          <button
            type="button"
            onClick={() => {
              setFilterType("all");
              setCurrentPage(1);
            }}
            className={`p-2.5 text-center transition-colors cursor-pointer ${
              filterType === "all" ? "bg-muted/80 font-bold" : "hover:bg-muted/30"
            }`}
          >
            <div className="text-base font-black text-foreground">{stats.total}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Total</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("active");
              setCurrentPage(1);
            }}
            className={`p-2.5 text-center transition-colors cursor-pointer ${
              filterType === "active" ? "bg-emerald-500/10 font-bold" : "hover:bg-muted/30"
            }`}
          >
            <div className="text-base font-black text-emerald-600">{stats.active}</div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Active</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("expiring");
              setCurrentPage(1);
            }}
            className={`p-2.5 text-center transition-colors cursor-pointer ${
              filterType === "expiring" ? "bg-amber-500/10 font-bold" : "hover:bg-muted/30"
            }`}
          >
            <div className="text-base font-black text-amber-600">{stats.expiring}</div>
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Expiring</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("expired");
              setCurrentPage(1);
            }}
            className={`p-2.5 text-center transition-colors cursor-pointer ${
              filterType === "expired" ? "bg-rose-500/10 font-bold" : "hover:bg-muted/30"
            }`}
          >
            <div className="text-base font-black text-rose-600">{stats.expired}</div>
            <div className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">Expired</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType("unassigned");
              setCurrentPage(1);
            }}
            className={`p-2.5 text-center transition-colors cursor-pointer ${
              filterType === "unassigned" ? "bg-blue-500/10 font-bold" : "hover:bg-muted/30"
            }`}
          >
            <div className="text-base font-black text-blue-600">{stats.unassigned}</div>
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">None</div>
          </button>
        </div>
      </div>

      {/* 2. Main Content Card (Search, Table, Mobile Cards, Pagination) */}
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

          {/* Filter Pills & Branch Dropdown */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl text-xs border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFilterType("all");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType("active");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === "active"
                    ? "bg-card text-emerald-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType("expiring");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === "expiring"
                    ? "bg-card text-amber-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Expiring
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType("expired");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === "expired"
                    ? "bg-card text-rose-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Expired
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType("unassigned");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === "unassigned"
                    ? "bg-card text-blue-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unassigned
              </button>
            </div>

            {branches.length > 1 && (
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 sm:h-11 px-3 bg-muted/50 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer shrink-0"
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
                  <td colSpan={7} className="p-10 text-center text-muted-foreground font-medium">
                    {members.length === 0
                      ? 'No members registered yet. Click "+ Add Member" to onboard.'
                      : "No members match the selected filters or search query."}
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

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Member Name (Avatar + Name + #ID) */}
                      <td className="p-4 pl-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                            {member.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/app/${gymId}/members/${member.id}`}
                                className="font-bold text-foreground hover:text-primary transition-colors text-base"
                              >
                                {member.fullName}
                              </Link>
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                                #{shortId}
                              </span>
                            </div>
                            {member.status !== "active" && (
                              <span className="text-xs text-rose-600 uppercase font-bold">
                                {member.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-4 font-medium text-muted-foreground whitespace-nowrap">
                        <div className="text-foreground font-semibold text-sm">{member.phone}</div>
                        {member.email && (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="p-4 whitespace-nowrap text-muted-foreground font-medium">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                          {member.branchName}
                        </span>
                      </td>

                      {/* Current Plan (Plan name + days remaining subtext) */}
                      <td className="p-4 whitespace-nowrap">
                        {member.activePlan ? (
                          <div>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 inline-block">
                              {member.activePlan.name}
                            </span>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {member.activePlan.isExpired
                                ? "Expired"
                                : `${member.activePlan.daysLeft}d remaining`}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-muted text-muted-foreground border border-border">
                            No Plan
                          </span>
                        )}
                      </td>

                      {/* Validity Status Badge */}
                      <td className="p-4 whitespace-nowrap">
                        {member.activePlan ? (
                          member.activePlan.isExpired ? (
                            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Expired ({member.activePlan.endDate})
                            </span>
                          ) : member.activePlan.isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                              <Clock className="w-3.5 h-3.5" />
                              {member.activePlan.daysLeft}d left ({member.activePlan.endDate})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                              Expires {member.activePlan.endDate}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs font-medium">Unassigned</span>
                        )}
                      </td>

                      {/* Portal Status Badge */}
                      <td className="p-4 whitespace-nowrap">
                        {member.userId ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold text-xs border border-primary/20">
                            <ShieldCheck className="w-3 h-3" />
                            Connected
                          </span>
                        ) : member.hasPendingInvite ? (
                          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full font-bold text-xs border border-amber-500/20">
                            Invite Sent
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full font-medium text-xs border border-border">
                            Not Claimed
                          </span>
                        )}
                      </td>

                      {/* Actions: Edit Info + 360 Profile + WhatsApp */}
                      <td className="p-4 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMember(member)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                            title="Edit Member Information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={waShare}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white rounded-xl transition-all shadow-2xs"
                            title="Share Portal link via WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                          <Link
                            href={`/app/${gymId}/members/${member.id}`}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl font-bold text-xs transition-all shadow-2xs inline-flex items-center gap-1"
                          >
                            <span>Profile 360</span>
                            <ArrowRight className="w-3 h-3" />
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

        {/* Mobile Presentation: High-Density Cards (md:hidden) */}
        <div className="md:hidden divide-y divide-border">
          {paginatedMembers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm font-medium">
              {members.length === 0
                ? 'No members registered yet. Click "+ Add Member" to onboard.'
                : "No members match the selected filters or search query."}
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

              return (
                <div key={member.id} className="p-3.5 space-y-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2.5">
                    {/* Left: Avatar + Center Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                        {member.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/app/${gymId}/members/${member.id}`}
                            className="font-bold text-foreground text-sm hover:text-primary transition-colors truncate"
                          >
                            {member.fullName}
                          </Link>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/60">
                            #{shortId}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.phone} &bull; {member.branchName}
                        </div>
                        <div className="text-xs mt-0.5 truncate">
                          {member.activePlan ? (
                            <span className="font-semibold text-primary">
                              {member.activePlan.name} &bull;{" "}
                              {member.activePlan.isExpired
                                ? "Expired"
                                : `${member.activePlan.daysLeft}d left`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">No Active Plan</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Top-Right: Edit Info + WhatsApp Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingMember(member)}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Edit Info"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={waShare}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Bottom Row: Badges & 360° View Link */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {member.activePlan ? (
                        member.activePlan.isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            Expired
                          </span>
                        ) : member.activePlan.isExpiringSoon ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Expiring
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Active
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          No Plan
                        </span>
                      )}

                      {member.userId ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                          Portal ✓
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          Unclaimed
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/app/${gymId}/members/${member.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0"
                    >
                      <span>360° View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Clean Pagination Footer */}
        <div className="p-3.5 sm:p-4 bg-muted/30 border-t border-border text-xs sm:text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Showing{" "}
            <span className="font-bold text-foreground">
              {filteredMembers.length === 0 ? 0 : startIndex}
            </span>
            -
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
