"use client";

import { useState, useMemo, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  UserCheck,
  UserPlus,
  QrCode,
  ShieldAlert,
  Calendar,
  CalendarCheck,
  X,
  RotateCcw,
  Users,
  XCircle,
  Hand,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  ArrowRight,
  Building2,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { staffCheckInAction, undoCheckInAction } from "@/lib/actions/attendance";
import { formatDate } from "@/lib/utils";

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
  canViewReports?: boolean;
  userRole: string;
  currentUserName: string;
  selectedDate: string;
  todayDate: string;
}

type StatusFilter = "all" | "present" | "absent" | "manual" | "qr";

interface AttendanceRowItem {
  rowKey: string;
  memberId: string;
  memberName: string;
  shortId: string;
  planName: string;
  checkInTime?: string;
  status: "present" | "absent";
  method?: "QR" | "Manual";
  isOverride: boolean;
  attendanceId?: string;
  memberRef?: AttendanceMember;
  checkInRef?: LiveCheckInItem;
}

function formatTimeIST(isoString?: string) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function StaffCheckInClient({
  gymId,
  branchId,
  branches,
  initialMembers,
  initialLiveCheckIns,
  canOverride,
  canViewReports = true,
  currentUserName,
  selectedDate,
  todayDate,
}: StaffCheckInClientProps) {
  const router = useRouter();

  // Optimistic local state layered over server props
  const [optimisticCheckIns, setOptimisticCheckIns] = useState<LiveCheckInItem[]>([]);
  const [undoneIds, setUndoneIds] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId || "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<AttendanceMember | null>(null);
  const [overrideReason, setOverrideReason] = useState("Member renewing payment shortly");
  const [customOverrideReason, setCustomOverrideReason] = useState("");
  const [undoTarget, setUndoTarget] = useState<LiveCheckInItem | null>(null);

  // Action states
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [undoLoadingId, setUndoLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isViewingToday = selectedDate === todayDate;

  // Combine server check-ins with optimistic additions/removals
  const liveCheckIns = useMemo(() => {
    const serverIds = new Set(initialLiveCheckIns.map((c) => c.id));
    const filteredOptimistic = optimisticCheckIns.filter((c) => !serverIds.has(c.id));
    return [...filteredOptimistic, ...initialLiveCheckIns].filter(
      (c) => !undoneIds.has(c.id)
    );
  }, [initialLiveCheckIns, optimisticCheckIns, undoneIds]);

  const members = useMemo(() => {
    const checkInByMember = new Map<string, LiveCheckInItem>();
    liveCheckIns.forEach((c) => {
      if (!checkInByMember.has(c.memberId)) {
        checkInByMember.set(c.memberId, c);
      }
    });
    return initialMembers.map((m) => {
      const ci = checkInByMember.get(m.id);
      if (ci) {
        return {
          ...m,
          checkedInToday: true,
          checkInTime: ci.checkInTime,
          attendanceId: ci.id,
        };
      }
      if (m.attendanceId && undoneIds.has(m.attendanceId)) {
        return {
          ...m,
          checkedInToday: false,
          checkInTime: undefined,
          attendanceId: undefined,
        };
      }
      return m;
    });
  }, [initialMembers, liveCheckIns, undoneIds]);

  // Branch-scoped members & check-ins
  const branchMembers = useMemo(() => {
    if (selectedBranchId === "all") return members;
    return members.filter((m) => m.branchId === selectedBranchId);
  }, [members, selectedBranchId]);

  const branchMemberIds = useMemo(
    () => new Set(branchMembers.map((m) => m.id)),
    [branchMembers]
  );

  const branchCheckIns = useMemo(() => {
    if (selectedBranchId === "all") return liveCheckIns;
    return liveCheckIns.filter((c) => branchMemberIds.has(c.memberId));
  }, [liveCheckIns, selectedBranchId, branchMemberIds]);

  // Eligible active members for absence calculation (never count expired/inactive as absent)
  const eligibleMembers = useMemo(
    () => branchMembers.filter((m) => m.status === "active" && m.hasActiveMembership),
    [branchMembers]
  );

  const uniquePresentIds = useMemo(
    () => new Set(branchCheckIns.map((c) => c.memberId)),
    [branchCheckIns]
  );

  const presentCount = uniquePresentIds.size;
  const absentEligibleMembers = useMemo(
    () => eligibleMembers.filter((m) => !uniquePresentIds.has(m.id)),
    [eligibleMembers, uniquePresentIds]
  );
  const absentCount = absentEligibleMembers.length;

  const qrCount = useMemo(
    () =>
      branchCheckIns.filter(
        (c) => c.checkInMethod === "member_portal" || c.checkInMethod === "kiosk_qr"
      ).length,
    [branchCheckIns]
  );

  const manualCount = useMemo(
    () => branchCheckIns.filter((c) => c.checkInMethod === "staff_manual").length,
    [branchCheckIns]
  );

  // Build unified table rows for selected date
  const allRows: AttendanceRowItem[] = useMemo(() => {
    const memberById = new Map(branchMembers.map((m) => [m.id, m]));

    const presentRows: AttendanceRowItem[] = branchCheckIns.map((ci) => {
      const m = memberById.get(ci.memberId);
      const methodLabel: "QR" | "Manual" =
        ci.checkInMethod === "member_portal" || ci.checkInMethod === "kiosk_qr"
          ? "QR"
          : "Manual";
      return {
        rowKey: `ci-${ci.id}`,
        memberId: ci.memberId,
        memberName: ci.memberName,
        shortId: `#${ci.memberId.slice(0, 8).toUpperCase()}`,
        planName: m?.planName || "Active Plan",
        checkInTime: ci.checkInTime,
        status: "present",
        method: methodLabel,
        isOverride: ci.isOverride,
        attendanceId: ci.id,
        memberRef: m,
        checkInRef: ci,
      };
    });

    const absentRows: AttendanceRowItem[] = absentEligibleMembers.map((m) => ({
      rowKey: `abs-${m.id}`,
      memberId: m.id,
      memberName: m.fullName,
      shortId: `#${m.id.slice(0, 8).toUpperCase()}`,
      planName: m.planName || "Active Plan",
      status: "absent",
      isOverride: false,
      memberRef: m,
    }));

    return [...presentRows, ...absentRows];
  }, [branchCheckIns, absentEligibleMembers, branchMembers]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (statusFilter === "present" && row.status !== "present") return false;
      if (statusFilter === "absent" && row.status !== "absent") return false;
      if (statusFilter === "manual" && (row.status !== "present" || row.method !== "Manual")) {
        return false;
      }
      if (statusFilter === "qr" && (row.status !== "present" || row.method !== "QR")) {
        return false;
      }
      if (!q) return true;
      return (
        row.memberName.toLowerCase().includes(q) ||
        row.shortId.toLowerCase().includes(q) ||
        row.memberId.toLowerCase().includes(q) ||
        (row.memberRef?.phone || "").includes(q)
      );
    });
  }, [allRows, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, safePage, rowsPerPage]);

  // Manual modal member list
  const manualModalMembers = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    return branchMembers
      .filter((m) => {
        if (!q) return true;
        return (
          m.fullName.toLowerCase().includes(q) ||
          m.phone.includes(q) ||
          m.id.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [branchMembers, manualSearch]);

  function handleDateChange(newDate: string) {
    if (!newDate || newDate === selectedDate) return;
    const branchParam =
      selectedBranchId && selectedBranchId !== "all"
        ? `&branchId=${selectedBranchId}`
        : "";
    router.push(`/app/${gymId}/attendance?date=${newDate}${branchParam}`);
  }

  function handleFilterSelect(next: StatusFilter) {
    setStatusFilter(next);
    setCurrentPage(1);
  }

  async function handleCheckIn(
    member: AttendanceMember,
    isOverride = false,
    reason?: string
  ) {
    if (member.checkedInToday) {
      setFeedback({
        type: "success",
        text: `${member.fullName} is already checked in (${formatTimeIST(member.checkInTime)}).`,
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
      if (res.isExpired && !isOverride && canOverride) {
        setOverrideTarget(member);
        return;
      }
      setFeedback({
        type: "error",
        text: res.error || "Failed to check in member.",
      });
      return;
    }

    const checkInTime = res.checkInTime || new Date().toISOString();
    const checkInId = res.checkInId || `checkin-${member.id}-${selectedDate}`;

    setOptimisticCheckIns((prev) => [
      {
        id: checkInId,
        memberId: member.id,
        memberName: member.fullName,
        memberPhone: member.phone,
        checkInTime,
        checkInMethod: "staff_manual",
        isOverride,
        verifiedByName: currentUserName,
        branchName: member.branchName,
      },
      ...prev,
    ]);

    setFeedback({
      type: "success",
      text: isOverride
        ? `Grace check-in authorized for ${member.fullName} at ${formatTimeIST(checkInTime)}.`
        : `Checked in ${member.fullName} at ${formatTimeIST(checkInTime)}.`,
    });
    startTransition(() => router.refresh());
  }

  async function handleConfirmUndo() {
    if (!undoTarget) return;
    setUndoLoadingId(undoTarget.id);
    const targetId = undoTarget.id;
    const targetName = undoTarget.memberName;

    const res = await undoCheckInAction({
      gymId,
      attendanceId: targetId,
    });

    setUndoLoadingId(null);
    setUndoTarget(null);

    if (!res.success) {
      setFeedback({
        type: "error",
        text: res.error || "Failed to void check-in record.",
      });
      return;
    }

    setUndoneIds((prev) => {
      const next = new Set(prev);
      next.add(targetId);
      return next;
    });
    setFeedback({
      type: "success",
      text: `Voided check-in record for ${targetName}.`,
    });
    startTransition(() => router.refresh());
  }

  const startIndex = filteredRows.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(safePage * rowsPerPage, filteredRows.length);

  return (
    <div className="space-y-5 text-foreground">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
            Attendance
          </h1>
          {!isViewingToday && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/25">
              Viewing {formatDate(selectedDate)}
            </span>
          )}
        </div>

        {canViewReports && (
          <Link
            href={`/app/${gymId}/reports`}
            className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95 transition-opacity shrink-0"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Attendance Reports</span>
            <span className="sm:hidden">Reports</span>
          </Link>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        <KpiCard
          compact
          label="Total Members"
          value={branchMembers.length}
          variant="purple"
          icon={<Users className="w-4 h-4" />}
          onClick={() => handleFilterSelect("all")}
          active={statusFilter === "all"}
        />
        <KpiCard
          compact
          label={isViewingToday ? "Present Today" : "Present"}
          value={presentCount}
          variant="green"
          icon={<UserCheck className="w-4 h-4" />}
          onClick={() => handleFilterSelect("present")}
          active={statusFilter === "present"}
        />
        <KpiCard
          compact
          label={isViewingToday ? "Absent Today" : "Absent"}
          value={absentCount}
          variant="red"
          icon={<XCircle className="w-4 h-4" />}
          onClick={() => handleFilterSelect("absent")}
          active={statusFilter === "absent"}
        />
        <KpiCard
          compact
          label="QR Check-ins"
          value={qrCount}
          variant="blue"
          icon={<QrCode className="w-4 h-4" />}
          onClick={() => handleFilterSelect("qr")}
          active={statusFilter === "qr"}
        />
        <div className="col-span-2 lg:col-span-1">
          <KpiCard
            compact
            label="Manual Check-ins"
            value={manualCount}
            variant="amber"
            icon={<Hand className="w-4 h-4" />}
            onClick={() => handleFilterSelect("manual")}
            active={statusFilter === "manual"}
          />
        </div>
      </div>

      {/* Primary Attendance Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIsManualModalOpen(true)}
          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-500/20 bg-purple-500/8 hover:bg-purple-500/14 text-left transition-all cursor-pointer"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-foreground">
                Manual Check-In
              </div>
              <div className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                Check in a member manually
              </div>
            </div>
          </div>
          <ChevronRight className="hidden sm:block w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setIsQrModalOpen(true)}
          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-blue-500/20 bg-blue-500/8 hover:bg-blue-500/14 text-left transition-all cursor-pointer"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-foreground">
                Scan QR / Open Scanner
              </div>
              <div className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                Scan member QR code to check in
              </div>
            </div>
          </div>
          <ChevronRight className="hidden sm:block w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search attendance by member name or ID..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "all", label: `All (${allRows.length})` },
                { id: "present", label: `Present (${presentCount})` },
                { id: "manual", label: `Manual (${manualCount})` },
                { id: "qr", label: `QR (${qrCount})` },
                { id: "absent", label: `Absent (${absentCount})` },
              ] as const
            ).map((pill) => {
              const active = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => handleFilterSelect(pill.id)}
                  className={`h-9 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Date Selector */}
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              max={todayDate}
              onChange={(e) => handleDateChange(e.target.value)}
              aria-label="Filter attendance by date"
              className="h-9 pl-8 pr-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Branch Selector if multiple */}
          {branches.length > 1 && (
            <div className="relative flex items-center">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by branch"
                className="h-9 pl-8 pr-3 rounded-xl bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Attendance Table */}
      <div className="hidden md:block bg-card rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border text-[11px]">
              <tr>
                <th className="py-3.5 pl-5 pr-3">Member</th>
                <th className="py-3.5 px-3">Plan</th>
                <th className="py-3.5 px-3">Check-in Time</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Method</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No attendance records match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.rowKey}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-1 h-9 rounded-full shrink-0 ${
                            row.status === "present"
                              ? row.isOverride
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                              : "bg-rose-500"
                          }`}
                        />
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-xs shrink-0">
                          {row.memberName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">
                            {row.memberName}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {row.shortId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-foreground">
                      {row.planName}
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground font-medium">
                      {row.checkInTime ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTimeIST(row.checkInTime)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            row.status === "present"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.status === "present" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {row.status === "present" ? "Present" : "Absent"}
                        </span>
                        {row.isOverride && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                            Grace
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-muted-foreground">
                      {row.method ? (
                        <span className="inline-flex items-center gap-1.5">
                          {row.method === "QR" ? (
                            <QrCode className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Hand className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                          {row.method}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <div className="inline-flex items-center gap-1.5 relative">
                        <Link
                          href={`/app/${gymId}/members/${row.memberId}`}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors"
                        >
                          View
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          aria-label="Attendance row actions"
                          onClick={() =>
                            setOpenMenuId((prev) =>
                              prev === row.rowKey ? null : row.rowKey
                            )
                          }
                          className="h-8 w-8 inline-flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === row.rowKey && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-9 w-44 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-left text-xs font-semibold">
                              <Link
                                href={`/app/${gymId}/members/${row.memberId}`}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                                onClick={() => setOpenMenuId(null)}
                              >
                                <Users className="w-3.5 h-3.5 text-primary" />
                                View Profile
                              </Link>
                              {row.status === "present" && row.checkInRef && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setUndoTarget(row.checkInRef!);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Undo Check-In
                                </button>
                              )}
                              {row.status === "absent" && row.memberRef && isViewingToday && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleCheckIn(row.memberRef!);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-500/10 text-emerald-600 cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Mark Present
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Attendance Cards */}
      <div className="md:hidden space-y-2.5">
        {paginatedRows.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-xs text-muted-foreground">
            No attendance records match the current filters.
          </div>
        ) : (
          paginatedRows.map((row) => (
            <div
              key={row.rowKey}
              className="relative bg-card rounded-2xl border border-border p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-1 h-10 rounded-full shrink-0 ${
                    row.status === "present"
                      ? row.isOverride
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                      : "bg-rose-500"
                  }`}
                />
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-xs shrink-0">
                  {row.memberName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/app/${gymId}/members/${row.memberId}`}
                    className="font-bold text-sm text-foreground truncate block hover:underline"
                  >
                    {row.memberName}
                  </Link>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="font-mono">{row.shortId}</span>
                    {row.checkInTime && (
                      <>
                        <span>•</span>
                        <span>{formatTimeIST(row.checkInTime)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      row.status === "present"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
                    }`}
                  >
                    {row.status === "present" ? "Present" : "Absent"}
                  </span>
                  {row.method && (
                    <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                      {row.method}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    aria-label="Mobile row actions"
                    onClick={() =>
                      setOpenMenuId((prev) =>
                        prev === `mob-${row.rowKey}` ? null : `mob-${row.rowKey}`
                      )
                    }
                    className="h-8 w-8 inline-flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenuId === `mob-${row.rowKey}` && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 top-9 w-44 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-left text-xs font-semibold">
                        <Link
                          href={`/app/${gymId}/members/${row.memberId}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                          onClick={() => setOpenMenuId(null)}
                        >
                          <Users className="w-3.5 h-3.5 text-primary" />
                          View Profile
                        </Link>
                        {row.status === "present" && row.checkInRef && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setUndoTarget(row.checkInRef!);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Undo Check-In
                          </button>
                        )}
                        {row.status === "absent" && row.memberRef && isViewingToday && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleCheckIn(row.memberRef!);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-500/10 text-emerald-600 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Mark Present
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
        <div>
          Showing <span className="font-bold text-foreground">{startIndex}–{endIndex}</span> of{" "}
          <span className="font-bold text-foreground">{filteredRows.length}</span> records
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-between sm:justify-end">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 font-bold text-foreground">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 px-2 rounded-xl border border-border bg-card text-foreground font-bold"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </div>
        </div>
      </div>

      {/* Manual Check-In Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/12 text-purple-600 dark:text-purple-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">
                    Manual Check-In
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Search and check in a member
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="Type member name, phone, or ID..."
                  autoFocus
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1">
                {manualModalMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No matching members found.
                  </p>
                ) : (
                  manualModalMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-muted/35 border border-border/60 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">
                          {m.fullName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {m.phone} • {m.planName || "No Plan"}
                        </div>
                      </div>
                      {m.checkedInToday ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                          <Check className="w-3 h-3" /> Checked In
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={loadingMemberId === m.id}
                          onClick={() => handleCheckIn(m)}
                          className="shrink-0 h-8 px-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-95 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {loadingMemberId === m.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                          Check In
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Info Modal (Honest Gap Reporting) */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-black text-foreground">
                  QR Check-In Scanner
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                Staff camera QR scanning is not yet configured in this workspace.
                Members can check in via their Member Portal self-scan, which
                appears automatically under <strong className="text-foreground">QR Check-ins</strong>.
              </p>
              <p>
                You can also use <strong className="text-foreground">Manual Check-In</strong> to
                search by member name, phone, or ID.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="h-9 px-4 rounded-xl border border-border bg-muted font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsQrModalOpen(false);
                  setIsManualModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer"
              >
                Open Manual Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grace Override Confirmation Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center gap-3 pb-3.5 border-b border-border">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">
                  Membership Expired — Grace Override
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {overrideTarget.fullName}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <label className="block font-bold text-foreground">
                Override Reason
              </label>
              <select
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
              >
                <option value="Member renewing payment shortly">
                  Member renewing payment shortly
                </option>
                <option value="Grace period approved by manager">
                  Grace period approved by manager
                </option>
                <option value="custom">Other reason...</option>
              </select>

              {overrideReason === "custom" && (
                <input
                  type="text"
                  value={customOverrideReason}
                  onChange={(e) => setCustomOverrideReason(e.target.value)}
                  placeholder="Enter override reason"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground"
                />
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                className="h-9 px-4 rounded-xl border border-border bg-muted font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingMemberId === overrideTarget.id}
                onClick={() =>
                  handleCheckIn(
                    overrideTarget,
                    true,
                    overrideReason === "custom" ? customOverrideReason : overrideReason
                  )
                }
                className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {loadingMemberId === overrideTarget.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Authorize Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Check-In Confirmation Modal */}
      {undoTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-border">
            <h3 className="text-sm font-black text-foreground">
              Undo Check-In?
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5">
              This will remove today&apos;s attendance record for{" "}
              <strong className="text-foreground">{undoTarget.memberName}</strong>.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUndoTarget(null)}
                className="h-9 px-4 rounded-xl border border-border bg-muted font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={undoLoadingId === undoTarget.id}
                onClick={handleConfirmUndo}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {undoLoadingId === undoTarget.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Undo Check-In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
