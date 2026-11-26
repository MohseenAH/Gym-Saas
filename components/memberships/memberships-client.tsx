"use client";

import { useState, useMemo, startTransition } from "react";
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
  Layers,
  Sparkles,
  Crown,
  Star,
  Zap,
  Dumbbell,
  SlidersHorizontal,
  X,
  User,
  RefreshCw,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ManageMembershipModal,
  MembershipPlanOption,
} from "./manage-membership-modal";
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
type MembershipFilterTab =
  | "all"
  | "active"
  | "trial"
  | "expiring"
  | "expired"
  | "unassigned"
  | "pending";

type MobileRecordItem =
  | { kind: "contract"; membership: MembershipItem }
  | { kind: "unassigned"; member: AssignableUnassignedMember };

const PLAN_SURFACE_STYLES = [
  {
    iconKey: "dumbbell",
    iconBox:
      "bg-purple-500/12 text-purple-600 [.dark_&]:bg-purple-500/20 [.dark_&]:text-purple-300",
    selectedCard:
      "bg-purple-50/85 border-purple-400/75 [.dark_&]:bg-purple-500/[0.16] [.dark_&]:border-purple-400/55",
    idleCard:
      "bg-card hover:bg-muted/30 border-border",
  },
  {
    iconKey: "crown",
    iconBox:
      "bg-amber-500/15 text-amber-600 [.dark_&]:bg-amber-500/20 [.dark_&]:text-amber-300",
    selectedCard:
      "bg-amber-50/85 border-amber-400/75 [.dark_&]:bg-amber-500/[0.16] [.dark_&]:border-amber-400/55",
    idleCard:
      "bg-card hover:bg-muted/30 border-border",
  },
  {
    iconKey: "star",
    iconBox:
      "bg-orange-500/14 text-orange-600 [.dark_&]:bg-orange-500/20 [.dark_&]:text-orange-300",
    selectedCard:
      "bg-orange-50/85 border-orange-400/75 [.dark_&]:bg-orange-500/[0.16] [.dark_&]:border-orange-400/55",
    idleCard:
      "bg-card hover:bg-muted/30 border-border",
  },
  {
    iconKey: "calendar",
    iconBox:
      "bg-blue-500/12 text-blue-600 [.dark_&]:bg-blue-500/20 [.dark_&]:text-blue-300",
    selectedCard:
      "bg-blue-50/85 border-blue-400/75 [.dark_&]:bg-blue-500/[0.16] [.dark_&]:border-blue-400/55",
    idleCard:
      "bg-card hover:bg-muted/30 border-border",
  },
] as const;

const TRIAL_PLAN_STYLE = {
  iconKey: "zap",
  iconBox:
    "bg-rose-500/12 text-rose-600 [.dark_&]:bg-rose-500/20 [.dark_&]:text-rose-300",
  selectedCard:
    "bg-rose-50/90 border-rose-400/75 [.dark_&]:bg-rose-500/[0.16] [.dark_&]:border-rose-400/55",
  idleCard:
    "bg-rose-50/45 border-rose-200/70 [.dark_&]:bg-rose-500/[0.08] [.dark_&]:border-rose-500/25",
} as const;

function renderPlanIcon(iconKey: string) {
  switch (iconKey) {
    case "crown":
      return <Crown className="w-4 h-4" />;
    case "star":
      return <Star className="w-4 h-4" />;
    case "calendar":
      return <Calendar className="w-4 h-4" />;
    case "zap":
      return <Zap className="w-4 h-4" />;
    default:
      return <Dumbbell className="w-4 h-4" />;
  }
}

function formatMobileDateRange(startStr: string, endStr: string): string {
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const sDate = s.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    const eDate = e.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${sDate} – ${eDate}`;
  } catch {
    return `${startStr} – ${endStr}`;
  }
}

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
  initialTab = "active",
}: MembershipsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine top-level view: 'all' vs 'plans'
  const requestedView = searchParams.get("view");
  const initialViewMode: MainViewMode =
    requestedView === "plans" || initialTab === "plans" ? "plans" : "all";

  const [viewMode, setViewMode] = useState<MainViewMode>(initialViewMode);
  const [prevRequestedView, setPrevRequestedView] = useState<string | null>(
    requestedView
  );
  if (requestedView !== prevRequestedView) {
    setPrevRequestedView(requestedView);
    if (requestedView === "plans" || initialTab === "plans") {
      setViewMode("plans");
    } else if (requestedView === "all") {
      setViewMode("all");
    }
  }
  const [filterTab, setFilterTab] = useState<MembershipFilterTab>(
    initialTab === "unassigned" ? "unassigned" : "all"
  );
  const [selectedPlanFilterId, setSelectedPlanFilterId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [selectedMobileRecord, setSelectedMobileRecord] =
    useState<MobileRecordItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [targetMembership, setTargetMembership] = useState<MembershipItem | null>(null);
  const [preselectedMemberId, setPreselectedMemberId] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
      if (filterTab === "unassigned") {
        return false;
      } else if (filterTab === "active") {
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

      if (selectedPlanFilterId && m.planId !== selectedPlanFilterId) {
        return false;
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
  }, [memberships, filterTab, selectedPlanFilterId, searchTerm]);

  const filteredUnassignedMembers = useMemo(() => {
    if (selectedPlanFilterId) return [];
    if (filterTab !== "all" && filterTab !== "unassigned") return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return unassignedMembers;
    return unassignedMembers.filter((m) => {
      const memberCode = `#${m.phone ? m.phone.slice(-4) : "1001"}`.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(term) ||
        m.phone.includes(term) ||
        memberCode.includes(term)
      );
    });
  }, [unassignedMembers, filterTab, selectedPlanFilterId, searchTerm]);

  const mobileRecords = useMemo<MobileRecordItem[]>(() => {
    const contractRows: MobileRecordItem[] = filteredMemberships.map((m) => ({
      kind: "contract",
      membership: m,
    }));
    const unassignedRows: MobileRecordItem[] = filteredUnassignedMembers.map((m) => ({
      kind: "unassigned",
      member: m,
    }));
    return [...contractRows, ...unassignedRows];
  }, [filteredMemberships, filteredUnassignedMembers]);

  // Pagination slice
  const totalPages = Math.ceil(filteredMemberships.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMemberships = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredMemberships.slice(start, start + itemsPerPage);
  }, [filteredMemberships, safePage]);

  const mobileTotalPages = Math.ceil(mobileRecords.length / itemsPerPage) || 1;
  const safeMobilePage = Math.min(currentPage, mobileTotalPages);
  const paginatedMobileRecords = useMemo(() => {
    const start = (safeMobilePage - 1) * itemsPerPage;
    return mobileRecords.slice(start, start + itemsPerPage);
  }, [mobileRecords, safeMobilePage]);

  const bulkPlans = useMemo(() => {
    if (detailedPlans && detailedPlans.length > 0) {
      return detailedPlans.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        durationDays: p.durationDays,
        branchId: p.branchId,
        isActive: p.isActive,
      }));
    }
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      durationDays: p.durationDays,
      branchId: selectedBranchId || "",
      isActive: true,
    }));
  }, [detailedPlans, plans, selectedBranchId]);

  function handleOpenManagePlan(membership: MembershipItem) {
    setTargetMembership(membership);
    setManageModalOpen(true);
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
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

      {/* PAGE HEADER & TAB SWITCHER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {viewMode === "plans" ? (
                <Tag className="w-4 h-4" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {viewMode === "plans" ? "Plans & Offers" : "Memberships"}
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 flex-wrap">
            {unassignedMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setBulkAssignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 [.dark_&]:text-amber-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{unassignedMembers.length} Unassigned Members</span>
                <span className="text-[11px] underline ml-1">Bulk Assign &rarr;</span>
              </button>
            )}

            {viewMode === "all" && canManageMembers && (
              <button
                type="button"
                onClick={() => setAssignModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Assign Plan</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:inline-flex p-1 bg-muted/60 rounded-full border border-border">
          <button
            type="button"
            onClick={() => handleSwitchView("all")}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer ${
              viewMode === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <IdCard className="w-4 h-4 shrink-0" />
            <span className="truncate">Memberships</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchView("plans")}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer ${
              viewMode === "plans"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span className="truncate">Plans &amp; Offers</span>
          </button>
        </div>
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

      {/* VIEW 1: ALL MEMBERSHIPS */}
      {viewMode === "all" && (
        <div className="space-y-5">
          {/* Plans in Use Strip */}
          {detailedPlans && detailedPlans.length > 0 && (
            <section aria-label="Plans in Use" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Plans in Use</h2>
                <button
                  type="button"
                  onClick={() => handleSwitchView("plans")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  <span>View All Plans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Desktop Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {detailedPlans.slice(0, 5).map((plan, idx) => {
                  const tints = [
                    "bg-card bg-gradient-to-br from-purple-50 via-purple-50/85 to-purple-100/60 border-purple-200/90 dark:from-purple-500/[0.17] dark:via-purple-500/[0.11] dark:to-purple-500/[0.07] dark:border-purple-500/30",
                    "bg-card bg-gradient-to-br from-amber-50 via-amber-50/85 to-amber-100/60 border-amber-200/90 dark:from-amber-500/[0.17] dark:via-amber-500/[0.11] dark:to-amber-500/[0.07] dark:border-amber-500/30",
                    "bg-card bg-gradient-to-br from-blue-50 via-blue-50/85 to-blue-100/60 border-blue-200/90 dark:from-blue-500/[0.17] dark:via-blue-500/[0.11] dark:to-blue-500/[0.07] dark:border-blue-500/30",
                    "bg-card bg-gradient-to-br from-emerald-50 via-emerald-50/85 to-emerald-100/60 border-emerald-200/90 dark:from-emerald-500/[0.17] dark:via-emerald-500/[0.11] dark:to-emerald-500/[0.07] dark:border-emerald-500/30",
                    "bg-card bg-gradient-to-br from-rose-50 via-rose-50/85 to-rose-100/60 border-rose-200/90 dark:from-rose-500/[0.17] dark:via-rose-500/[0.11] dark:to-rose-500/[0.07] dark:border-rose-500/30",
                  ];
                  const tint = tints[idx % tints.length];
                  const isPlanSelected = selectedPlanFilterId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        setSelectedPlanFilterId((prev) =>
                          prev === plan.id ? null : plan.id
                        )
                      }
                      className={`p-3.5 rounded-2xl border text-left shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-2 ${tint} ${
                        isPlanSelected ? "ring-2 ring-primary/50 border-primary" : ""
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-foreground truncate">
                          {plan.name}
                        </div>
                        <div className="text-lg font-extrabold text-foreground tabular-nums mt-0.5">
                          ₹{plan.price.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {plan.durationDays} Days
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>
                          {plan.activeSubscribersCount}{" "}
                          {plan.activeSubscribersCount === 1 ? "Member" : "Members"}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Compact Horizontal Cards */}
              <div className="sm:hidden flex flex-col gap-1.5">
                {detailedPlans.slice(0, 5).map((plan, idx) => {
                  const isTrialPlan =
                    plan.price === 0 || plan.name.toLowerCase().includes("trial");
                  const planStyle = isTrialPlan
                    ? TRIAL_PLAN_STYLE
                    : PLAN_SURFACE_STYLES[idx % PLAN_SURFACE_STYLES.length];
                  const isPlanSelected = selectedPlanFilterId === plan.id;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      aria-pressed={isPlanSelected}
                      onClick={() => {
                        setSelectedPlanFilterId((prev) =>
                          prev === plan.id ? null : plan.id
                        );
                        setFilterTab("all");
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2.5 text-left shadow-2xs transition-all cursor-pointer ${
                        isPlanSelected ? planStyle.selectedCard : planStyle.idleCard
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${planStyle.iconBox}`}
                        >
                          {renderPlanIcon(planStyle.iconKey)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-foreground truncate leading-tight">
                            {plan.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground tabular-nums truncate leading-tight mt-0.5">
                            ₹{plan.price.toLocaleString("en-IN")} · {plan.durationDays} Days
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground shrink-0">
                        <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="tabular-nums whitespace-nowrap">
                          {plan.activeSubscribersCount}{" "}
                          {plan.activeSubscribersCount === 1 ? "Member" : "Members"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 4-Metric Summary Strip */}
          {/* Desktop 4-column row (hidden on mobile per approved mobile layout) */}
          <div className="hidden md:grid md:grid-cols-4 gap-3">
            <KpiCard
              label="Active Memberships"
              value={stats.active}
              variant="green"
              icon={<CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            />
            <KpiCard
              label="Trial Memberships"
              value={stats.trial}
              variant="blue"
              icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
            />
            <KpiCard
              label="Expiring Soon"
              value={stats.expiring}
              variant="amber"
              icon={<AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />}
            />
            <KpiCard
              label="Expired Memberships"
              value={stats.expired}
              variant="purple"
              icon={<XCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
            />
          </div>

          {/* Search Bar & Filters */}
          <div className="space-y-2.5 md:space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search member by name or ID..."
                className="w-full h-10 pl-10 pr-9 text-sm bg-card border border-input rounded-xl focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary text-foreground placeholder:text-muted-foreground shadow-xs transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  aria-label="Clear member search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile Status Select + Filter / Quick Actions Bar */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={filterTab}
                  onChange={(e) => {
                    setFilterTab(e.target.value as MembershipFilterTab);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter membership status"
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-card border border-border text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <option value="all">
                    All Status ({stats.total + unassignedMembers.length})
                  </option>
                  <option value="active">Active ({stats.active})</option>
                  <option value="expiring">Expiring ({stats.expiring})</option>
                  <option value="expired">Expired ({stats.expired})</option>
                  <option value="trial">Trial ({stats.trial})</option>
                  <option value="unassigned">
                    Unassigned ({unassignedMembers.length})
                  </option>
                  <option value="pending">
                    Payment Pending ({stats.pendingPayment})
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() => setMobileActionsOpen((v) => !v)}
                  aria-expanded={mobileActionsOpen}
                  aria-label="Toggle quick actions and status filters"
                  className={`h-10 w-10 rounded-xl border inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    mobileActionsOpen || filterTab !== "all" || selectedPlanFilterId
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-card text-muted-foreground hover:text-foreground border-border"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>

              {mobileActionsOpen && (
                <div className="p-3 rounded-2xl bg-card border border-border shadow-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canManageMembers && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setPreselectedMemberId(undefined);
                          setAssignModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Assign Plan</span>
                      </button>
                    )}
                    {canManageMembers && unassignedMembers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setBulkAssignModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/12 text-amber-800 [.dark_&]:text-amber-300 border border-amber-500/25 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Bulk Assign ({unassignedMembers.length})</span>
                      </button>
                    )}
                    {(filterTab !== "all" || selectedPlanFilterId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterTab("all");
                          setSelectedPlanFilterId(null);
                          setCurrentPage(1);
                          setMobileActionsOpen(false);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-muted text-foreground text-xs font-semibold cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Filter Pills */}
            <div className="hidden md:flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterTab === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>All</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterTab === "all"
                      ? "bg-white/20 text-white"
                      : "bg-card text-muted-foreground border border-border/60"
                  }`}
                >
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("active")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterTab === "active"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Active</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterTab === "active"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {stats.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("trial")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterTab === "trial"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Trial</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterTab === "trial"
                      ? "bg-white/20 text-white"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {stats.trial}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("expiring")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterTab === "expiring"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Expiring Soon</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterTab === "expiring"
                      ? "bg-white/20 text-white"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {stats.expiring}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("expired")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterTab === "expired"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Expired</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterTab === "expired"
                      ? "bg-white/20 text-white"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {stats.expired}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("pending")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterTab === "pending"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 hover:bg-muted text-foreground border border-border"
                }`}
              >
                <span>Payment Pending</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                    filterTab === "pending"
                      ? "bg-white/20 text-white"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {stats.pendingPayment}
                </span>
              </button>
            </div>
          </div>

          {/* DESKTOP TABLE VIEW (1440px) */}
          <div className="hidden md:block bg-card rounded-2xl border border-border shadow-xs overflow-hidden text-card-foreground">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Membership Plan</th>
                    <th className="py-3 px-4">Expiry Timeline</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paginatedMemberships.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          Paid
                        </span>
                      );
                      if (isTrial || m.planPrice === 0) {
                        paymentBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                            Free
                          </span>
                        );
                      } else if (m.totalDue > 0) {
                        paymentBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            Partial (₹{m.totalDue.toLocaleString("en-IN")} Due)
                          </span>
                        );
                      }

                      // Membership status badge
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active ({m.daysRemaining}d left)
                        </span>
                      );
                      if (isTrial) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Trial ({m.daysRemaining}d left)
                          </span>
                        );
                      } else if (m.isExpiringSoon) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Expiring ({m.daysRemaining}d left)
                          </span>
                        );
                      } else if (m.status === "expired") {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Expired ({Math.abs(m.daysRemaining)}d ago)
                          </span>
                        );
                      }

                      return (
                        <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                          {/* Member */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-muted text-foreground font-bold flex items-center justify-center text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <Link
                                  href={`/app/${gymId}/members?search=${encodeURIComponent(m.memberName)}`}
                                  className="font-semibold text-foreground hover:text-emerald-500 hover:underline"
                                >
                                  {m.memberName}
                                </Link>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {memberCode}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Membership Plan & Offer */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">
                              {basePriceLine}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-medium">
                              {offerLine}
                            </div>
                          </td>

                          {/* Expiry Timeline */}
                          <td className="py-3 px-4 text-muted-foreground font-medium tabular-nums whitespace-nowrap">
                            {formatTimelineDate(m.startDate)} &rarr; {formatTimelineDate(m.endDate)}
                          </td>

                          {/* Payment */}
                          <td className="py-3 px-4">{paymentBadge}</td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">{statusBadge}</td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenManagePlan(m)}
                                className="px-3 py-1 rounded-lg border border-border bg-muted/30 hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Manage Plan
                              </button>
                              <Link
                                href={`/app/${gymId}/members/${m.memberId}`}
                                className="px-2 py-1 rounded-lg border border-border bg-muted/20 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                                title="View Member Profile"
                              >
                                360° ↗
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

            {/* Pagination strip */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
              <div>
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {filteredMemberships.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(currentPage * itemsPerPage, filteredMemberships.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">
                  {filteredMemberships.length}
                </span>{" "}
                members
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
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
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        currentPage === pNum
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "border border-border bg-card text-foreground hover:bg-muted"
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
                  className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE COMPACT GROUPED LIST (390px Reference) */}
          <div className="block md:hidden space-y-3">
            {paginatedMobileRecords.length === 0 ? (
              <div className="p-8 text-center bg-card rounded-2xl border border-border text-muted-foreground text-xs">
                No memberships found matching your filters.
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-xs">
                {paginatedMobileRecords.map((item) => {
                  if (item.kind === "unassigned") {
                    const u = item.member;
                    const memberCode = `#${u.phone ? u.phone.slice(-4) : "1001"}`;
                    const initials =
                      u.fullName
                        .split(" ")
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase() || "M";

                    return (
                      <button
                        key={`unassigned-${u.id}`}
                        type="button"
                        onClick={() => setSelectedMobileRecord(item)}
                        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-500/12 text-slate-700 [.dark_&]:bg-slate-500/20 [.dark_&]:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-foreground text-sm leading-tight truncate">
                            {u.fullName}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                            {memberCode} · —
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/12 text-slate-700 [.dark_&]:bg-slate-500/20 [.dark_&]:text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                            <span>Unassigned</span>
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      </button>
                    );
                  }

                  const m = item.membership;
                  const isTrial =
                    m.isTrial ||
                    m.planPrice === 0 ||
                    m.planName.toLowerCase().includes("trial");

                  const memberCode =
                    m.memberCode || `#${m.memberPhone.slice(-4) || "1001"}`;
                  const initials =
                    m.memberName
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase() || "M";

                  const badgeStyle = isTrial
                    ? {
                        pill: "bg-purple-500/12 text-purple-700 [.dark_&]:bg-purple-500/20 [.dark_&]:text-purple-300",
                        dot: "bg-purple-500",
                        avatar:
                          "bg-purple-500/12 text-purple-700 [.dark_&]:bg-purple-500/20 [.dark_&]:text-purple-300",
                        label: "Trial",
                      }
                    : m.status === "expired"
                    ? {
                        pill: "bg-rose-500/12 text-rose-700 [.dark_&]:bg-rose-500/20 [.dark_&]:text-rose-300",
                        dot: "bg-rose-500",
                        avatar:
                          "bg-rose-500/12 text-rose-700 [.dark_&]:bg-rose-500/20 [.dark_&]:text-rose-300",
                        label: "Expired",
                      }
                    : m.isExpiringSoon
                    ? {
                        pill: "bg-amber-500/15 text-amber-700 [.dark_&]:bg-amber-500/20 [.dark_&]:text-amber-300",
                        dot: "bg-amber-500",
                        avatar:
                          "bg-amber-500/15 text-amber-700 [.dark_&]:bg-amber-500/20 [.dark_&]:text-amber-300",
                        label: "Expiring",
                      }
                    : {
                        pill: "bg-emerald-500/12 text-emerald-700 [.dark_&]:bg-emerald-500/20 [.dark_&]:text-emerald-300",
                        dot: "bg-emerald-500",
                        avatar:
                          "bg-emerald-500/12 text-emerald-700 [.dark_&]:bg-emerald-500/20 [.dark_&]:text-emerald-300",
                        label: "Active",
                      };

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMobileRecord(item)}
                      className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${badgeStyle.avatar}`}
                      >
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-foreground text-sm leading-tight truncate">
                          {m.memberName}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                          {memberCode} · {m.planName}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums leading-tight truncate mt-0.5">
                          {formatMobileDateRange(m.startDate, m.endDate)}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badgeStyle.pill}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${badgeStyle.dot}`}
                          />
                          <span>{badgeStyle.label}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Mobile Pagination */}
            {mobileTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  className="p-2 rounded-xl border border-border bg-card text-foreground disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-muted-foreground px-3">
                  {currentPage} of {mobileTotalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= mobileTotalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(mobileTotalPages, p + 1))
                  }
                  aria-label="Next page"
                  className="p-2 rounded-xl border border-border bg-card text-foreground disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Contextual Membership Action Sheet */}
      {selectedMobileRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Membership Record Actions"
          className="fixed inset-0 z-50 md:hidden bg-black/60 backdrop-blur-xs flex items-end justify-center p-3 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMobileRecord(null);
          }}
        >
          <div className="bg-card text-card-foreground rounded-2xl w-full max-w-md p-4 shadow-2xl border border-border space-y-3">
            {selectedMobileRecord.kind === "contract" ? (
              <>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {selectedMobileRecord.membership.memberName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {selectedMobileRecord.membership.planName} · ₹
                      {selectedMobileRecord.membership.planPrice.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                      {formatMobileDateRange(
                        selectedMobileRecord.membership.startDate,
                        selectedMobileRecord.membership.endDate
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMobileRecord(null)}
                    aria-label="Close actions"
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedMobileRecord.membership;
                        setSelectedMobileRecord(null);
                        handleOpenManagePlan(target);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span>Manage Plan / Extend / Change</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        const memberId = selectedMobileRecord.membership.memberId;
                        setSelectedMobileRecord(null);
                        setPreselectedMemberId(memberId);
                        setAssignModalOpen(true);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-foreground text-sm font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-primary" />
                        <span>Renew / Assign New Plan</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}

                  <Link
                    href={`/app/${gymId}/members/${selectedMobileRecord.membership.memberId}`}
                    onClick={() => setSelectedMobileRecord(null)}
                    className="w-full h-11 px-3.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground text-sm font-semibold flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>View Member Profile</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {selectedMobileRecord.member.fullName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Unassigned · No active membership plan
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMobileRecord(null)}
                    aria-label="Close actions"
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        const memberId = selectedMobileRecord.member.id;
                        setSelectedMobileRecord(null);
                        setPreselectedMemberId(memberId);
                        setAssignModalOpen(true);
                      }}
                      className="w-full h-11 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        <span>Assign Plan</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  <Link
                    href={`/app/${gymId}/members/${selectedMobileRecord.member.id}`}
                    onClick={() => setSelectedMobileRecord(null)}
                    className="w-full h-11 px-3.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground text-sm font-semibold flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>View Member Profile</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Assign Membership Modal */}
      <AssignMembershipModal
        key={`${assignModalOpen}-${preselectedMemberId || "default"}`}
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
        initialMemberId={preselectedMemberId}
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setPreselectedMemberId(undefined);
        }}
        onSuccess={(result) => {
          setAssignModalOpen(false);
          setPreselectedMemberId(undefined);
          showMessage("success", `Assigned "${result.planName}" to ${result.memberName}!`);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* 2. Manage Plan & Validity Modal */}
      <ManageMembershipModal
        gymId={gymId}
        membership={targetMembership}
        plans={plans}
        isOpen={manageModalOpen}
        onClose={() => {
          setManageModalOpen(false);
          setTargetMembership(null);
        }}
        onOpenAssignModal={(memberId) => {
          setPreselectedMemberId(memberId);
          setAssignModalOpen(true);
        }}
        onSuccess={(msg) => {
          showMessage("success", msg);
        }}
      />

      {/* 3. Bulk Assign Modal for Unassigned Members */}
      <BulkAssignModal
        gymId={gymId}
        selectedMembers={unassignedMembers}
        plans={bulkPlans}
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
