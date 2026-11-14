"use client";

import { useState, useMemo, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Building2,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Power,
  ShieldAlert,
  Loader2,
  IndianRupee,
} from "lucide-react";
import { CreatePlanModal } from "./create-plan-modal";
import { EditPlanModal, EditablePlan } from "./edit-plan-modal";

export interface PlanDetailItem {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  description?: string | null;
  durationDays: number;
  price: number;
  isActive: boolean;
  usageCount: number;
  activeSubscribersCount: number;
  createdAt: string;
}

interface PlansManagerClientProps {
  gymId: string;
  plans: PlanDetailItem[];
  branches: { id: string; name: string }[];
  canManagePlans: boolean;
  selectedBranchId?: string;
}

type StatusFilter = "all" | "active" | "inactive";

export function PlansManagerClient({
  gymId,
  plans: initialPlans,
  branches,
  canManagePlans,
  selectedBranchId,
}: PlansManagerClientProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDetailItem[]>(initialPlans);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || "all");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPlanToEdit, setSelectedPlanToEdit] = useState<EditablePlan | null>(null);

  // Notifications & loading
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Compute KPI stats
  const stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let totalSubscribers = 0;

    plans.forEach((p) => {
      if (p.isActive) active++;
      else inactive++;
      totalSubscribers += p.activeSubscribersCount;
    });

    return {
      total: plans.length,
      active,
      inactive,
      totalSubscribers,
    };
  }, [plans]);

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          p.name.toLowerCase().includes(term) ||
          p.branchName.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term));
        if (!matches) return false;
      }

      // 2. Status filter
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;

      // 3. Branch filter
      if (branchFilter !== "all" && p.branchId !== branchFilter) return false;

      return true;
    });
  }, [plans, searchTerm, statusFilter, branchFilter]);

  function showMessage(type: "success" | "error", text: string) {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  }

  // Handle plan status toggle
  async function handleToggleStatus(plan: PlanDetailItem) {
    if (!canManagePlans) return;
    setActionLoadingId(plan.id);

    const nextState = !plan.isActive;
    try {
      const response = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          planId: plan.id,
          isActive: nextState,
        }),
      });
      const res = await response.json();

      if (!res.success) {
        showMessage("error", res.error || "Failed to update plan status");
      } else {
        setPlans((prev) =>
          prev.map((p) => (p.id === plan.id ? { ...p, isActive: nextState } : p))
        );
        showMessage(
          "success",
          `Plan "${plan.name}" is now ${nextState ? "Active" : "Archived/Inactive"}.`
        );
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update plan status");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Handle hard delete (allowed only if usageCount === 0)
  async function handleDeletePlan(plan: PlanDetailItem) {
    if (!canManagePlans) return;
    if (plan.usageCount > 0) {
      showMessage(
        "error",
        "Cannot delete a plan with subscriber history. Toggle to Inactive instead."
      );
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete plan "${plan.name}"?`)) {
      return;
    }

    setActionLoadingId(plan.id);
    try {
      const response = await fetch("/api/plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          planId: plan.id,
        }),
      });
      const res = await response.json();

      if (!res.success) {
        showMessage("error", res.error || "Failed to delete plan");
      } else {
        setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        showMessage("success", `Plan "${plan.name}" permanently deleted.`);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setActionLoadingId(null);
    }
  }

  function handleOpenEdit(plan: PlanDetailItem) {
    setSelectedPlanToEdit({
      id: plan.id,
      branchId: plan.branchId,
      branchName: plan.branchName,
      name: plan.name,
      description: plan.description || undefined,
      durationDays: plan.durationDays,
      price: plan.price,
      isActive: plan.isActive,
      usageCount: plan.usageCount,
    });
    setEditModalOpen(true);
  }

  function handlePlanCreated(newPlan: {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    branchId: string;
  }) {
    const branch = branches.find((b) => b.id === newPlan.branchId);
    const item: PlanDetailItem = {
      id: newPlan.id,
      branchId: newPlan.branchId,
      branchName: branch?.name || "Main Branch",
      name: newPlan.name,
      durationDays: newPlan.durationDays,
      price: newPlan.price,
      isActive: true,
      usageCount: 0,
      activeSubscribersCount: 0,
      createdAt: new Date().toISOString(),
    };
    setPlans([item, ...plans]);
    showMessage("success", `Plan "${newPlan.name}" created successfully!`);
    startTransition(() => {
      router.refresh();
    });
  }

  function handlePlanEdited(result: {
    planId: string;
    versioned?: boolean;
    name: string;
    price: number;
    durationDays: number;
    isActive: boolean;
  }) {
    if (result.versioned) {
      // Update plan in local state with new ID and terms
      setPlans((prev) =>
        prev.map((p) =>
          p.id === selectedPlanToEdit?.id
            ? {
                ...p,
                id: result.planId,
                name: result.name,
                price: result.price,
                durationDays: result.durationDays,
                isActive: result.isActive,
                usageCount: 0,
                activeSubscribersCount: 0,
              }
            : p
        )
      );
      showMessage(
        "success",
        `Plan updated with new terms! Historical contracts preserved.`
      );
      startTransition(() => {
        router.refresh();
      });
    } else {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === result.planId
            ? {
                ...p,
                name: result.name,
                price: result.price,
                durationDays: result.durationDays,
                isActive: result.isActive,
              }
            : p
        )
      );
      showMessage("success", `Plan "${result.name}" updated successfully.`);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            notification.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-600"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="hover:opacity-75 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider">
            Total Plans
          </div>
          <div className="text-xl sm:text-3xl font-black text-foreground mt-1 sm:mt-2">{stats.total}</div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1">Configured templates</div>
        </div>

        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <div className="text-[10px] sm:text-xs text-emerald-600 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Active Plans</span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-600 mt-1 sm:mt-2">
            {stats.active}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1">Available for enrollments</div>
        </div>

        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Archived Plans</span>
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-muted-foreground mt-1 sm:mt-2">
            {stats.inactive}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1">Paused or retired</div>
        </div>

        <div className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs text-card-foreground">
          <div className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Subscribers</span>
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-foreground mt-1 sm:mt-2">
            {stats.totalSubscribers}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1">Members currently subscribed</div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-card p-4 sm:p-5 rounded-3xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-card-foreground">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl w-full sm:w-auto border border-border/60">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-card text-foreground shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Plans ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "active"
                ? "bg-card text-emerald-600 shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-card text-muted-foreground shadow-2xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived ({stats.inactive})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plans..."
              className="w-full h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-11 px-3 bg-muted/40 border border-input rounded-xl text-xs font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {canManagePlans && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center justify-center gap-1.5 h-10 sm:h-11 px-4 bg-primary hover:opacity-95 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary/20 transition-all shrink-0 cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border p-12 text-center shadow-xs text-card-foreground">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No Membership Plans Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            {searchTerm || statusFilter !== "all" || branchFilter !== "all"
              ? "No plans match your current search or status filter."
              : "No membership plans have been configured yet. Create standard membership tiers for your gym."}
          </p>
          {canManagePlans && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl bg-primary hover:opacity-95 text-primary-foreground text-xs sm:text-sm font-bold shadow-md shadow-primary/25 cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Create First Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {filteredPlans.map((plan) => {
            const isLoading = actionLoadingId === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-card rounded-2xl sm:rounded-3xl border p-3 sm:p-5 transition-all shadow-xs flex flex-col justify-between text-card-foreground ${
                  plan.isActive
                    ? "border-border hover:border-primary/40 hover:shadow-md"
                    : "border-border/60 bg-muted/20 opacity-80"
                }`}
              >
                <div>
                  {/* Top line: Branch & Status Badge */}
                  <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold bg-muted text-muted-foreground border border-border truncate">
                      <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{plan.branchName}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(plan)}
                      disabled={isLoading || !canManagePlans}
                      className={`inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        plan.isActive
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {plan.isActive ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Inactive
                        </>
                      )}
                    </button>
                  </div>

                  {/* Plan Name & Price */}
                  <h3 className="text-xs sm:text-base font-bold text-foreground tracking-tight truncate">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-2 sm:mt-4 flex items-baseline gap-1 text-foreground">
                    <span className="text-lg sm:text-2xl font-bold tracking-tight truncate">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border shrink-0">
                      <span className="hidden sm:inline">{plan.durationDays} Days</span>
                      <span className="sm:hidden">{plan.durationDays}d</span>
                    </span>
                  </div>

                  {/* Metrics bar */}
                  <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-4 border-t border-border flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 truncate">
                      <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary shrink-0" />
                      <span className="font-bold text-foreground truncate">
                        {plan.activeSubscribersCount}
                      </span>{" "}
                      active
                    </div>
                    <div className="text-[9px] sm:text-[11px] text-muted-foreground font-medium shrink-0">
                      {plan.usageCount} lifetime
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                {canManagePlans && (
                  <div className="mt-3 sm:mt-5 pt-2 sm:pt-3.5 border-t border-border flex items-center justify-between gap-1 sm:gap-2">
                    <button
                      onClick={() => handleToggleStatus(plan)}
                      disabled={isLoading}
                      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer ${
                        plan.isActive
                          ? "text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                          : "text-emerald-600 hover:bg-emerald-500/10"
                      }`}
                      title={plan.isActive ? "Deactivate plan" : "Activate plan"}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                      ) : (
                        <Power className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      )}
                      <span>{plan.isActive ? "Archive" : "Activate"}</span>
                    </button>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                        title="Edit plan details"
                        aria-label="Edit plan"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>

                      {plan.usageCount === 0 && (
                        <button
                          onClick={() => handleDeletePlan(plan)}
                          disabled={isLoading}
                          className="p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete unreferenced plan"
                          aria-label="Delete plan"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreatePlanModal
        gymId={gymId}
        branches={branches}
        defaultBranchId={selectedBranchId}
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handlePlanCreated}
      />

      {selectedPlanToEdit && (
        <EditPlanModal
          gymId={gymId}
          branches={branches}
          plan={selectedPlanToEdit}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedPlanToEdit(null);
          }}
          onSuccess={handlePlanEdited}
        />
      )}
    </div>
  );
}
