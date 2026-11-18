"use client";

import { useState, useMemo, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Tag,
  Percent,
  IndianRupee,
  Calendar,
  MoreVertical,
  Power,
  Trash2,
  Clock,
  Sparkles,
} from "lucide-react";
import { CreatePlanModal } from "./create-plan-modal";
import { EditPlanModal, EditablePlan } from "./edit-plan-modal";
import { CreateOfferModal } from "./create-offer-modal";
import { EditOfferModal } from "./edit-offer-modal";
import { togglePlanAction, deletePlanAction } from "@/lib/actions/plans";
import { OfferItem } from "@/lib/validations/offers";

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
  onOffersChange?: (offers: OfferItem[]) => void;
}

type CategoryTab = "all" | "plans" | "offers";

export function PlansManagerClient({
  gymId,
  plans: initialPlans,
  branches,
  canManagePlans,
  selectedBranchId,
  onOffersChange,
}: PlansManagerClientProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDetailItem[]>(initialPlans);
  const [categoryFilter, setCategoryFilter] = useState<CategoryTab>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Plan Modals State
  const [createPlanModalOpen, setCreatePlanModalOpen] = useState(false);
  const [editPlanModalOpen, setEditPlanModalOpen] = useState(false);
  const [selectedPlanToEdit, setSelectedPlanToEdit] = useState<EditablePlan | null>(null);

  // Offer Modals State
  const [createOfferModalOpen, setCreateOfferModalOpen] = useState(false);
  const [editOfferModalOpen, setEditOfferModalOpen] = useState(false);
  const [selectedOfferToEdit, setSelectedOfferToEdit] = useState<OfferItem | null>(null);

  // Offers State (persisted per gym in localStorage)
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [isOffersLoaded, setIsOffersLoaded] = useState(false);

  // Notifications & loading
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load and seed offers from localStorage
  useEffect(() => {
    const storageKey = `gymapra_offers_${gymId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as OfferItem[];
        setOffers(parsed);
        if (onOffersChange) onOffersChange(parsed);
      } else {
        // Seed realistic default offers from blueprint
        const seededOffers: OfferItem[] = [
          {
            id: `seed_ny_${gymId}`,
            gymId,
            title: "New Year Special",
            discountType: "percentage",
            discountValue: 20,
            maxDiscountAmount: 500,
            applicablePlanIds: [],
            applicablePlanNames: ["Monthly", "Quarterly"],
            targetAudience: "all",
            usageCount: 18,
            usageLimit: 50,
            validUntil: "2026-12-31",
            isActive: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: `seed_ref_${gymId}`,
            gymId,
            title: "Referral Discount",
            discountType: "flat",
            discountValue: 200,
            maxDiscountAmount: null,
            applicablePlanIds: [],
            applicablePlanNames: ["All Plans (New Members)"],
            targetAudience: "new_members",
            usageCount: 12,
            usageLimit: null,
            validUntil: null,
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        ];
        setOffers(seededOffers);
        localStorage.setItem(storageKey, JSON.stringify(seededOffers));
        if (onOffersChange) onOffersChange(seededOffers);
      }
    } catch {
      // Fallback
    } finally {
      setIsOffersLoaded(true);
    }
  }, [gymId]);

  function persistOffers(updatedOffers: OfferItem[]) {
    setOffers(updatedOffers);
    try {
      localStorage.setItem(`gymapra_offers_${gymId}`, JSON.stringify(updatedOffers));
    } catch {
      // Ignore localStorage errors
    }
    if (onOffersChange) {
      onOffersChange(updatedOffers);
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }

  // Filtered Plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (selectedBranchId && p.branchId !== selectedBranchId) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          p.name.toLowerCase().includes(term) ||
          p.branchName.toLowerCase().includes(term) ||
          p.price.toString().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [plans, selectedBranchId, searchTerm]);

  // Filtered Offers
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matches =
          o.title.toLowerCase().includes(term) ||
          (o.applicablePlanNames &&
            o.applicablePlanNames.some((n) => n.toLowerCase().includes(term))) ||
          o.discountValue.toString().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [offers, searchTerm]);

  // Handle plan status toggle
  async function handleTogglePlanStatus(plan: PlanDetailItem) {
    if (!canManagePlans) return;
    setActionLoadingId(plan.id);
    const nextState = !plan.isActive;

    try {
      const res = await togglePlanAction({
        gymId,
        planId: plan.id,
        isActive: nextState,
      });

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
      showMessage("error", err instanceof Error ? err.message : "Failed to toggle plan status");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Handle plan deletion
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
      const res = await deletePlanAction({
        gymId,
        planId: plan.id,
      });

      if (!res.success) {
        showMessage("error", res.error || "Failed to delete plan");
      } else {
        setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        showMessage("success", `Plan "${plan.name}" deleted successfully.`);
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

  // Offer handlers
  function handleCreateOfferSuccess(newOffer: OfferItem) {
    const updated = [newOffer, ...offers];
    persistOffers(updated);
    showMessage("success", `Offer "${newOffer.title}" created successfully!`);
  }

  function handleUpdateOfferSuccess(updatedOffer: OfferItem) {
    const updated = offers.map((o) => (o.id === updatedOffer.id ? updatedOffer : o));
    persistOffers(updated);
    showMessage("success", `Offer "${updatedOffer.title}" updated successfully!`);
  }

  function handleToggleOfferStatus(offerId: string, nextActive: boolean) {
    const updated = offers.map((o) =>
      o.id === offerId ? { ...o, isActive: nextActive } : o
    );
    persistOffers(updated);
    showMessage(
      "success",
      `Offer is now ${nextActive ? "Active" : "Inactive"}.`
    );
  }

  function handleDeleteOffer(offerId: string) {
    const updated = offers.filter((o) => o.id !== offerId);
    persistOffers(updated);
    showMessage("success", "Offer deleted successfully.");
  }

  const showPlans = categoryFilter === "all" || categoryFilter === "plans";
  const showOffers = categoryFilter === "all" || categoryFilter === "offers";

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
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

      {/* Main Header & Dual Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Plans & Offers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create membership plans and manage promotional discounts for your gym
          </p>
        </div>

        {/* Action Buttons */}
        {canManagePlans && (
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCreatePlanModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Plan</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOfferModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-emerald-600 hover:bg-emerald-50 text-emerald-700 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Offer</span>
            </button>
          </div>
        )}
      </div>

      {/* Category Pills & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === "all"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>All</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                categoryFilter === "all"
                  ? "bg-emerald-800 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {plans.length + offers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("plans")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === "plans"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>Plans</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                categoryFilter === "plans"
                  ? "bg-emerald-800 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {plans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter("offers")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              categoryFilter === "offers"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>Offers</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                categoryFilter === "offers"
                  ? "bg-emerald-800 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {offers.length}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search plans or offers..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 placeholder:text-slate-400 shadow-xs"
          />
        </div>
      </div>

      {/* SECTION 1: Membership Plans */}
      {showPlans && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              <span>Membership Plans</span>
              <span className="text-xs font-normal text-slate-500">
                ({filteredPlans.length} total)
              </span>
            </h2>
          </div>

          {filteredPlans.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              No membership plans found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between h-full bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:shadow-md transition-all duration-150"
                >
                  {/* Top Row: Plan Name & Active Pill */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                        {plan.name}
                      </h3>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          plan.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {plan.isActive ? "Active" : "Archived"}
                      </span>
                    </div>

                    {/* Price and Duration */}
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-2xl font-bold text-slate-900 tabular-nums">
                        ₹{plan.price.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {plan.durationDays} Days
                      </span>
                    </div>

                    {/* Active Members Counter */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-3">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{plan.activeSubscribersCount} active members</span>
                    </div>
                  </div>

                  {/* Bottom: Edit Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
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
                        setEditPlanModalOpen(true);
                      }}
                      className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors text-center shadow-xs"
                    >
                      Edit Plan
                    </button>

                    {canManagePlans && (
                      <button
                        type="button"
                        title={plan.isActive ? "Deactivate plan" : "Activate plan"}
                        onClick={() => handleTogglePlanStatus(plan)}
                        disabled={actionLoadingId === plan.id}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Offers & Discounts */}
      {showOffers && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              <span>Offers & Discounts</span>
              <span className="text-xs font-normal text-slate-500">
                ({filteredOffers.length} total)
              </span>
            </h2>
          </div>

          {filteredOffers.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              No promotional offers created yet. Click "+ Create Offer" to launch a campaign!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOffers.map((offer) => {
                const applicableStr =
                  offer.applicablePlanNames && offer.applicablePlanNames.length > 0
                    ? offer.applicablePlanNames.join(", ")
                    : "All Plans";

                const usageStr = `Used: ${offer.usageCount} / ${
                  offer.usageLimit ? offer.usageLimit : "Unlimited"
                }`;

                const validityStr = offer.validUntil
                  ? `Valid until ${new Date(offer.validUntil).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : "Ongoing";

                return (
                  <div
                    key={offer.id}
                    className="flex flex-col justify-between h-full bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all duration-150"
                  >
                    <div>
                      {/* Top Row: Title & Active Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                          {offer.title}
                        </h3>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            offer.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {offer.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Discount Value Headline */}
                      <div className="mt-2">
                        <div className="text-xl font-bold text-emerald-800 tabular-nums">
                          {offer.discountType === "percentage" ? (
                            <>
                              {offer.discountValue}% OFF
                              {offer.maxDiscountAmount ? (
                                <span className="text-xs font-medium text-slate-500 ml-1.5">
                                  (Max ₹{offer.maxDiscountAmount.toLocaleString("en-IN")})
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <>₹{offer.discountValue.toLocaleString("en-IN")} OFF</>
                          )}
                        </div>
                      </div>

                      {/* Applicable & Validity Details */}
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p className="font-medium text-slate-600">
                          Applicable: <span className="text-slate-800">{applicableStr}</span>
                        </p>
                        <p>
                          {usageStr} · <span className="text-slate-600">{validityStr}</span>
                        </p>
                      </div>
                    </div>

                    {/* Bottom: Edit Action */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOfferToEdit(offer);
                          setEditOfferModalOpen(true);
                        }}
                        className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors text-center shadow-xs"
                      >
                        Edit Offer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Plan Modals */}
      <CreatePlanModal
        gymId={gymId}
        branches={branches}
        defaultBranchId={selectedBranchId}
        isOpen={createPlanModalOpen}
        onClose={() => setCreatePlanModalOpen(false)}
        onSuccess={(newPlan) => {
          setCreatePlanModalOpen(false);
          showMessage("success", `Plan "${newPlan.name}" created successfully!`);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      <EditPlanModal
        gymId={gymId}
        branches={branches}
        plan={selectedPlanToEdit}
        isOpen={editPlanModalOpen}
        onClose={() => {
          setEditPlanModalOpen(false);
          setSelectedPlanToEdit(null);
        }}
        onSuccess={(res) => {
          setEditPlanModalOpen(false);
          setSelectedPlanToEdit(null);
          showMessage(
            "success",
            res.versioned
              ? `Plan "${res.name}" updated (versioned to protect existing subscribers).`
              : `Plan "${res.name}" updated successfully.`
          );
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Offer Modals */}
      <CreateOfferModal
        gymId={gymId}
        availablePlans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
        }))}
        isOpen={createOfferModalOpen}
        onClose={() => setCreateOfferModalOpen(false)}
        onSuccess={handleCreateOfferSuccess}
      />

      <EditOfferModal
        gymId={gymId}
        offer={selectedOfferToEdit}
        availablePlans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
        }))}
        isOpen={editOfferModalOpen}
        onClose={() => {
          setEditOfferModalOpen(false);
          setSelectedOfferToEdit(null);
        }}
        onUpdate={handleUpdateOfferSuccess}
        onToggleStatus={handleToggleOfferStatus}
        onDelete={handleDeleteOffer}
      />
    </div>
  );
}
