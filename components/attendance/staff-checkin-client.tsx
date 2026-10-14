"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Users,
} from "lucide-react";
import { staffCheckInAction } from "@/lib/actions/attendance";

export interface AttendanceMember {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
  branchName: string;
  status: string;
  hasActiveMembership: boolean;
  planName?: string;
  planEndDate?: string;
  daysLeft?: number;
  isExpired?: boolean;
  checkedInToday: boolean;
  checkInTime?: string;
}

interface StaffCheckInClientProps {
  gymId: string;
  branchId: string;
  branches: { id: string; name: string }[];
  initialMembers: AttendanceMember[];
  todayCheckInCount: number;
}

export function StaffCheckInClient({
  gymId,
  branchId,
  branches,
  initialMembers,
  todayCheckInCount,
}: StaffCheckInClientProps) {
  const [members, setMembers] = useState<AttendanceMember[]>(initialMembers);
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId);
  const [statusFilter, setStatusFilter] = useState<"all" | "checked_in" | "not_checked_in" | "expired">("all");
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [count, setCount] = useState(todayCheckInCount);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = members.filter((m) => {
    // Branch filter
    if (selectedBranchId !== "all" && m.branchId !== selectedBranchId) {
      return false;
    }

    // Status filter
    if (statusFilter === "checked_in" && !m.checkedInToday) return false;
    if (statusFilter === "not_checked_in" && m.checkedInToday) return false;
    if (statusFilter === "expired" && (!m.isExpired && m.hasActiveMembership)) return false;

    // Search query
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.fullName.toLowerCase().includes(q) || m.phone.includes(q);
  });

  async function handleCheckIn(member: AttendanceMember) {
    if (member.checkedInToday) return;

    setLoadingMemberId(member.id);
    setFeedback(null);

    const res = await staffCheckInAction({
      gymId,
      branchId: member.branchId,
      memberId: member.id,
    });

    setLoadingMemberId(null);
    if (!res.success) {
      setFeedback({ type: "error", text: res.error || "Failed to check in" });
    } else {
      setFeedback({
        type: "success",
        text: `Checked in ${member.fullName} at ${new Date(res.checkInTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      });
      setCount((prev) => prev + 1);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? {
                ...m,
                checkedInToday: true,
                checkInTime: res.checkInTime,
              }
            : m
        )
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{count}</div>
            <div className="text-xs text-slate-500 font-medium">Checked-in Today</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="text-xs text-slate-500 font-medium">Front-Desk Live Ledger</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{members.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Registered Members</div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Member Check-in List & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search member by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("not_checked_in")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  statusFilter === "not_checked_in"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Waiting
              </button>
              <button
                onClick={() => setStatusFilter("checked_in")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  statusFilter === "checked_in"
                    ? "bg-white text-emerald-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Checked In ({count})
              </button>
              <button
                onClick={() => setStatusFilter("expired")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  statusFilter === "expired"
                    ? "bg-white text-red-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Expired Plan
              </button>
            </div>

            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching members found.
            </div>
          ) : (
            filtered.map((member) => (
              <div
                key={member.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                      member.checkedInToday
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {member.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/app/${gymId}/members/${member.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                      >
                        {member.fullName}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                      </Link>
                      <span className="text-[11px] text-slate-400">
                        • {member.branchName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{member.phone}</span>
                      <span>•</span>
                      {member.hasActiveMembership ? (
                        member.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 font-bold text-[11px] border border-red-200/60">
                            Expired ({member.planEndDate})
                          </span>
                        ) : member.daysLeft !== undefined && member.daysLeft <= 7 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200/60">
                            {member.planName} &bull; {member.daysLeft}d left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200/60">
                            {member.planName} &bull; Active
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[11px]">
                          No Active Plan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* If expired or no plan, show quick renew link */}
                  {(!member.hasActiveMembership || member.isExpired) && (
                    <Link
                      href={`/app/${gymId}/members/${member.id}`}
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200/60 transition-colors"
                      title="Open Profile to Renew Plan"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Renew</span>
                    </Link>
                  )}

                  {member.checkedInToday ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200/60">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {member.checkInTime
                          ? new Date(member.checkInTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Checked In"}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(member)}
                      disabled={loadingMemberId === member.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                    >
                      {loadingMemberId === member.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>1-Tap Check In</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
