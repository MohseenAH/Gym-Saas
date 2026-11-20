"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  UserCheck,
  Smartphone,
  QrCode,
  ShieldAlert,
  Flame,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Calendar,
  X,
  RotateCcw,
  Users,
} from "lucide-react";
import { staffCheckInAction, undoCheckInAction } from "@/lib/actions/attendance";

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
  attendanceId?: string;
  frequency: number;
}

export interface LiveCheckInItem {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  checkInTime: string;
  checkInMethod: "staff_manual" | "member_portal" | "kiosk_qr" | "biometric";
  isOverride: boolean;
  verifiedBy?: string | null;
  verifiedByName?: string;
  branchName?: string;
}

export interface AttendanceKPIs {
  totalCheckIns: number;
  yesterdayCount: number;
  lastHourCount: number;
  overrideCount: number;
}

interface StaffCheckInClientProps {
  gymId: string;
  branchId: string;
  branches: { id: string; name: string }[];
  initialMembers: AttendanceMember[];
  initialLiveCheckIns: LiveCheckInItem[];
  initialKpis: AttendanceKPIs;
  canOverride: boolean;
  userRole: string;
  currentUserName: string;
  selectedDate: string;
  todayDate: string;
}

type FeedFilter = "all" | "staff" | "portal" | "overrides";

export function StaffCheckInClient({
  gymId,
  branchId,
  branches,
  initialMembers,
  initialLiveCheckIns,
  initialKpis,
  canOverride,
  userRole,
  currentUserName,
  selectedDate,
  todayDate,
}: StaffCheckInClientProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core state
  const [members, setMembers] = useState<AttendanceMember[]>(initialMembers);
  const [liveCheckIns, setLiveCheckIns] = useState<LiveCheckInItem[]>(initialLiveCheckIns);
  const [kpis, setKpis] = useState<AttendanceKPIs>(initialKpis);
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || "all");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");

  // Interaction state
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [undoLoadingId, setUndoLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dialog state
  const [overrideTarget, setOverrideTarget] = useState<AttendanceMember | null>(null);
  const [overrideReason, setOverrideReason] = useState("Member renewing payment shortly");
  const [customOverrideReason, setCustomOverrideReason] = useState("");
  const [undoTarget, setUndoTarget] = useState<LiveCheckInItem | null>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Synchronize when server props update (e.g. date change)
  useEffect(() => {
    setMembers(initialMembers);
    setLiveCheckIns(initialLiveCheckIns);
    setKpis(initialKpis);
  }, [initialMembers, initialLiveCheckIns, initialKpis]);

  // Auto-dismiss feedback banner
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Date switch handler
  function handleDateChange(newDate: string) {
    if (!newDate || newDate === selectedDate) return;
    const branchParam = selectedBranchId && selectedBranchId !== "all" ? `&branchId=${selectedBranchId}` : "";
    router.push(`/app/${gymId}/attendance?date=${newDate}${branchParam}`);
  }

  // Filtered members in left column
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedBranchId !== "all" && m.branchId !== selectedBranchId) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    });
  }, [members, selectedBranchId, search]);

  // Frequent regulars (top 6 with highest visit count)
  const frequentRegulars = useMemo(() => {
    const list = [...members].filter(
      (m) => selectedBranchId === "all" || m.branchId === selectedBranchId
    );
    list.sort((a, b) => b.frequency - a.frequency);
    return list.slice(0, 6);
  }, [members, selectedBranchId]);

  // Filtered live feed items
  const filteredFeed = useMemo(() => {
    return liveCheckIns.filter((item) => {
      if (feedFilter === "overrides") return item.isOverride;
      if (feedFilter === "portal") return item.checkInMethod === "member_portal";
      if (feedFilter === "staff") return item.checkInMethod === "staff_manual" && !item.isOverride;
      return true;
    });
  }, [liveCheckIns, feedFilter]);

  // Split counts for historical view and filter pills
  const staffCount = useMemo(() => {
    return liveCheckIns.filter((i) => i.checkInMethod === "staff_manual" && !i.isOverride).length;
  }, [liveCheckIns]);

  const portalCount = useMemo(() => {
    return liveCheckIns.filter((i) => i.checkInMethod === "member_portal").length;
  }, [liveCheckIns]);

  // Format time helper (HH:MM AM/PM)
  function formatTime(isoString?: string) {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  // Format date helper for headers & subtexts
  function formatHeaderDate(dateStr: string) {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  }

  // Core Check-In Handler
  async function handleCheckIn(
    member: AttendanceMember,
    isOverride: boolean = false,
    reason?: string
  ) {
    if (member.checkedInToday) {
      setFeedback({
        type: "success",
        text: `${member.fullName} is already checked in for today (${formatTime(member.checkInTime)})`,
      });
      return;
    }

    setLoadingMemberId(member.id);
    setFeedback(null);

    const res = await staffCheckInAction({
      gymId,
      branchId: member.branchId,
      memberId: member.id,
      isOverride,
      overrideReason: reason,
    });

    setLoadingMemberId(null);
    setOverrideTarget(null);

    if (!res.success) {
      if (res.alreadyCheckedIn) {
        const timeStr = formatTime(res.checkInTime) || "earlier today";
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
              m.id === member.id ? { ...m, isExpired: true, hasActiveMembership: false } : m
            )
          );
        }
        setFeedback({
          type: "error",
          text: res.error || "Failed to check in member",
        });
      }
      return;
    }

    // Success: Update state optimistically
    const checkInTime = res.checkInTime || new Date().toISOString();
    const formattedCheckInTime = formatTime(checkInTime);
    const checkInId = res.checkInId || `checkin-${Date.now()}`;

    // Update Members list
    setMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? {
              ...m,
              checkedInToday: true,
              checkInTime: checkInTime,
              attendanceId: checkInId,
            }
          : m
      )
    );

    // Prepend to Live Check-ins Feed
    const newFeedItem: LiveCheckInItem = {
      id: checkInId,
      memberId: member.id,
      memberName: member.fullName,
      memberPhone: member.phone,
      checkInTime: checkInTime,
      checkInMethod: "staff_manual",
      isOverride: isOverride,
      verifiedByName: currentUserName,
      branchName: member.branchName,
    };

    setLiveCheckIns((prev) => [newFeedItem, ...prev]);

    // Update KPIs
    setKpis((prev) => ({
      ...prev,
      totalCheckIns: prev.totalCheckIns + 1,
      lastHourCount: prev.lastHourCount + 1,
      overrideCount: isOverride ? prev.overrideCount + 1 : prev.overrideCount,
    }));

    setFeedback({
      type: "success",
      text: isOverride
        ? `Grace check-in authorized for ${member.fullName} at ${formattedCheckInTime}`
        : `Checked in ${member.fullName} at ${formattedCheckInTime}`,
    });
  }

  // Handle keyboard Enter key shortcut in search bar
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const topEligible = filteredMembers.find((m) => !m.checkedInToday);
    if (!topEligible) {
      if (filteredMembers.length > 0 && filteredMembers[0].checkedInToday) {
        setFeedback({
          type: "success",
          text: `${filteredMembers[0].fullName} is already checked in for today (${formatTime(filteredMembers[0].checkInTime)})`,
        });
      }
      return;
    }

    if (!topEligible.hasActiveMembership || topEligible.isExpired) {
      if (canOverride) {
        setOverrideTarget(topEligible);
      } else {
        setFeedback({
          type: "error",
          text: `${topEligible.fullName}'s membership is expired. Manager override required.`,
        });
      }
      return;
    }

    handleCheckIn(topEligible);
  }

  // Handle Undo Check-in
  async function handleConfirmUndo() {
    if (!undoTarget) return;

    setUndoLoadingId(undoTarget.id);
    const res = await undoCheckInAction({
      gymId,
      attendanceId: undoTarget.id,
    });
    setUndoLoadingId(null);
    const targetMemberName = undoTarget.memberName;
    const wasOverride = undoTarget.isOverride;
    const targetMemberId = undoTarget.memberId;
    setUndoTarget(null);

    if (!res.success) {
      setFeedback({
        type: "error",
        text: res.error || "Failed to void attendance check-in",
      });
      return;
    }

    // Success: Remove from Live Feed
    setLiveCheckIns((prev) => prev.filter((item) => item.id !== undoTarget.id));

    // Reset Member status
    setMembers((prev) =>
      prev.map((m) =>
        m.id === targetMemberId
          ? {
              ...m,
              checkedInToday: false,
              checkInTime: undefined,
              attendanceId: undefined,
            }
          : m
      )
    );

    // Decrement KPIs
    setKpis((prev) => ({
      ...prev,
      totalCheckIns: Math.max(0, prev.totalCheckIns - 1),
      lastHourCount: Math.max(0, prev.lastHourCount - 1),
      overrideCount: wasOverride ? Math.max(0, prev.overrideCount - 1) : prev.overrideCount,
    }));

    setFeedback({
      type: "success",
      text: `Voided check-in record for ${targetMemberName}`,
    });
  }

  // Delta calculation vs yesterday
  const yesterdayDeltaText = useMemo(() => {
    if (kpis.yesterdayCount === 0) {
      return kpis.totalCheckIns > 0 ? `+${kpis.totalCheckIns} vs yesterday` : "No visits yesterday";
    }
    const diff = kpis.totalCheckIns - kpis.yesterdayCount;
    const pct = Math.abs(Math.round((diff / kpis.yesterdayCount) * 100));
    if (diff > 0) return `+${diff} (+${pct}%) vs yesterday`;
    if (diff < 0) return `${diff} (-${pct}%) vs yesterday`;
    return "Same as yesterday (0%)";
  }, [kpis.totalCheckIns, kpis.yesterdayCount]);

  const mobileYesterdayDeltaText = useMemo(() => {
    if (kpis.yesterdayCount === 0) {
      return kpis.totalCheckIns > 0 ? `+${kpis.totalCheckIns} vs yest.` : "No visits yest.";
    }
    const diff = kpis.totalCheckIns - kpis.yesterdayCount;
    if (diff > 0) return `+${diff} vs yest.`;
    if (diff < 0) return `${diff} vs yest.`;
    return "0% vs yest.";
  }, [kpis.totalCheckIns, kpis.yesterdayCount]);

  const yesterdayDeltaDirection = useMemo(() => {
    if (kpis.yesterdayCount === 0) return kpis.totalCheckIns > 0 ? "up" : "neutral";
    const diff = kpis.totalCheckIns - kpis.yesterdayCount;
    if (diff > 0) return "up";
    if (diff < 0) return "down";
    return "neutral";
  }, [kpis.totalCheckIns, kpis.yesterdayCount]);

  const isToday = selectedDate === todayDate;

  // Pure calendar math from todayDate (zero timezone drift)
  const yesterdayDateStr = useMemo(() => {
    const [y, m, d] = todayDate.split("-").map(Number);
    const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1));
    return yesterdayDate.toISOString().slice(0, 10);
  }, [todayDate]);

  // Helper to render source badge
  function renderSourceBadge(item: LiveCheckInItem) {
    if (item.isOverride) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30 shrink-0 whitespace-nowrap">
          <ShieldAlert className="w-2.5 h-2.5" />
          Override
        </span>
      );
    }
    if (item.checkInMethod === "member_portal") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30 shrink-0 whitespace-nowrap">
          <Smartphone className="w-2.5 h-2.5" />
          Member App
        </span>
      );
    }
    if (item.checkInMethod === "kiosk_qr") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-500/30 shrink-0 whitespace-nowrap">
          <QrCode className="w-2.5 h-2.5" />
          Kiosk QR
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30 shrink-0 whitespace-nowrap">
        <UserCheck className="w-2.5 h-2.5" />
        Staff Check-in
      </span>
    );
  }

  // Render Check-ins Feed Card Content (shared between today 2-column layout and historical full-width layout)
  function renderFeedCardContent() {
    return (
      <>
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            {isToday ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold border border-border/80 shrink-0">
                Historical Log
              </span>
            )}
            <h2 className="text-base sm:text-lg font-bold text-card-foreground tracking-tight">
              {isToday ? "Today's Live Check-ins" : `${formatHeaderDate(selectedDate)} Check-ins`}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/80">
              {liveCheckIns.length}
            </span>

            {/* Back to Today Button on Historical view */}
            {!isToday && (
              <button
                type="button"
                onClick={() => handleDateChange(todayDate)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 transition-all cursor-pointer shadow-2xs ml-auto sm:ml-2"
                title="Return to today's live reception desk"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to Today</span>
              </button>
            )}
          </div>

          {/* 4 Filter Pills: grid on mobile, flex on desktop */}
          <div className="grid grid-cols-2 sm:flex items-center bg-muted/60 p-1 rounded-xl text-xs border border-border/60 gap-1 sm:gap-0.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFeedFilter("all")}
              className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
                feedFilter === "all"
                  ? "bg-card text-foreground shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({liveCheckIns.length})
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter("staff")}
              className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
                feedFilter === "staff"
                  ? "bg-card text-emerald-700 dark:text-emerald-400 shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Staff ({staffCount})
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter("portal")}
              className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
                feedFilter === "portal"
                  ? "bg-card text-blue-700 dark:text-blue-400 shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Member App ({portalCount})
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter("overrides")}
              className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-center ${
                feedFilter === "overrides"
                  ? "bg-card text-amber-700 dark:text-amber-400 shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overrides ({kpis.overrideCount})
            </button>
          </div>
        </div>

        {/* Activity Feed List */}
        <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto pr-0.5">
          {filteredFeed.length === 0 ? (
            <div className="py-14 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
              <Clock className="w-6 h-6 text-muted-foreground/40" />
              <span>No check-in entries found for the selected filter.</span>
            </div>
          ) : (
            filteredFeed.map((item) => (
              <div
                key={item.id}
                className="py-3 px-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 hover:bg-muted/20 transition-colors rounded-lg"
              >
                {/* Mobile Top Row / Desktop Left Side */}
                <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        item.isOverride
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          : item.checkInMethod === "member_portal"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {item.memberName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/app/${gymId}/members/${item.memberId}`}
                          className="text-xs sm:text-sm font-bold text-foreground hover:text-primary transition-colors truncate block"
                        >
                          {item.memberName}
                        </Link>

                        {/* Desktop Source Badge */}
                        <div className="hidden sm:inline-flex">
                          {renderSourceBadge(item)}
                        </div>
                      </div>

                      {/* Desktop Metadata */}
                      <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-semibold text-foreground/80">{item.memberPhone}</span>
                        <span>•</span>
                        <span>{item.verifiedByName || "Reception Desk"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Top Row Right: Timestamp */}
                  <div className="sm:hidden text-xs font-semibold tabular-nums text-foreground flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>{formatTime(item.checkInTime)}</span>
                  </div>
                </div>

                {/* Mobile Bottom Row / Desktop Right Side */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
                  {/* Mobile Bottom Row Left: Source Pill + Compact Metadata */}
                  <div className="sm:hidden flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 flex-1 truncate">
                    {renderSourceBadge(item)}
                    <span className="font-semibold text-foreground/80 truncate text-[11px]">
                      {item.memberPhone} · {item.verifiedByName || "Staff"}
                    </span>
                  </div>

                  {/* Desktop Timestamp + Undo Button */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                    <div className="hidden sm:flex items-center gap-1 text-xs font-bold tabular-nums text-foreground">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{formatTime(item.checkInTime)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUndoTarget(item)}
                      disabled={undoLoadingId === item.id}
                      className="text-xs font-semibold text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 px-2.5 py-1 rounded-md transition-colors border border-transparent hover:border-rose-500/20 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      title="Void/Undo this check-in"
                    >
                      {undoLoadingId === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                      ) : (
                        "Undo"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5 text-foreground">
      {/* 1. Header & Date Switcher Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily gym operations and member check-ins.
          </p>
        </div>

        {/* Compact Date Switcher */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {branches.length > 1 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-9 px-3 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-2xs"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center bg-card p-1 rounded-xl border border-border shadow-2xs">
            <button
              type="button"
              onClick={() => handleDateChange(todayDate)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isToday
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(yesterdayDateStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDate === yesterdayDateStr
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yesterday
            </button>
            <div className="relative flex items-center ml-1 border-l border-border pl-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                max={todayDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-7 pl-6 pr-2 bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
                title="Select Specific Date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between border shadow-2xs animate-in fade-in slide-in-from-top-1 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer ml-3 font-bold p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Three Operational KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* KPI 1 */}
        <div className="bg-card p-3 sm:p-5 rounded-2xl border border-border shadow-xs text-card-foreground flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {isToday ? (
                <>
                  <span className="sm:hidden">TODAY</span>
                  <span className="hidden sm:inline">TODAY&apos;S CHECK-INS</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">TOTAL</span>
                  <span className="hidden sm:inline">TOTAL CHECK-INS</span>
                </>
              )}
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 hidden sm:flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
              {kpis.totalCheckIns}
            </div>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium mt-0.5 truncate">
              {isToday ? (
                <>
                  {yesterdayDeltaDirection === "up" && (
                    <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
                  )}
                  {yesterdayDeltaDirection === "down" && (
                    <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
                  )}
                  <span
                    className={
                      yesterdayDeltaDirection === "up"
                        ? "text-emerald-600 font-semibold truncate"
                        : yesterdayDeltaDirection === "down"
                        ? "text-rose-600 font-semibold truncate"
                        : "text-muted-foreground truncate"
                    }
                  >
                    <span className="sm:hidden">{mobileYesterdayDeltaText}</span>
                    <span className="hidden sm:inline">{yesterdayDeltaText}</span>
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground truncate">
                  <span className="sm:hidden">{formatHeaderDate(selectedDate)}</span>
                  <span className="hidden sm:inline">Logged on {formatHeaderDate(selectedDate)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-card p-3 sm:p-5 rounded-2xl border border-border shadow-xs text-card-foreground flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {isToday ? (
                "LAST HOUR"
              ) : (
                <>
                  <span className="sm:hidden">SPLIT</span>
                  <span className="hidden sm:inline">CHECK-IN SPLIT</span>
                </>
              )}
            </span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 hidden sm:flex items-center justify-center shrink-0">
              {isToday ? <Clock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            </div>
          </div>
          <div className="mt-2">
            {isToday ? (
              <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
                {kpis.lastHourCount}
              </div>
            ) : (
              <div className="text-xl sm:text-3xl font-black tracking-tight text-foreground flex items-baseline">
                <span>{staffCount}</span>
                <span className="text-xs sm:text-base font-normal text-muted-foreground mx-1">/</span>
                <span className="text-base sm:text-2xl font-bold text-muted-foreground">{portalCount}</span>
              </div>
            )}
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate font-medium">
              {isToday ? (
                <>
                  <span className="sm:hidden">Last 60m</span>
                  <span className="hidden sm:inline">Check-ins in last 60m</span>
                </>
              ) : (
                <span className="truncate">{staffCount} Staff · {portalCount} App</span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div
          className={`p-3 sm:p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition-colors ${
            kpis.overrideCount > 0
              ? "bg-amber-500/10 border-amber-500/30 text-card-foreground"
              : "bg-card border-border text-card-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate ${
                kpis.overrideCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
              }`}
            >
              OVERRIDES
            </span>
            <div
              className={`h-7 w-7 rounded-lg hidden sm:flex items-center justify-center shrink-0 ${
                kpis.overrideCount > 0
                  ? "bg-amber-500/20 text-amber-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-xl sm:text-3xl font-black tracking-tight ${
                kpis.overrideCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-foreground"
              }`}
            >
              {kpis.overrideCount}
            </div>
            <div
              className={`text-[11px] sm:text-xs mt-0.5 truncate font-medium ${
                kpis.overrideCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
              }`}
            >
              {isToday ? (
                <>
                  <span className="sm:hidden">Grace</span>
                  <span className="hidden sm:inline">Grace admissions today</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Grace</span>
                  <span className="hidden sm:inline">Grace admissions</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Reception Workspace: Two Columns Desktop when isToday, Full-width Single Card when Historical */}
      {isToday ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (lg:col-span-5): Quick Check-in Desk */}
          <div className="lg:col-span-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-card-foreground tracking-tight">
                Quick Check-in
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Search and check-in members instantly
              </p>
            </div>

            {/* Search Box with Enter Shortcut */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name, phone, or ID..."
                className="w-full h-10 pl-10 pr-20 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all placeholder:text-muted-foreground"
              />
              <div className="absolute right-2.5 top-2.5 hidden sm:flex items-center">
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted border border-border text-muted-foreground font-semibold">
                  ↵ Enter
                </kbd>
              </div>
            </div>

            {/* Members Feed (Frequent or Search Results) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                <span>
                  {search.trim() ? (
                    `Search Results (${filteredMembers.length})`
                  ) : (
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="sm:hidden">Frequent Regulars</span>
                      <span className="hidden sm:inline">Frequent Regulars (1-Tap Check-in)</span>
                    </span>
                  )}
                </span>
                {!search.trim() && (
                  <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">
                    Past 14d
                  </span>
                )}
              </div>

              {/* List */}
              <div className="divide-y divide-border/60 max-h-[460px] overflow-y-auto pr-0.5">
                {search.trim() ? (
                  filteredMembers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No matching members found for &ldquo;{search}&rdquo;.
                    </div>
                  ) : (
                    filteredMembers.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        gymId={gymId}
                        isLoading={loadingMemberId === member.id}
                        canOverride={canOverride}
                        onCheckIn={() => handleCheckIn(member)}
                        onOpenOverride={() => setOverrideTarget(member)}
                        formatTime={formatTime}
                      />
                    ))
                  )
                ) : (
                  frequentRegulars.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      gymId={gymId}
                      isLoading={loadingMemberId === member.id}
                      canOverride={canOverride}
                      onCheckIn={() => handleCheckIn(member)}
                      onOpenOverride={() => setOverrideTarget(member)}
                      formatTime={formatTime}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Bottom Helper */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Member not found in system?</span>
              <Link
                href={`/app/${gymId}/members`}
                className="font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Register New Member</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Right Column (lg:col-span-7): Today's Live Check-ins */}
          <div className="lg:col-span-7 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 flex flex-col gap-4">
            {renderFeedCardContent()}
          </div>
        </div>
      ) : (
        /* Historical Attendance Log Card: Full Width Container */
        <div className="w-full bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs p-4 sm:p-5 flex flex-col gap-4">
          {renderFeedCardContent()}
        </div>
      )}

      {/* 4. Grace Override Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-xl p-6 text-card-foreground flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Authorize Grace Override
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Authorizer: {currentUserName} ({userRole})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs space-y-1">
              <div className="font-bold text-foreground text-sm">
                {overrideTarget.fullName}
              </div>
              <div className="text-muted-foreground flex items-center gap-2">
                <span>{overrideTarget.phone}</span>
                <span>•</span>
                <span className="text-rose-600 font-semibold">
                  {overrideTarget.planEndDate ? `Expired on ${overrideTarget.planEndDate}` : "No active plan"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">
                Select Reason for Grace Check-In:
              </label>
              <select
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full h-10 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="Member renewing payment shortly">Member renewing payment shortly</option>
                <option value="Online payment pending confirmation">Online payment pending confirmation</option>
                <option value="Manager approved one-day grace pass">Manager approved one-day grace pass</option>
                <option value="Card reader / payment gateway issue">Card reader / payment gateway issue</option>
                <option value="Custom">Other / Custom reason...</option>
              </select>

              {overrideReason === "Custom" && (
                <input
                  type="text"
                  value={customOverrideReason}
                  onChange={(e) => setCustomOverrideReason(e.target.value)}
                  placeholder="Enter specific reason..."
                  className="w-full h-10 px-3 mt-2 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCheckIn(
                    overrideTarget,
                    true,
                    overrideReason === "Custom" ? customOverrideReason : overrideReason
                  )
                }
                className="h-9 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Authorize & Check In</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Undo Confirmation Modal */}
      {undoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-xl p-6 text-card-foreground flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Void Attendance Check-in
                </h3>
                <p className="text-xs text-muted-foreground">
                  Recorded at {formatTime(undoTarget.checkInTime)}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to void the check-in record for{" "}
              <strong className="text-foreground">{undoTarget.memberName}</strong>? This will remove
              the entry from today&apos;s attendance ledger and allow re-check-in if needed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setUndoTarget(null)}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                Keep Record
              </button>
              <button
                type="button"
                onClick={handleConfirmUndo}
                disabled={undoLoadingId === undoTarget.id}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {undoLoadingId === undoTarget.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Confirm Void</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Member Row in Quick Check-in Desk (Clean 2-row on mobile, 1-row on desktop)
interface MemberRowProps {
  member: AttendanceMember;
  gymId: string;
  isLoading: boolean;
  canOverride: boolean;
  onCheckIn: () => void;
  onOpenOverride: () => void;
  formatTime: (time?: string) => string;
}

function MemberRow({
  member,
  gymId,
  isLoading,
  canOverride,
  onCheckIn,
  onOpenOverride,
  formatTime,
}: MemberRowProps) {
  const statusPill = member.hasActiveMembership ? (
    member.daysLeft !== undefined && member.daysLeft <= 7 ? (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20 whitespace-nowrap">
        Expiring • {member.daysLeft}d left
      </span>
    ) : (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20 whitespace-nowrap">
        Active {member.daysLeft !== undefined ? `• ${member.daysLeft}d left` : ""}
      </span>
    )
  ) : (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px] border border-rose-500/20 whitespace-nowrap">
      Expired
    </span>
  );

  return (
    <div className="py-2.5 px-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 hover:bg-muted/20 transition-colors rounded-lg">
      {/* Mobile Top Row / Desktop Left Side */}
      <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
              member.checkedInToday
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                : member.isExpired
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                : "bg-primary/10 text-primary border border-primary/20"
            }`}
          >
            {member.checkedInToday ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              member.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
            )}
          </div>

          <div className="min-w-0">
            <Link
              href={`/app/${gymId}/members/${member.id}`}
              className="text-xs sm:text-sm font-semibold sm:font-bold text-foreground hover:text-primary transition-colors truncate block"
            >
              {member.fullName}
            </Link>

            {/* Desktop subline */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground/80">{member.phone}</span>
              <span>•</span>
              {statusPill}
            </div>
          </div>
        </div>

        {/* Mobile status pill aligned right on Row 1 */}
        <div className="sm:hidden shrink-0">
          {statusPill}
        </div>
      </div>

      {/* Mobile Bottom Row / Desktop Right Side */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto">
        {/* Mobile-only phone number on bottom-left */}
        <div className="sm:hidden text-xs text-muted-foreground font-semibold">
          {member.phone}
        </div>

        {/* Action Button */}
        <div className="shrink-0">
          {member.checkedInToday ? (
            <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold whitespace-nowrap">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Checked in • {formatTime(member.checkInTime)}</span>
            </span>
          ) : member.isExpired || !member.hasActiveMembership ? (
            canOverride ? (
              <button
                type="button"
                onClick={onOpenOverride}
                className="h-8 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>Grace Override</span>
              </button>
            ) : (
              <span
                className="inline-block px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] font-semibold border border-border text-center whitespace-nowrap"
                title="Only Managers or Owners can authorize grace check-in"
              >
                Expired — Override Req.
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={onCheckIn}
              disabled={isLoading}
              className="h-8 px-3 rounded-lg bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>Check In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
