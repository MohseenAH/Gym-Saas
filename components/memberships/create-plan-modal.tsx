"use client";

import { useState, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, X, Loader2, IndianRupee, Clock, Building2 } from "lucide-react";
import { createPlanAction } from "@/lib/actions/plans";

interface CreatePlanModalProps {
  gymId: string;
  branches: { id: string; name: string }[];
  defaultBranchId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plan: {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    branchId: string;
    isActive?: boolean;
  }) => void;
}

const DURATION_OPTIONS = [
  { label: "15 Days", value: "15", days: 15 },
  { label: "1 Month (30 Days)", value: "30", days: 30 },
  { label: "3 Months (90 Days)", value: "90", days: 90 },
  { label: "6 Months (180 Days)", value: "180", days: 180 },
  { label: "1 Year (365 Days)", value: "365", days: 365 },
  { label: "Custom Duration...", value: "custom", days: null },
] as const;

export function CreatePlanModal({
  gymId,
  branches,
  defaultBranchId,
  isOpen,
  onClose,
  onSuccess,
}: CreatePlanModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || "");
  const [durationDays, setDurationDays] = useState(30);
  const [durationSelection, setDurationSelection] = useState<string>("30");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

    if (!branchId) {
      setError("Please select a gym branch");
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
      const res = await createPlanAction({
        gymId,
        branchId,
        name: name.trim(),
        description: description.trim() || undefined,
        durationDays,
        price: numPrice,
        isActive,
      });

      if (!res.success) {
        setError(res.error || "Failed to create membership plan");
      } else {
        onSuccess?.({
          id: res.planId!,
          name: name.trim(),
          price: numPrice,
          durationDays,
          branchId,
          isActive,
        });

        // Reset form
        setName("");
        setPrice("");
        setDescription("");
        setDurationDays(30);
        setDurationSelection("30");
        setIsActive(true);

        // Close modal immediately and refresh in background without tick collision
        onClose();
        setTimeout(() => {
          startTransition(() => {
            router.refresh();
          });
        }, 150);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create membership plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-primary/10 text-primary rounded-xl sm:rounded-2xl shadow-2xs">
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-foreground">Create Membership Plan</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Define flexible tier pricing and duration</p>
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

        <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Plan Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 1 Month Standard, Annual Gold, 15-Day Trial"
              className="w-full h-10 sm:h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Target Branch *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-muted-foreground absolute left-3 top-3 sm:top-3.5 pointer-events-none" />
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

          {/* Flexible Duration Dropdown & Custom Input */}
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
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
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

            {/* Numeric Duration Input (Shown ONLY when Custom Duration is selected) */}
            {durationSelection === "custom" && (
              <div className="mt-2 relative animate-in fade-in duration-150">
                <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
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
              Plan Price (₹) *
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 sm:top-4 pointer-events-none" />
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="any"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full h-11 sm:h-12 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-xl sm:text-2xl font-bold tracking-tight text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          {/* Plan Availability Toggle */}
          <div className="flex items-center justify-between p-3 sm:p-3.5 bg-muted/40 rounded-2xl border border-border">
            <div>
              <div className="text-xs font-bold text-foreground">Plan Status</div>
              <div className="text-[11px] text-muted-foreground">
                {isActive ? "Active (Available immediately for enrollments)" : "Archived (Hidden from new assignments)"}
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
              Description / Member Perks (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Full floor access, cardio zone, locker room, and steam bath"
              className="w-full p-2.5 sm:p-3 bg-muted/40 border border-input rounded-xl text-xs sm:text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

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
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
              <span>Create Plan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
