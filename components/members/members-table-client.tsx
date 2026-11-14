"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Clock,
  AlertCircle,
  Building2,
} from "lucide-react";
import { getStatusBadgeClass } from "@/lib/utils";

export interface MemberListItem {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  userId?: string | null;
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

export function MembersTableClient({
  gymId,
  members,
  branches,
}: MembersTableClientProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "active" | "expiring_soon" | "expired_or_none"
  >("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Branch filter
      if (selectedBranch !== "all" && m.branchName !== selectedBranch) {
        return false;
      }

      // Status / Plan filter
      if (filterType === "active") {
        if (!m.activePlan || m.activePlan.isExpired) return false;
      } else if (filterType === "expiring_soon") {
        if (!m.activePlan || !m.activePlan.isExpiringSoon) return false;
      } else if (filterType === "expired_or_none") {
        if (m.activePlan && !m.activePlan.isExpired) return false;
      }

      // Search term
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    });
  }, [members, search, filterType, selectedBranch]);

  return (
    <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
      {/* Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full h-11 pl-10 pr-4 bg-muted/50 border border-input rounded-xl text-xs sm:text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
          />
        </div>

        {/* Filter Badges & Branch Select */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-muted/60 p-1 rounded-xl text-xs border border-border/60">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === "all"
                  ? "bg-card text-foreground shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({members.length})
            </button>
            <button
              onClick={() => setFilterType("active")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === "active"
                  ? "bg-card text-emerald-600 shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active Plan
            </button>
            <button
              onClick={() => setFilterType("expiring_soon")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === "expiring_soon"
                  ? "bg-card text-amber-600 shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Expiring Soon
            </button>
            <button
              onClick={() => setFilterType("expired_or_none")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === "expired_or_none"
                  ? "bg-card text-rose-600 shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              No / Expired
            </button>
          </div>

          {branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-11 px-3 bg-muted/50 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
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

      {/* Table */}
      <div className="overflow-x-auto">
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
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                  {members.length === 0
                    ? 'No members registered yet. Click "Quick Enroll Member" to onboard.'
                    : "No members match the selected filters or search query."}
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const cleanPhone = member.phone.replace(/\D/g, "");
                const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                const waShare = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `Hello ${member.fullName}! 💪\nHere is your link to access your Member Portal:\n${
                    typeof window !== "undefined" ? window.location.origin : ""
                  }/portal/${gymId}/dashboard`
                )}`;

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="p-4 pl-5 whitespace-nowrap">
                      <Link
                        href={`/app/${gymId}/members/${member.id}`}
                        className="flex items-center gap-3 font-bold text-foreground hover:text-primary transition-colors text-base"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{member.fullName}</span>
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </div>
                          {member.status !== "active" && (
                            <span className="text-xs text-rose-600 uppercase font-bold">
                              {member.status}
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    <td className="p-4 font-medium text-muted-foreground whitespace-nowrap">
                      <div className="text-foreground font-semibold text-sm">{member.phone}</div>
                      {member.email && (
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      )}
                    </td>

                    <td className="p-4 whitespace-nowrap text-muted-foreground font-medium">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                        {member.branchName}
                      </span>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          member.activePlan && !member.activePlan.isExpired
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {member.activePlan ? member.activePlan.name : "No Plan"}
                      </span>
                    </td>

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
                            Expires {member.activePlan.endDate} ({member.activePlan.daysLeft}d)
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

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

                    <td className="p-4 pr-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
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
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl font-bold text-sm transition-all shadow-2xs"
                        >
                          Profile 360 &rarr;
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

      {/* Footer */}
      <div className="p-4 bg-muted/30 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
        <div>
          Showing <span className="font-bold text-foreground">{filteredMembers.length}</span> of <span className="font-bold text-foreground">{members.length}</span> members
        </div>
      </div>
    </div>
  );
}
