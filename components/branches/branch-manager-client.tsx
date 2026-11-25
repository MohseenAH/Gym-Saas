"use client";

import { useState, useMemo, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Users,
  Loader2,
  X,
  Search,
  AlertTriangle,
  Layers,
  MoreVertical,
  Edit2,
  ArrowLeftRight,
  ExternalLink,
  ListFilter,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { createBranchAction, updateBranchAction } from "@/lib/actions/branches";

export interface BranchItem {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  isActive: boolean;
  isMain?: boolean;
  memberCount: number;
  activeMemberCount: number;
  staffCount: number;
  managerName?: string | null;
  monthlyCollections?: number | null;
  pendingVerificationsCount: number;
}

interface BranchManagerClientProps {
  gymId: string;
  branches: BranchItem[];
  currentBranchId?: string | null;
  canManageBranches: boolean;
  canViewFinancials: boolean;
}

type BranchFilter = "all" | "active" | "attention";

export function BranchManagerClient({
  gymId,
  branches,
  currentBranchId,
  canManageBranches,
  canViewFinancials,
}: BranchManagerClientProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<BranchFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Add Branch modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Branch modal state
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Aggregated Metrics
  const totalActiveMembers = useMemo(
    () => branches.reduce((sum, b) => sum + b.activeMemberCount, 0),
    [branches]
  );

  const totalCollections = useMemo(
    () =>
      branches.reduce(
        (sum, b) => sum + (b.monthlyCollections ?? 0),
        0
      ),
    [branches]
  );

  const branchesNeedingAttention = useMemo(
    () => branches.filter((b) => b.pendingVerificationsCount > 0),
    [branches]
  );

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter((b) => {
      if (filterMode === "active" && !b.isActive) return false;
      if (filterMode === "attention" && b.pendingVerificationsCount === 0) {
        return false;
      }
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.city || "").toLowerCase().includes(q) ||
        (b.address || "").toLowerCase().includes(q)
      );
    });
  }, [branches, search, filterMode]);

  function handleSwitchBranch(branchId: string | null) {
    const cookieName = `gymapra_branch_${gymId}`;
    if (!branchId) {
      document.cookie = `${cookieName}=; path=/; max-age=0`;
      router.push(`/app/${gymId}/dashboard`);
    } else {
      document.cookie = `${cookieName}=${branchId}; path=/; max-age=31536000; SameSite=Lax`;
      router.push(`/app/${gymId}/dashboard?branchId=${branchId}`);
    }
    router.refresh();
  }

  function openEditModal(branch: BranchItem) {
    setEditingBranch(branch);
    setEditName(branch.name);
    setEditAddress(branch.address || "");
    setEditCity(branch.city || "");
    setEditPhone(branch.phone || "");
    setEditIsActive(branch.isActive);
    setEditError(null);
  }

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
      startTransition(() => router.refresh());
    }
  }

  async function handleUpdateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBranch) return;
    setEditError(null);
    setEditLoading(true);

    const res = await updateBranchAction({
      gymId,
      branchId: editingBranch.id,
      name: editName.trim(),
      address: editAddress.trim() || null,
      city: editCity.trim() || null,
      phone: editPhone.trim() || null,
      isActive: editIsActive,
    });

    setEditLoading(false);
    if (!res.success) {
      setEditError(res.error || "Failed to update branch");
    } else {
      setEditingBranch(null);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-5 text-foreground">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
            Branches
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {branches.length > 1 && (
            <button
              type="button"
              onClick={() => handleSwitchBranch(null)}
              className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View All Branches</span>
              <span className="sm:hidden">View All</span>
            </button>
          )}

          {canManageBranches && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Branch
            </button>
          )}
        </div>
      </div>

      {/* Branch Summary KPI Cards */}
      <div
        className={`grid grid-cols-2 gap-2.5 sm:gap-4 ${
          canViewFinancials ? "lg:grid-cols-4" : "lg:grid-cols-2"
        }`}
      >
        <KpiCard
          compact
          label="Total Branches"
          value={branches.length}
          variant="purple"
          icon={<Building2 className="w-4 h-4" />}
          subtext="Across all locations"
          onClick={() => setFilterMode("all")}
          active={filterMode === "all"}
        />

        <KpiCard
          compact
          label="Active Members"
          value={totalActiveMembers}
          variant="green"
          icon={<Users className="w-4 h-4" />}
          subtext="Active roster"
          onClick={() => setFilterMode("active")}
          active={filterMode === "active"}
        />

        {canViewFinancials && (
          <KpiCard
            compact
            label="Total Collections"
            value={`₹${totalCollections.toLocaleString("en-IN")}`}
            variant="blue"
            icon={<Layers className="w-4 h-4" />}
            subtext="This month"
          />
        )}

        {canViewFinancials && (
          <KpiCard
            compact
            label="Needs Attention"
            value={branchesNeedingAttention.length}
            variant="red"
            icon={<AlertTriangle className="w-4 h-4" />}
            subtext={
              branchesNeedingAttention.length > 0
                ? "Pending UPI checks"
                : "All branches clear"
            }
            onClick={() =>
              setFilterMode((prev) =>
                prev === "attention" ? "all" : "attention"
              )
            }
            active={filterMode === "attention"}
          />
        )}
      </div>

      {/* Search & Filter Strip */}
      {branches.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-0 sm:max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branches by name or city..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "all", label: `All (${branches.length})` },
                {
                  id: "active",
                  label: `Active (${branches.filter((b) => b.isActive).length})`,
                },
                ...(canViewFinancials
                  ? [
                      {
                        id: "attention" as const,
                        label: `Needs Attention (${branchesNeedingAttention.length})`,
                      },
                    ]
                  : []),
              ] as const
            ).map((pill) => {
              const active = filterMode === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFilterMode(pill.id)}
                  className={`h-9 px-3.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border p-10 text-center text-xs text-muted-foreground">
          No branches match your search or filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((b) => {
            const isCurrentContext = currentBranchId === b.id;
            const hasAttention = b.pendingVerificationsCount > 0;
            const locationText =
              [b.address, b.city].filter(Boolean).join(", ") ||
              "Location not set";

            return (
              <div
                key={b.id}
                className={`bg-card rounded-3xl border p-5 flex flex-col justify-between gap-4 shadow-xs transition-all ${
                  hasAttention
                    ? "border-rose-500/35"
                    : isCurrentContext
                    ? "border-primary/45 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {/* Top Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2 className="text-sm sm:text-base font-black text-foreground truncate">
                            {b.name}
                          </h2>
                          {b.isMain && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{locationText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Overflow Menu */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label={`Actions for ${b.name}`}
                        onClick={() =>
                          setOpenMenuId((prev) => (prev === b.id ? null : b.id))
                        }
                        className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground inline-flex items-center justify-center cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === b.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-9 w-44 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-1.5 z-30 text-xs font-semibold">
                            {canManageBranches && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  openEditModal(b);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-primary" />
                                Edit Branch
                              </button>
                            )}
                            <Link
                              href={`/app/${gymId}/members?branchId=${b.id}`}
                              onClick={() => setOpenMenuId(null)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                            >
                              <Users className="w-3.5 h-3.5 text-emerald-600" />
                              View Members
                            </Link>
                            {canViewFinancials && (
                              <Link
                                href={`/app/${gymId}/payments?branchId=${b.id}`}
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                Payments
                              </Link>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Pill & Attention Alert */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        b.isActive
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                          : "bg-slate-500/12 text-slate-700 dark:text-slate-400 border-slate-500/25"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          b.isActive ? "bg-emerald-500" : "bg-slate-500"
                        }`}
                      />
                      {b.isActive ? "Active" : "Inactive"}
                    </span>

                    {isCurrentContext && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/12 text-primary border border-primary/25">
                        Current Context
                      </span>
                    )}
                  </div>

                  {hasAttention && (
                    <Link
                      href={`/app/${gymId}/payments?branchId=${b.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/15 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {b.pendingVerificationsCount} pending UPI verification
                        {b.pendingVerificationsCount === 1 ? "" : "s"}
                      </span>
                    </Link>
                  )}

                  {/* Branch Stats */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                    <div className="p-3 rounded-2xl bg-muted/40 border border-border/60">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Active Members
                      </div>
                      <div className="text-base font-black text-foreground mt-0.5">
                        {b.activeMemberCount}
                      </div>
                    </div>

                    {canViewFinancials ? (
                      <div className="p-3 rounded-2xl bg-muted/40 border border-border/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          This Month
                        </div>
                        <div className="text-base font-black text-foreground mt-0.5 truncate">
                          ₹{(b.monthlyCollections ?? 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-muted/40 border border-border/60">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Assigned Staff
                        </div>
                        <div className="text-base font-black text-foreground mt-0.5">
                          {b.staffCount}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Staff / Manager / Phone Meta */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          {b.managerName
                            ? `Manager: ${b.managerName}`
                            : `${b.staffCount} staff assigned`}
                        </span>
                      </span>
                      {b.phone && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3" />
                          {b.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action */}
                <button
                  type="button"
                  onClick={() => handleSwitchBranch(b.id)}
                  className={`w-full h-10 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    b.isMain || isCurrentContext
                      ? "bg-primary text-primary-foreground hover:opacity-95 shadow-xs"
                      : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                  }`}
                >
                  {isCurrentContext ? (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Branch
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Switch Branch
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Branch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">
                    Add Gym Branch
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure a new location for your gym
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
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
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
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
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
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
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 flex items-center gap-2 px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-md w-full p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">
                    Edit Branch
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editingBranch.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateBranch} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Street Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                />
              </div>

              {!editingBranch.isMain && (
                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                  />
                  <span>Branch is active</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="h-10 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="h-10 flex items-center gap-2 px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {editLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
