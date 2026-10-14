"use client";

import { useState } from "react";
import { Edit2, X, Loader2, IndianRupee, Clock, Building2, ShieldCheck } from "lucide-react";
import { updatePlanAction } from "@/lib/actions/plans";

export interface EditablePlan {
  id: string;
  branchId: string;
  branchName?: string;
  name: string;
  description?: string | null;
  durationDays: number;
  price: number;
  isActive: boolean;
  usageCount?: number;
}

interface EditPlanModalProps {
  gymId: string;
  branches: { id: string; name: string }[];
  plan: EditablePlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: {
    planId: string;
    versioned?: boolean;
    name: string;
    price: number;
    durationDays: number;
    isActive: boolean;
  }) => void;
}

interface EditPlanFormProps {
  gymId: string;
  branches: { id: string; name: string }[];
  plan: EditablePlan;
  onClose: () => void;
  onSuccess?: EditPlanModalProps["onSuccess"];
}

function EditPlanForm({
  gymId,
  branches,
  plan,
  onClose,
  onSuccess,
}: EditPlanFormProps) {
  const [name, setName] = useState(plan.name);
  const [branchId, setBranchId] = useState(plan.branchId);
  const [durationDays, setDurationDays] = useState(plan.durationDays);
  const [price, setPrice] = useState(String(plan.price));
  const [description, setDescription] = useState(plan.description || "");
  const [isActive, setIsActive] = useState(plan.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUsage = (plan.usageCount || 0) > 0;
  const termsModified =
    parseFloat(price) !== plan.price || durationDays !== plan.durationDays;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a plan name");
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError("Please enter a valid price (₹0 or greater)");
      return;
    }

    if (durationDays < 1) {
      setError("Duration must be at least 1 day");
      return;
    }

    setLoading(true);

    const res = await updatePlanAction({
      gymId,
      planId: plan.id,
      branchId: branchId || plan.branchId,
      name: name.trim(),
      description: description.trim() || undefined,
      durationDays,
      price: numPrice,
      isActive,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to update membership plan");
    } else {
      onSuccess?.({
        planId: res.planId!,
        versioned: res.versioned,
        name: name.trim(),
        price: numPrice,
        durationDays,
        isActive,
      });
      onClose();
    }
  }

  return (
    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Membership Plan</h3>
            <p className="text-xs text-slate-500">Update terms and availability for this plan</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {hasUsage && termsModified && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong>Historical terms protected:</strong> Because {plan.usageCount} member contract(s) reference this plan, updating price or duration will preserve existing contracts at their originally agreed terms while offering updated terms to new subscribers.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Plan Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Plan Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Branch Selection */}
        {branches.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Branch Location *
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Duration & Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Duration (Days) *
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                min="1"
                required
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Price (₹) *
            </label>
            <div className="relative">
              <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                min="0"
                step="any"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <div className="text-xs font-semibold text-slate-900">Plan Availability</div>
            <div className="text-[11px] text-slate-500">
              {isActive ? "Active (Can be assigned to members)" : "Inactive (Hidden from assignment)"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden ${
              isActive ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

export function EditPlanModal({
  gymId,
  branches,
  plan,
  isOpen,
  onClose,
  onSuccess,
}: EditPlanModalProps) {
  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <EditPlanForm
        key={plan.id}
        gymId={gymId}
        branches={branches}
        plan={plan}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
