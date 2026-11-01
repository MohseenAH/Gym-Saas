"use client";

import { useState } from "react";
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
  }) => void;
}

export function CreatePlanModal({
  gymId,
  branches,
  defaultBranchId,
  isOpen,
  onClose,
  onSuccess,
}: CreatePlanModalProps) {
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || "");
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const DURATION_PRESETS = [
    { label: "1 Month (30d)", days: 30 },
    { label: "3 Months (90d)", days: 90 },
    { label: "6 Months (180d)", days: 180 },
    { label: "1 Year (365d)", days: 365 },
  ];

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

    if (durationDays < 1) {
      setError("Duration must be at least 1 day");
      return;
    }

    setLoading(true);

    const res = await createPlanAction({
      gymId,
      branchId,
      name: name.trim(),
      description: description.trim() || undefined,
      durationDays,
      price: numPrice,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to create membership plan");
    } else {
      onSuccess?.({
        id: res.planId!,
        name: name.trim(),
        price: numPrice,
        durationDays,
        branchId,
      });
      // Reset form
      setName("");
      setPrice("");
      setDescription("");
      setDurationDays(30);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Create Membership Plan</h3>
              <p className="text-xs text-muted-foreground">Define membership tier pricing and duration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Plan Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 1 Month Standard, Annual Gold"
              className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Target Branch *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
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

          {/* Duration Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Duration (Days) *
              </label>
              <span className="text-[11px] font-bold text-primary">
                {durationDays} Days Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setDurationDays(preset.days)}
                  className={`h-10 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    durationDays === preset.days
                      ? "bg-primary/10 border-primary text-primary shadow-2xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="number"
                inputMode="numeric"
                min="1"
                required
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                placeholder="Custom duration in days"
                className="w-full h-11 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Plan Price (₹) *
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full h-12 pl-10 pr-4 bg-muted/40 border border-input rounded-xl text-2xl font-bold tracking-tight text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Description / Member Perks (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Includes full gym floor access, cardio zone, and locker usage"
              className="w-full p-3 bg-muted/40 border border-input rounded-xl text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

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
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
              Create Plan Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
