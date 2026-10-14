"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { CreatePlanModal } from "./create-plan-modal";
import { EditPlanModal, EditablePlan } from "./edit-plan-modal";
import { togglePlanAction, deletePlanAction } from "@/lib/actions/plans";

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
    const res = await togglePlanAction({
      gymId,
      planId: plan.id,
      isActive: nextState,
    });

    setActionLoadingId(null);

    if (!res.success) {
      showMessage("error", res.error || "Failed to update plan status");
    } else {
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, isActive: nextState } : p))
      );
      showMessage(
        "success",
        `Plan "${plan.name}" has been ${nextState ? "activated" : "deactivated"}.`
      );
    }
  }

  // Handle plan deletion
  async function handleDeletePlan(plan: PlanDetailItem) {
    if (!canManagePlans) return;

    if (plan.usageCount > 0) {
      showMessage(
        "error",
        `Cannot delete "${plan.name}" because it is linked to ${plan.usageCount} member contract(s). Deactivate this plan instead.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete plan "${plan.name}"?`)) {
      return;
    }

    setActionLoadingId(plan.id);
    const res = await deletePlanAction({
      gymId,
      planId: plan.id,
    });
    setActionLoadingId(null);

    if (!res.success) {
      showMessage("error", res.error || "Failed to delete plan");
    } else {
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      showMessage("success", `Plan "${plan.name}" has been deleted.`);
    }
  }

  function handleOpenEdit(plan: PlanDetailItem) {
    setSelectedPlanToEdit({
      id: plan.id,
      branchId: plan.branchId,
      branchName: plan.branchName,
      name: plan.name,
      description: plan.description,
      durationDays: plan.durationDays,
      price: plan.price,
      isActive: plan.isActive,
      usageCount: plan.usageCount,
    });
    setEditModalOpen(true);
  }

  function handleCreateSuccess(newPlan: {
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
      description: null,
      durationDays: newPlan.durationDays,
      price: newPlan.price,
      isActive: true,
      usageCount: 0,
      activeSubscribersCount: 0,
      createdAt: new Date().toISOString(),
    };
    setPlans((prev) => [item, ...prev]);
    showMessage("success", `Membership plan "${newPlan.name}" created successfully!`);
  }

  function handleEditSuccess(result: {
    planId: string;
    versioned?: boolean;
    name: string;
    price: number;
    durationDays: number;
    isActive: boolean;
  }) {
    if (result.versioned) {
      // Historical versioning: reload page or update in list
      showMessage(
        "success",
        `Plan updated with new terms! Historical contracts preserved.`
      );
      window.location.reload();
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
    }
  }

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-600" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Total Plans
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Configured templates</div>
        </div>

        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80">
          <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Active Plans</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {stats.active}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Available for new enrollments</div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Inactive Plans</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-600 mt-2">
            {stats.inactive}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Archived or paused</div>
        </div>

        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200/80">
          <div className="text-xs text-indigo-700 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>Active Subscribers</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-2">
            {stats.totalSubscribers}
          </div>
          <div className="text-[11px] text-indigo-600 mt-1">Members currently subscribed</div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Plans ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "active"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "inactive"
                ? "bg-white text-slate-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Inactive ({stats.inactive})
          </button>
        </div>

        {/* Search, Branch Filter, & Create Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden"
              aria-label="Filter plans by branch"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Create Plan
            </button>
          )}
        </div>
      </div>

      {/* Plans Grid / Table */}
      {filteredPlans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Membership Plans Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchTerm || statusFilter !== "all" || branchFilter !== "all"
              ? "No plans match your current search or status filter."
              : "No membership plans have been configured yet. Create standard membership tiers for your gym."}
          </p>
          {canManagePlans && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Create First Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => {
            const isLoading = actionLoadingId === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                  plan.isActive
                    ? "border-slate-200/80 hover:border-indigo-200 hover:shadow-md"
                    : "border-slate-200 bg-slate-50/50 opacity-80"
                }`}
              >
                <div>
                  {/* Top line: Branch & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {plan.branchName}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        plan.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {plan.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Inactive
                        </>
                      )}
                    </span>
                  </div>

                  {/* Plan Name & Price */}
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-baseline gap-1 text-slate-900">
                    <span className="text-2xl font-black">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      / {plan.durationDays} days
                    </span>
                  </div>

                  {/* Metrics bar */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-semibold text-slate-700">
                        {plan.activeSubscribersCount}
                      </span>{" "}
                      active members
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {plan.usageCount} lifetime
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                {canManagePlans && (
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleStatus(plan)}
                      disabled={isLoading}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                        plan.isActive
                          ? "text-slate-600 hover:text-amber-700 hover:bg-amber-50"
                          : "text-emerald-700 hover:bg-emerald-50"
                      }`}
                      title={plan.isActive ? "Deactivate plan" : "Activate plan"}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Power className="w-3.5 h-3.5" />
                      )}
                      <span>{plan.isActive ? "Deactivate" : "Activate"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Edit plan details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {plan.usageCount === 0 && (
                        <button
                          onClick={() => handleDeletePlan(plan)}
                          disabled={isLoading}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete unreferenced plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create Plan Modal */}
      <CreatePlanModal
        gymId={gymId}
        branches={branches}
        defaultBranchId={selectedBranchId}
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Plan Modal */}
      <EditPlanModal
        gymId={gymId}
        branches={branches}
        plan={selectedPlanToEdit}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedPlanToEdit(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
