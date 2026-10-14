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
} from "lucide-react";

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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Badges & Branch Select */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                filterType === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({members.length})
            </button>
            <button
              onClick={() => setFilterType("active")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                filterType === "active"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Plan
            </button>
            <button
              onClick={() => setFilterType("expiring_soon")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                filterType === "expiring_soon"
                  ? "bg-white text-amber-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Expiring Soon
            </button>
            <button
              onClick={() => setFilterType("expired_or_none")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                filterType === "expired_or_none"
                  ? "bg-white text-red-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              No / Expired Plan
            </button>
          </div>

          {branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3.5 pl-4">Member Name</th>
              <th className="p-3.5">Contact</th>
              <th className="p-3.5">Branch</th>
              <th className="p-3.5">Current Plan</th>
              <th className="p-3.5">Validity Status</th>
              <th className="p-3.5">Portal Status</th>
              <th className="p-3.5 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  {members.length === 0
                    ? 'No members registered yet. Click "Quick Enroll" to add a member.'
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
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="p-3.5 pl-4 whitespace-nowrap">
                      <Link
                        href={`/app/${gymId}/members/${member.id}`}
                        className="flex items-center gap-2.5 font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{member.fullName}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600" />
                          </div>
                          {member.status !== "active" && (
                            <span className="text-[10px] text-red-600 uppercase font-bold">
                              {member.status}
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    <td className="p-3.5 font-medium text-slate-600 whitespace-nowrap">
                      <div>{member.phone}</div>
                      {member.email && (
                        <div className="text-[11px] text-slate-400">{member.email}</div>
                      )}
                    </td>

                    <td className="p-3.5 whitespace-nowrap text-slate-600">
                      {member.branchName}
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          member.activePlan && !member.activePlan.isExpired
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {member.activePlan ? member.activePlan.name : "No Plan"}
                      </span>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      {member.activePlan ? (
                        member.activePlan.isExpired ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Expired ({member.activePlan.endDate})
                          </span>
                        ) : member.activePlan.isExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            <Clock className="w-3.5 h-3.5" />
                            {member.activePlan.daysLeft}d left ({member.activePlan.endDate})
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-xs">
                            Expires {member.activePlan.endDate} ({member.activePlan.daysLeft}d)
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      {member.userId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[11px] border border-blue-200/60">
                          <ShieldCheck className="w-3 h-3" />
                          Connected
                        </span>
                      ) : member.hasPendingInvite ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold text-[11px]">
                          Invite Sent
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-medium text-[11px]">
                          Not Claimed
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={waShare}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                          title="Share Portal link via WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          href={`/app/${gymId}/members/${member.id}`}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs transition-colors"
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
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
        <div>
          Showing {filteredMembers.length} of {members.length} members
        </div>
      </div>
    </div>
  );
}
