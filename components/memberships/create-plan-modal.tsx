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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Create Membership Plan</h3>
              <p className="text-xs text-slate-500">Add a new plan template for member contracts</p>
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
              placeholder="e.g. Monthly Standard, Annual Pro, Student Special"
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

          {/* Duration Presets & Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Duration *
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDurationDays(p.days)}
                  className={`py-1.5 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                    durationDays === p.days
                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                min="1"
                required
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                placeholder="Duration in days"
                className="w-full pl-9 pr-14 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                days
              </span>
            </div>
          </div>

          {/* Price */}
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
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
              placeholder="e.g. Includes access to gym floor and locker room"
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
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
