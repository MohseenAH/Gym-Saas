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
    <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Edit Membership Plan</h3>
            <p className="text-xs text-muted-foreground">Update terms and availability for this plan</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {hasUsage && termsModified && (
        <div className="mt-4 p-3.5 bg-primary/10 border border-primary/20 text-foreground rounded-xl text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Historical terms protected:</strong> Because {plan.usageCount} member contract(s) reference this plan, updating price or duration will preserve existing contracts at their originally agreed terms while offering updated terms to new subscribers.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Plan Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Plan Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>

        {/* Branch Selection */}
        {branches.length > 1 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Branch Location *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Duration (Days) *
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                className="w-full h-11 pl-10 pr-3.5 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Price (₹) *
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-11 pl-10 pr-3.5 bg-muted/40 border border-input rounded-xl text-sm font-bold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border">
          <div>
            <div className="text-xs font-bold text-foreground">Plan Availability</div>
            <div className="text-[11px] text-muted-foreground">
              {isActive ? "Active (Available for member enrollment)" : "Archived (Hidden from new assignments)"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
              isActive ? "bg-primary" : "bg-muted-foreground/30"
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
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 h-11 px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl shadow-md shadow-primary/25 transition-all disabled:opacity-50 cursor-pointer"
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
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
