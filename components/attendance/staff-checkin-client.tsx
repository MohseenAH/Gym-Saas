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
  Building2,
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
      if (res.alreadyCheckedIn) {
        const timeStr = res.checkInTime
          ? new Date(res.checkInTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "earlier today";
        setFeedback({
          type: "success",
          text: `${member.fullName} is already checked in for today (${timeStr})`,
        });
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id
              ? { ...m, checkedInToday: true, checkInTime: res.checkInTime }
              : m
          )
        );
      } else {
        if (res.isExpired) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id
                ? { ...m, isExpired: true, hasActiveMembership: false }
                : m
            )
          );
        }
        setFeedback({ type: "error", text: res.error || "Failed to check in" });
      }
    } else {
      const checkInTime = res.checkInTime || new Date().toISOString();
      const timeStr = new Date(checkInTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setFeedback({
        type: "success",
        text: res.alreadyCheckedIn
          ? `${member.fullName} is already checked in for today (${timeStr})`
          : `Checked in ${member.fullName} at ${timeStr}`,
      });
      if (!member.checkedInToday) {
        setCount((prev) => prev + 1);
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? {
                ...m,
                checkedInToday: true,
                checkInTime: checkInTime,
              }
            : m
        )
      );
    }
  }

  const waitingCount = members.filter((m) => !m.checkedInToday).length;

  return (
    <div className="space-y-6 text-foreground">
      {/* Top Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-600"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="hover:opacity-75 cursor-pointer ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Counters Header */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-emerald-600 truncate">{count}</div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Checked-In Today</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 rounded-xl sm:rounded-2xl bg-primary/10 text-primary shadow-2xs">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{waitingCount}</div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Waiting Check-In</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 rounded-xl sm:rounded-2xl bg-muted text-muted-foreground shadow-2xs">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{members.length}</div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Total Enrolled</div>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-border shadow-xs flex items-center gap-3 sm:gap-4 text-card-foreground">
          <div className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center shrink-0 rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-600 shadow-2xs">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {members.filter((m) => m.hasActiveMembership && !m.isExpired).length}
            </div>
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground truncate">Active Plans</div>
          </div>
        </div>
      </div>

      {/* Kiosk Controls & Search */}
      <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden text-card-foreground">
        <div className="p-5 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Kiosk-Style Search Bar */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-4 top-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kiosk Search: Member Name or 10-Digit Phone..."
              className="w-full h-12 pl-11 pr-4 bg-muted/40 border border-input rounded-2xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all placeholder:text-muted-foreground"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted/60 p-1 rounded-2xl text-sm border border-border/60">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({members.length})
              </button>
              <button
                onClick={() => setStatusFilter("not_checked_in")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "not_checked_in"
                    ? "bg-card text-primary shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Waiting
              </button>
              <button
                onClick={() => setStatusFilter("checked_in")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "checked_in"
                    ? "bg-card text-emerald-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Checked In ({count})
              </button>
              <button
                onClick={() => setStatusFilter("expired")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "expired"
                    ? "bg-card text-rose-600 shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Expired Plan
              </button>
            </div>

            {branches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-11 px-3 bg-muted/40 border border-input rounded-xl text-sm text-foreground font-semibold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
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

        {/* Members Check-in Feed */}
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No matching members found for the current query.
            </div>
          ) : (
            filtered.map((member) => (
              <div
                key={member.id}
                className="p-4 sm:p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-2xs ${
                      member.checkedInToday
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-primary/10 text-primary border border-primary/20"
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
                        className="text-base font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        {member.fullName}
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        • {member.branchName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                      <span className="font-semibold text-foreground/80">{member.phone}</span>
                      <span>•</span>
                      {member.hasActiveMembership ? (
                        member.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-bold text-xs border border-rose-500/20">
                            Expired ({member.planEndDate})
                          </span>
                        ) : member.daysLeft !== undefined && member.daysLeft <= 7 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold text-xs border border-amber-500/20">
                            {member.planName} &bull; {member.daysLeft}d left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs border border-emerald-500/20">
                            {member.planName} &bull; Active
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-bold text-xs border border-border">
                          No Active Plan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.checkedInToday ? (
                    <div className="flex items-center gap-1.5 h-11 px-4 bg-emerald-500/10 text-emerald-600 rounded-xl text-sm font-bold border border-emerald-500/20">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>
                        {member.checkInTime
                          ? new Date(member.checkInTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Checked In"}
                      </span>
                    </div>
                  ) : !member.hasActiveMembership || member.isExpired ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/app/${gymId}/members/${member.id}`}
                        className="flex items-center gap-1.5 h-11 px-4 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-xl text-sm font-bold transition-all shadow-2xs cursor-pointer"
                        title="Open Member Profile to Renew Plan"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Renew to Check In</span>
                      </Link>
                      <button
                        type="button"
                        disabled
                        title="Membership is expired or inactive. Renewal required before check in."
                        className="hidden md:flex items-center gap-1.5 h-11 px-4 bg-muted text-muted-foreground border border-border rounded-xl text-sm font-semibold cursor-not-allowed opacity-50"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Check In</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(member)}
                      disabled={loadingMemberId === member.id}
                      className="flex items-center gap-2 h-11 px-5 bg-primary hover:opacity-95 text-primary-foreground rounded-xl text-sm font-bold shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                    >
                      {loadingMemberId === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                      <span>Check In</span>
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
