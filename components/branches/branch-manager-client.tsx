"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, MapPin, Phone, Users, Loader2, X } from "lucide-react";
import { createBranchAction } from "@/lib/actions/branches";

export interface BranchItem {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  isActive: boolean;
  memberCount: number;
}

interface BranchManagerClientProps {
  gymId: string;
  branches: BranchItem[];
  canManageBranches: boolean;
}

export function BranchManagerClient({
  gymId,
  branches,
  canManageBranches,
}: BranchManagerClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await createBranchAction({
      gymId,
      name: name.trim(),
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create branch");
    } else {
      setModalOpen(false);
      setName("");
      setAddress("");
      setCity("");
      setPhone("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">
            Branches & Gym Facilities
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your physical fitness centers, address details, and branch-specific member allocation
          </p>
        </div>

        {canManageBranches && (
          <button
            onClick={() => setModalOpen(true)}
            className="h-10 sm:h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </div>

      {/* Grid of Branches */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {branches.map((b) => (
          <div
            key={b.id}
            className="p-3 sm:p-5 bg-card rounded-2xl sm:rounded-3xl border border-border shadow-xs flex flex-col sm:flex-row items-start gap-2.5 sm:gap-4 hover:border-primary/40 transition-all"
          >
            <div className="h-7 w-7 sm:h-9 sm:w-9 flex items-center justify-center bg-primary/10 text-primary rounded-xl sm:rounded-2xl shrink-0">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-center justify-between gap-1.5">
                <h3 className="text-xs sm:text-base font-bold text-card-foreground truncate">{b.name}</h3>
                <span className="px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                  Active
                </span>
              </div>

              <div className="mt-1 sm:mt-2 text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{b.address || b.city || "Primary Gym Center"}</span>
              </div>

              {b.phone && (
                <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{b.phone}</span>
                </div>
              )}

              <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-border flex items-center justify-between text-[10px] sm:text-xs">
                <div className="flex items-center gap-1 text-foreground font-semibold truncate">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{b.memberCount} Members</span>
                </div>
                <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground shrink-0">#{b.id.slice(0, 6)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Branch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">Add Gym Branch</h3>
                  <p className="text-xs text-muted-foreground">Configure a new location for your gym</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Koramangala Hub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="e.g. +91 9988776655"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5th Main, 4th Block"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}