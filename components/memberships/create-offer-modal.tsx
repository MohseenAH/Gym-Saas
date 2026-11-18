"use client";

import { useState } from "react";
import { X, Tag, Percent, IndianRupee, Calendar, CheckSquare, Square, Users } from "lucide-react";
import { OfferItem } from "@/lib/validations/offers";

interface CreateOfferModalProps {
  gymId: string;
  availablePlans: { id: string; name: string; price: number }[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newOffer: OfferItem) => void;
}

export function CreateOfferModal({
  gymId,
  availablePlans,
  isOpen,
  onClose,
  onSuccess,
}: CreateOfferModalProps) {
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [applyToAllPlans, setApplyToAllPlans] = useState(true);
  const [targetAudience, setTargetAudience] = useState<"all" | "new_members" | "renewals">("all");
  const [usageLimit, setUsageLimit] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function togglePlan(planId: string) {
    if (applyToAllPlans) {
      setApplyToAllPlans(false);
      setSelectedPlanIds([planId]);
      return;
    }
    if (selectedPlanIds.includes(planId)) {
      const next = selectedPlanIds.filter((id) => id !== planId);
      if (next.length === 0) {
        setApplyToAllPlans(true);
      }
      setSelectedPlanIds(next);
    } else {
      setSelectedPlanIds([...selectedPlanIds, planId]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please provide an offer title (e.g. New Year Special)");
      return;
    }

    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid discount value greater than 0");
      return;
    }

    if (discountType === "percentage" && val > 100) {
      setError("Percentage discount cannot exceed 100%");
      return;
    }

    let maxCap: number | null = null;
    if (discountType === "percentage" && maxDiscountAmount.trim()) {
      const parsedCap = parseFloat(maxDiscountAmount);
      if (isNaN(parsedCap) || parsedCap <= 0) {
        setError("Max discount cap must be a valid number greater than 0");
        return;
      }
      maxCap = parsedCap;
    }

    let parsedUsageLimit: number | null = null;
    if (usageLimit.trim()) {
      const limit = parseInt(usageLimit, 10);
      if (isNaN(limit) || limit <= 0) {
        setError("Usage limit must be a positive integer");
        return;
      }
      parsedUsageLimit = limit;
    }

    const applicableIds = applyToAllPlans ? [] : selectedPlanIds;
    const applicableNames = applyToAllPlans
      ? ["All Plans"]
      : availablePlans
          .filter((p) => selectedPlanIds.includes(p.id))
          .map((p) => p.name);

    const newOffer: OfferItem = {
      id: "offer_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      gymId,
      title: cleanTitle,
      discountType,
      discountValue: val,
      maxDiscountAmount: maxCap,
      applicablePlanIds: applicableIds,
      applicablePlanNames: applicableNames,
      targetAudience,
      usageCount: 0,
      usageLimit: parsedUsageLimit,
      validUntil: validUntil.trim() ? validUntil.trim() : null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    onSuccess(newOffer);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-offer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-offer-title" className="text-lg font-bold text-slate-900 leading-tight">
                Create Offer & Discount
              </h2>
              <p className="text-xs text-slate-500">
                Set up promotional vouchers and member discounts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Offer Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Year Special, Referral Discount"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Discount Type and Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Discount Type
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDiscountType("percentage")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    discountType === "percentage"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("flat")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    discountType === "flat"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  Flat (₹)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {discountType === "percentage" ? "Discount Percentage (%)" : "Flat Amount (₹)"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={discountType === "percentage" ? "100" : undefined}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 200"}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 placeholder:text-slate-400 tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  {discountType === "percentage" ? "%" : "₹"}
                </span>
              </div>
            </div>
          </div>

          {/* Max Cap (only if percentage) */}
          {discountType === "percentage" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Maximum Discount Cap (Optional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="e.g. 500 (limits max discount to ₹500)"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 placeholder:text-slate-400 tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  ₹ Max
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Leave empty for uncapped percentage savings.
              </p>
            </div>
          )}

          {/* Applicable Plans */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Applicable Plans
            </label>
            <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={applyToAllPlans}
                  onChange={(e) => {
                    setApplyToAllPlans(e.target.checked);
                    if (e.target.checked) setSelectedPlanIds([]);
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Apply to All Membership Plans
              </label>

              {!applyToAllPlans && (
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5 max-h-36 overflow-y-auto">
                  {availablePlans.length === 0 ? (
                    <p className="text-xs text-slate-400">No active plans found.</p>
                  ) : (
                    availablePlans.map((plan) => (
                      <label
                        key={plan.id}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100/70 cursor-pointer text-xs text-slate-700"
                      >
                        <span className="font-medium">{plan.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 tabular-nums">
                            ₹{plan.price.toLocaleString("en-IN")}
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedPlanIds.includes(plan.id)}
                            onChange={() => togglePlan(plan.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Target Audience & Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e) =>
                  setTargetAudience(e.target.value as "all" | "new_members" | "renewals")
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
              >
                <option value="all">All Members</option>
                <option value="new_members">New Members Only</option>
                <option value="renewals">Renewals Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Usage Limit (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="e.g. 50 redemptions"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 placeholder:text-slate-400 tabular-nums"
              />
            </div>
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Valid Until (Optional)
            </label>
            <div className="relative">
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave empty for an ongoing promotional offer.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              Create Offer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
