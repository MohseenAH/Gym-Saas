"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IdCard,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Tag,
  IndianRupee,
  Layers,
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
import { CollectDueModal } from "./collect-due-modal";
import { OfferItem } from "@/lib/validations/offers";

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
  memberCode?: string;
  offerTitle?: string;
  discountAmount?: number;
  finalPrice?: number;
  isTrial?: boolean;
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

type MainViewMode = "all" | "plans";
type MembershipFilterTab = "all" | "active" | "trial" | "expiring" | "expired" | "pending";

function formatTimelineDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine top-level view: 'all' vs 'plans'
  const requestedView = searchParams.get("view");
  const initialViewMode: MainViewMode =
    requestedView === "plans" || initialTab === "plans" ? "plans" : "all";

  const [viewMode, setViewMode] = useState<MainViewMode>(initialViewMode);
  const [filterTab, setFilterTab] = useState<MembershipFilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [collectDueModalOpen, setCollectDueModalOpen] = useState(false);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [targetMembership, setTargetMembership] = useState<MembershipItem | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sync viewMode if query param changes
  useEffect(() => {
    if (requestedView === "plans" || initialTab === "plans") {
      setViewMode("plans");
    } else if (requestedView === "all") {
      setViewMode("all");
    }
  }, [requestedView, initialTab]);

  function handleSwitchView(mode: MainViewMode) {
    setViewMode(mode);
    const params = new URLSearchParams(window.location.search);
    if (mode === "plans") {
      params.set("view", "plans");
    } else {
      params.delete("view");
    }
    const newQuery = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${newQuery}`);
  }

  function showMessage(type: "success" | "error", text: string) {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }

  // Calculate live KPI counts
  const stats = useMemo(() => {
    let active = 0;
    let trial = 0;
    let expiring = 0;
    let expired = 0;
    let pendingPayment = 0;

    memberships.forEach((m) => {
      const isTrial =
        m.isTrial ||
        m.planPrice === 0 ||
        m.planName.toLowerCase().includes("trial");

      if (m.status === "active") {
        if (isTrial) {
          trial++;
        } else {
          active++;
        }
        if (m.isExpiringSoon) {
          expiring++;
        }
      } else if (m.status === "expired") {
        expired++;
      }

      if (m.totalDue > 0) {
        pendingPayment++;
      }
    });

    return {
      total: memberships.length,
      active,
      trial,
      expiring,
      expired,
      pendingPayment,
    };
  }, [memberships]);

  // Filter memberships based on search and tab
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      const isTrial =
        m.isTrial ||
        m.planPrice === 0 ||
        m.planName.toLowerCase().includes("trial");

      // Tab filter
      if (filterTab === "active") {
        if (m.status !== "active" || isTrial) return false;
      } else if (filterTab === "trial") {
        if (!isTrial || m.status !== "active") return false;
      } else if (filterTab === "expiring") {
        if (!m.isExpiringSoon || m.status !== "active") return false;
      } else if (filterTab === "expired") {
        if (m.status !== "expired") return false;
      } else if (filterTab === "pending") {
        if (m.totalDue <= 0) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          m.memberName.toLowerCase().includes(term) ||
          m.memberPhone.includes(term) ||
          m.planName.toLowerCase().includes(term) ||
          m.branchName.toLowerCase().includes(term) ||
          (m.memberCode && m.memberCode.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [memberships, filterTab, searchTerm]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchTerm]);

  // Pagination slice
  const totalPages = Math.ceil(filteredMemberships.length / itemsPerPage) || 1;
  const paginatedMemberships = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMemberships.slice(start, start + itemsPerPage);
  }, [filteredMemberships, currentPage]);

  function handleOpenRenew(membership: MembershipItem) {
    setTargetMembership(membership);
    setRenewModalOpen(true);
  }

  function handleOpenCollectDue(membership: MembershipItem) {
    setTargetMembership(membership);
    setCollectDueModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs underline hover:opacity-80 ml-4 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TOP VIEW SWITCHER SEGMENTED BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start">
          <button
            type="button"
            onClick={() => handleSwitchView("all")}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              viewMode === "all"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <IdCard className="w-4 h-4" />
            <span>All Memberships</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchView("plans")}
            className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              viewMode === "plans"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Plans & Offers</span>
          </button>
        </div>

        {/* Unassigned Quick Access Badge if any unassigned members exist */}
        {unassignedMembers.length > 0 && (
          <button
            type="button"
            onClick={() => setBulkAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{unassignedMembers.length} Unassigned Members</span>
            <span className="text-[11px] underline ml-1">Bulk Assign &rarr;</span>
          </button>
        )}
      </div>

      {/* VIEW 2: PLANS & OFFERS */}
      {viewMode === "plans" && (
        <PlansManagerClient
          gymId={gymId}
          plans={detailedPlans}
          branches={branches}
          canManagePlans={canManagePlans}
          selectedBranchId={selectedBranchId}
        />
      )}

      {/* VIEW 1: ALL MEMBERSHIPS (Blueprint 1000156762.png) */}
      {viewMode === "all" && (
        <div className="space-y-6">
          {/* Header & Primary Action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Memberships
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage member memberships, renewals and expiry
              </p>
            </div>

            {canManageMembers && (
              <button
                type="button"
                onClick={() => setAssignModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Assign Plan</span>
              </button>
            )}
          </div>

          {/* 4-Metric Summary Strip */}
          {/* Desktop 4-column row / Mobile 2x2 grid card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Active Memberships */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Active Memberships
              </span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.active}
              </div>
            </div>

            {/* Trial Memberships */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Trial Memberships
              </span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.trial}
              </div>
            </div>

            {/* Expiring Soon */}
            <div className="bg-amber-50/50 rounded-xl border border-amber-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">
                  Expiring Soon
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-amber-900 tabular-nums mt-1">
                {stats.expiring}
              </div>
            </div>

            {/* Expired Memberships */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Expired Memberships
              </span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {stats.expired}
              </div>
            </div>
          </div>

          {/* Search Bar & Count-Badged Filter Pills */}
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search member name, phone, or plan..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 placeholder:text-slate-400 shadow-xs"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterTab === "all"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>All</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterTab === "all"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("active")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterTab === "active"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Active</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterTab === "active"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("trial")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterTab === "trial"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Trial</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterTab === "trial"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.trial}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("expiring")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterTab === "expiring"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Expiring Soon</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterTab === "expiring"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.expiring}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("expired")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterTab === "expired"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Expired</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterTab === "expired"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.expired}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("pending")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterTab === "pending"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Payment Pending</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    filterTab === "pending"
                      ? "bg-emerald-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stats.pendingPayment}
                </span>
              </button>
            </div>
          </div>

          {/* DESKTOP TABLE VIEW (1440px) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Membership Plan</th>
                    <th className="py-3 px-4">Expiry Timeline</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedMemberships.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No memberships found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedMemberships.map((m) => {
                      const isTrial =
                        m.isTrial ||
                        m.planPrice === 0 ||
                        m.planName.toLowerCase().includes("trial");

                      const memberCode = m.memberCode || `#${m.memberPhone.slice(-4) || "1001"}`;
                      const initials = m.memberName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase();

                      // Plan and offer lines
                      const basePriceLine = `${m.planName} · ₹${m.planPrice.toLocaleString("en-IN")}`;
                      let offerLine = "No Offer · Final ₹" + m.planPrice.toLocaleString("en-IN");
                      if (isTrial) {
                        offerLine = "Free Trial · Final ₹0";
                      } else if (m.offerTitle) {
                        const finalAmt = m.finalPrice ?? Math.max(0, m.planPrice - (m.discountAmount || 0));
                        offerLine = `${m.offerTitle} · Final ₹${finalAmt.toLocaleString("en-IN")}`;
                      }

                      // Payment status badge
                      let paymentBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      );
                      if (isTrial || m.planPrice === 0) {
                        paymentBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Free
                          </span>
                        );
                      } else if (m.totalDue > 0) {
                        paymentBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Partial (₹{m.totalDue.toLocaleString("en-IN")} Due)
                          </span>
                        );
                      }

                      // Membership status badge
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active ({m.daysRemaining}d left)
                        </span>
                      );
                      if (isTrial) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Trial ({m.daysRemaining}d left)
                          </span>
                        );
                      } else if (m.isExpiringSoon) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Expiring ({m.daysRemaining}d left)
                          </span>
                        );
                      } else if (m.status === "expired") {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Expired ({Math.abs(m.daysRemaining)}d ago)
                          </span>
                        );
                      }

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Member */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <Link
                                  href={`/app/${gymId}/members?search=${encodeURIComponent(m.memberName)}`}
                                  className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                                >
                                  {m.memberName}
                                </Link>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {memberCode}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Membership Plan & Offer */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">
                              {basePriceLine}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {offerLine}
                            </div>
                          </td>

                          {/* Expiry Timeline */}
                          <td className="py-3 px-4 text-slate-600 font-medium tabular-nums whitespace-nowrap">
                            {formatTimelineDate(m.startDate)} &rarr; {formatTimelineDate(m.endDate)}
                          </td>

                          {/* Payment */}
                          <td className="py-3 px-4">{paymentBadge}</td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">{statusBadge}</td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            {m.totalDue > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCollectDue(m)}
                                className="px-3 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-semibold transition-colors"
                              >
                                Collect Due
                              </button>
                            ) : isTrial ? (
                              <button
                                type="button"
                                onClick={() => handleOpenRenew(m)}
                                className="px-3 py-1 rounded-lg border border-blue-300 text-blue-800 hover:bg-blue-50 text-xs font-semibold transition-colors"
                              >
                                Upgrade
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenRenew(m)}
                                className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                              >
                                Renew
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination strip */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {filteredMemberships.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-700">
                  {Math.min(currentPage * itemsPerPage, filteredMemberships.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {filteredMemberships.length}
                </span>{" "}
                members
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                        currentPage === pNum
                          ? "bg-emerald-700 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE CARDS VIEW (390px) */}
          <div className="block md:hidden space-y-3">
            {paginatedMemberships.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
                No memberships found matching your filters.
              </div>
            ) : (
              paginatedMemberships.map((m) => {
                const isTrial =
                  m.isTrial ||
                  m.planPrice === 0 ||
                  m.planName.toLowerCase().includes("trial");

                const memberCode = m.memberCode || `#${m.memberPhone.slice(-4) || "1001"}`;
                const initials = m.memberName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                // Accent border color based on status
                const accentBorder = isTrial
                  ? "border-l-blue-500"
                  : m.isExpiringSoon
                  ? "border-l-amber-500"
                  : m.status === "expired"
                  ? "border-l-rose-500"
                  : "border-l-emerald-500";

                return (
                  <div
                    key={m.id}
                    className={`bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 border-l-4 ${accentBorder} flex flex-col justify-between gap-2.5`}
                  >
                    {/* Row 1: Avatar, Name (#ID), Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm leading-tight">
                            {m.memberName}{" "}
                            <span className="text-xs font-normal text-slate-400 font-mono">
                              ({memberCode})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {m.memberPhone}
                          </div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          isTrial
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : m.isExpiringSoon
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : m.status === "expired"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {isTrial
                          ? "Trial"
                          : m.isExpiringSoon
                          ? "Expiring"
                          : m.status === "expired"
                          ? "Expired"
                          : "Active"}
                      </span>
                    </div>

                    {/* Row 2: Plan & Final amount line, offer, payment pill, validity */}
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span>
                          {m.planName} · ₹{m.planPrice.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {m.status === "expired"
                            ? `${Math.abs(m.daysRemaining)}d ago`
                            : `${m.daysRemaining}d left`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {formatTimelineDate(m.startDate)} &rarr; {formatTimelineDate(m.endDate)}
                        </span>
                        {m.totalDue > 0 ? (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            ₹{m.totalDue.toLocaleString("en-IN")} Due
                          </span>
                        ) : isTrial ? (
                          <span className="text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            Free
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                            Paid
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Action Button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                      {m.totalDue > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCollectDue(m)}
                          className="w-full py-1.5 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold text-center transition-colors shadow-xs"
                        >
                          Collect Due
                        </button>
                      ) : isTrial ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRenew(m)}
                          className="w-full py-1.5 px-3 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold text-center transition-colors shadow-xs"
                        >
                          Upgrade
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenRenew(m)}
                          className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold text-center transition-colors shadow-xs"
                        >
                          Renew
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-600 px-3">
                  {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Assign Membership Modal */}
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
        onSuccess={(result) => {
          setAssignModalOpen(false);
          showMessage("success", `Assigned "${result.planName}" to ${result.memberName}!`);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* 2. Renew / Upgrade Membership Modal */}
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
          onSuccess={(result) => {
            setRenewModalOpen(false);
            setTargetMembership(null);
            showMessage("success", `Membership renewed for ${targetMembership.memberName}!`);
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* 3. Collect Due Modal */}
      <CollectDueModal
        gymId={gymId}
        membership={targetMembership}
        isOpen={collectDueModalOpen}
        onClose={() => {
          setCollectDueModalOpen(false);
          setTargetMembership(null);
        }}
        onSuccess={(amountPaid, memberName) => {
          setCollectDueModalOpen(false);
          setTargetMembership(null);
          showMessage(
            "success",
            `Collected ₹${amountPaid.toLocaleString("en-IN")} from ${memberName}!`
          );
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* 4. Bulk Assign Modal for Unassigned Members */}
      <BulkAssignModal
        gymId={gymId}
        selectedMembers={unassignedMembers}
        plans={detailedPlans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          durationDays: p.durationDays,
          branchId: p.branchId,
          isActive: p.isActive,
        }))}
        isOpen={bulkAssignModalOpen}
        onClose={() => setBulkAssignModalOpen(false)}
        onSuccess={() => {
          setBulkAssignModalOpen(false);
          showMessage("success", "Bulk plan assignment completed successfully!");
          startTransition(() => {
            router.refresh();
          });
        }}
      />
    </div>
  );
}
