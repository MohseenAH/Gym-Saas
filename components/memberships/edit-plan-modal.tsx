"use client";

import { useState, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";
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

const DURATION_OPTIONS = [
  { label: "15 Days", value: "15", days: 15 },
  { label: "1 Month (30 Days)", value: "30", days: 30 },
  { label: "3 Months (90 Days)", value: "90", days: 90 },
  { label: "6 Months (180 Days)", value: "180", days: 180 },
  { label: "1 Year (365 Days)", value: "365", days: 365 },
  { label: "Custom Duration...", value: "custom", days: null },
] as const;

function EditPlanForm({
  gymId,
  branches,
  plan,
  onClose,
  onSuccess,
}: EditPlanFormProps) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [branchId, setBranchId] = useState(plan.branchId);
  const [durationDays, setDurationDays] = useState(plan.durationDays);

  const matchedOption = DURATION_OPTIONS.find((p) => p.days === plan.durationDays);
  const [durationSelection, setDurationSelection] = useState<string>(
    matchedOption ? matchedOption.value : "custom"
  );

  const [price, setPrice] = useState(String(plan.price));
  const [description, setDescription] = useState(plan.description || "");
  const [isActive, setIsActive] = useState(plan.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationInputRef = useRef<HTMLInputElement>(null);

  const hasUsage = (plan.usageCount || 0) > 0;
  const termsModified =
    parseFloat(price) !== plan.price || durationDays !== plan.durationDays;

  function handleDurationSelectChange(val: string) {
    setDurationSelection(val);
    if (val !== "custom") {
      const d = parseInt(val, 10);
      setDurationDays(d);
    } else {
      setTimeout(() => {
        durationInputRef.current?.focus();
        durationInputRef.current?.select();
      }, 50);
    }
  }

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

    if (durationDays < 1 || durationDays > 3650) {
      setError("Duration must be between 1 and 3,650 days (up to 10 years)");
      return;
    }

    setLoading(true);

    try {
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

        // Close modal immediately and refresh in background
        onClose();
        setTimeout(() => {
          startTransition(() => {
            router.refresh();
          });
        }, 150);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update membership plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 my-auto">
      <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-border">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 bg-primary/10 text-primary rounded-xl sm:rounded-2xl shadow-2xs">
            <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-foreground">Edit Membership Plan</h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Update terms and availability for this plan</p>
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
        <div className="mt-3.5 sm:mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {hasUsage && termsModified && (
        <div className="mt-3.5 sm:mt-4 p-3 bg-primary/10 border border-primary/20 text-foreground rounded-xl text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span className="text-[11px] sm:text-xs leading-relaxed">
            <strong>Historical terms protected:</strong> Because {plan.usageCount} member contract(s) reference this plan, modifying price or duration will preserve existing contracts at their originally agreed terms while offering updated terms to new subscribers.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-3.5 sm:space-y-4">
        {/* Plan Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Plan Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 sm:h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>

        {/* Branch Selection */}
        {branches.length > 1 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Branch Location *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-3 sm:top-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full h-10 sm:h-11 pl-9 pr-4 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
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

        {/* Duration Dropdown & Custom Numeric Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Plan Duration *
            </label>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <Clock className="w-3 h-3" />
              {durationDays} {durationDays === 1 ? "Day" : "Days"} Active
            </span>
          </div>

          {/* Clean Dropdown */}
          <div className="relative">
            <Clock className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={durationSelection}
              onChange={(e) => handleDurationSelectChange(e.target.value)}
              className="w-full h-10 sm:h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Days Input (Shown ONLY when Custom Duration is active) */}
          {durationSelection === "custom" && (
            <div className="mt-2 relative animate-in fade-in duration-150">
              <Clock className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={durationInputRef}
                type="number"
                inputMode="numeric"
                min="1"
                max="3650"
                required
                value={durationDays || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDurationDays(isNaN(val) ? 0 : val);
                }}
                placeholder="Custom duration in days (1-3650)"
                className="w-full h-10 sm:h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enter total duration between 1 and 3,650 days (up to 10 years)
              </p>
            </div>
          )}
        </div>

        {/* Price Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Price (₹) *
          </label>
          <div className="relative">
            <IndianRupee className="w-4 h-4 absolute left-3.5 top-3.5 sm:top-4 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="any"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-11 sm:h-12 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xl sm:text-2xl font-bold tracking-tight text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between p-3 sm:p-3.5 bg-muted/40 rounded-2xl border border-border">
          <div>
            <div className="text-xs font-bold text-foreground">Plan Status</div>
            <div className="text-[11px] text-muted-foreground">
              {isActive ? "Active (Available for member enrollment)" : "Archived (Hidden from new assignments)"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-5 sm:h-6 w-9 sm:w-11 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
              isActive ? "bg-primary" : "bg-muted-foreground/30"
            }`}
            aria-label="Toggle active status"
          >
            <span
              className={`inline-block h-3.5 sm:h-4 w-3.5 sm:w-4 transform rounded-full bg-white transition-transform ${
                isActive ? "translate-x-4 sm:translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 sm:p-3 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-10 sm:h-11 px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Save Changes</span>
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
