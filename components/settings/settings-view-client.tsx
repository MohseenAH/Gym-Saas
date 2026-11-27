"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { APP_TIMEZONE_FULL_LABEL } from "@/lib/config/timezone";
import {
  Settings,
  Building2,
  CalendarCheck,
  Wallet,
  Bell,
  Palette,
  Crown,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  ChevronRight,
  ChevronLeft,
  Phone,
  MapPin,
  LogOut,
  Shield,
  MessageSquare,
  ExternalLink,
  Layers,
  SlidersHorizontal,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  updateGymProfileAction,
  createPlanAction,
  togglePlanAction,
  redeemPilotCodeAction,
} from "@/lib/actions/gym";
import { createBranchAction } from "@/lib/actions/branches";
import { logoutAction } from "@/lib/actions/auth";
import { useGymTheme } from "@/lib/theme";

export type SettingsSectionId =
  | "profile"
  | "membership"
  | "payments"
  | "notifications"
  | "appearance"
  | "billing";

const VALID_SECTIONS: readonly SettingsSectionId[] = [
  "profile",
  "membership",
  "payments",
  "notifications",
  "appearance",
  "billing",
] as const;

function parseSection(raw: string | null | undefined): SettingsSectionId | null {
  if (!raw) return null;
  return (VALID_SECTIONS as readonly string[]).includes(raw)
    ? (raw as SettingsSectionId)
    : null;
}

interface Branch {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  is_active: boolean;
}

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  is_active: boolean;
}

interface SettingsViewClientProps {
  gymId: string;
  gymName: string;
  gymPhone?: string | null;
  branches: Branch[];
  plans: Plan[];
  account: {
    tier: string;
    trialEndsAt?: string | null;
    isPilot: boolean;
    daysRemaining: number;
  };
  userEmail: string;
  userRole: string;
  initialSection?: string;
}

interface SectionMeta {
  id: SettingsSectionId;
  title: string;
  desktopSub: string;
  mobileSub: string;
  group: "general" | "communication" | "preferences";
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_SECTIONS: SectionMeta[] = [
  {
    id: "profile",
    title: "Gym Profile",
    desktopSub: "Gym details, contact and branches",
    mobileSub: "Gym details & branch settings",
    group: "general",
    icon: Building2,
  },
  {
    id: "membership",
    title: "Membership & Attendance",
    desktopSub: "Plans, branches & check-in rules",
    mobileSub: "Plans, expiry & check-in rules",
    group: "general",
    icon: CalendarCheck,
  },
  {
    id: "payments",
    title: "Payment Collection",
    desktopSub: "UPI, bank details & receipt info",
    mobileSub: "UPI, bank details & receipts",
    group: "general",
    icon: Wallet,
  },
  {
    id: "notifications",
    title: "Notifications & Templates",
    desktopSub: "WhatsApp templates & owner alerts",
    mobileSub: "Alerts, WhatsApp templates & messages",
    group: "communication",
    icon: Bell,
  },
  {
    id: "appearance",
    title: "Appearance & Preferences",
    desktopSub: "Theme, currency, date & timezone",
    mobileSub: "Theme, currency, date & timezone",
    group: "preferences",
    icon: Palette,
  },
  {
    id: "billing",
    title: "Subscription & Billing",
    desktopSub: "Plan, trial access & pilot code",
    mobileSub: "Plan, usage & manage billing",
    group: "preferences",
    icon: Crown,
  },
];

export function SettingsViewClient({
  gymId,
  gymName: initialGymName,
  gymPhone: initialGymPhone,
  branches,
  plans,
  account,
  userEmail,
  userRole,
  initialSection,
}: SettingsViewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, changeTheme, themeList } = useGymTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const urlSection = parseSection(searchParams.get("section") ?? initialSection);
  const desktopActiveSection: SettingsSectionId = urlSection ?? "profile";
  const mobileActiveSection: SettingsSectionId | null = urlSection;

  function selectSection(section: SettingsSectionId | null) {
    if (section) {
      router.replace(`/app/${gymId}/settings?section=${section}`, { scroll: false });
    } else {
      router.replace(`/app/${gymId}/settings`, { scroll: false });
    }
  }

  // Gym Profile Form State
  const [gymName, setGymName] = useState(initialGymName);
  const [gymPhone, setGymPhone] = useState(initialGymPhone || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isProfileDirty =
    gymName !== initialGymName || gymPhone !== (initialGymPhone || "");

  function handleDiscardProfile() {
    setGymName(initialGymName);
    setGymPhone(initialGymPhone || "");
    setProfileMsg(null);
  }

  // New Plan Form State
  const [planName, setPlanName] = useState("");
  const [planDuration, setPlanDuration] = useState("30");
  const [planPrice, setPlanPrice] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingPlanId, setTogglingPlanId] = useState<string | null>(null);

  // New Branch Form State
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchMsg, setBranchMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Pilot Code Form State
  const [pilotCode, setPilotCode] = useState("");
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotMsg, setPilotMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);

    const res = await updateGymProfileAction({
      gymId,
      name: gymName,
      phone: gymPhone || undefined,
    });

    setProfileLoading(false);
    if (!res.success) {
      setProfileMsg({ type: "error", text: res.error || "Failed to update profile" });
    } else {
      setProfileMsg({ type: "success", text: "Gym profile updated successfully!" });
      router.refresh();
    }
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    setPlanLoading(true);
    setPlanMsg(null);

    const res = await createPlanAction({
      gymId,
      name: planName,
      durationDays: parseInt(planDuration, 10),
      price: parseFloat(planPrice),
    });

    setPlanLoading(false);
    if (!res.success) {
      setPlanMsg({ type: "error", text: res.error || "Failed to create plan" });
    } else {
      setPlanMsg({ type: "success", text: "Membership plan created!" });
      setPlanName("");
      setPlanPrice("");
      router.refresh();
    }
  }

  async function handleTogglePlan(planId: string, currentStatus: boolean) {
    setTogglingPlanId(planId);
    await togglePlanAction({
      gymId,
      planId,
      isActive: !currentStatus,
    });
    setTogglingPlanId(null);
    router.refresh();
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    setBranchLoading(true);
    setBranchMsg(null);

    const res = await createBranchAction({
      gymId,
      name: branchName,
      address: branchAddress || undefined,
      city: branchCity || undefined,
    });

    setBranchLoading(false);
    if (!res.success) {
      setBranchMsg({ type: "error", text: res.error || "Failed to create branch" });
    } else {
      setBranchMsg({ type: "success", text: "New branch created successfully!" });
      setBranchName("");
      setBranchAddress("");
      setBranchCity("");
      router.refresh();
    }
  }

  async function handleRedeemPilot(e: React.FormEvent) {
    e.preventDefault();
    setPilotLoading(true);
    setPilotMsg(null);

    const res = await redeemPilotCodeAction({
      gymId,
      code: pilotCode,
    });

    setPilotLoading(false);
    if (!res.success) {
      setPilotMsg({ type: "error", text: res.error || "Invalid pilot code" });
    } else {
      setPilotMsg({ type: "success", text: res.message || "Pilot code redeemed successfully!" });
      setPilotCode("");
      router.refresh();
    }
  }

  const primaryBranch = branches[0]?.name || "Main Branch";
  const gymInitial = (initialGymName?.trim()?.[0] || "G").toUpperCase();

  // Shared Section Content Renderer (used by both Mobile Sub-view and Desktop Right Pane)
  function renderSectionContent(section: SettingsSectionId) {
    switch (section) {
      case "profile":
        return (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-card-foreground leading-tight">
                    Gym Profile
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Basic gym identity and contact information shown on receipts.
                  </p>
                </div>
              </div>
            </div>

            {profileMsg && (
              <div
                className={`p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                  profileMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="settings-gym-name"
                    className="block text-sm font-semibold text-foreground mb-1.5"
                  >
                    Gym Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="settings-gym-name"
                    type="text"
                    required
                    minLength={2}
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-gym-phone"
                    className="block text-sm font-semibold text-foreground mb-1.5"
                  >
                    Primary Contact Phone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      id="settings-gym-phone"
                      type="tel"
                      inputMode="tel"
                      value={gymPhone}
                      onChange={(e) => setGymPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-11 pl-10 pr-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Active Branches Summary */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {branches.length} Active {branches.length === 1 ? "Branch" : "Branches"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Primary: {primaryBranch}
                      {branches[0]?.city ? ` • ${branches[0].city}` : ""}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/app/${gymId}/branches`}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shrink-0"
                >
                  Manage Branches
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-border flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleDiscardProfile}
                  disabled={!isProfileDirty || profileLoading}
                  className="h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={profileLoading || !isProfileDirty}
                  className="h-11 inline-flex items-center justify-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                >
                  {profileLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        );

      case "membership":
        return (
          <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-card-foreground leading-tight">
                  Membership & Attendance
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Configure membership tiers, add branch locations, and review check-in rules.
                </p>
              </div>
            </div>

            {/* 1. Membership Plans */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Membership Plans ({plans.length})
                </h3>
                <Link
                  href={`/app/${gymId}/memberships?tab=plans`}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open Plans & Offers <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {planMsg && (
                <div
                  className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    planMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}
                >
                  {planMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{planMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleAddPlan} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="settings-plan-name"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      Plan Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="settings-plan-name"
                      type="text"
                      required
                      placeholder="e.g. Quarterly Pro"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settings-plan-duration"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      Duration (Days) <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="settings-plan-duration"
                      type="number"
                      required
                      min="1"
                      value={planDuration}
                      onChange={(e) => setPlanDuration(e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settings-plan-price"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      Price (₹) <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="settings-plan-price"
                      type="number"
                      required
                      min="0"
                      inputMode="decimal"
                      placeholder="e.g. 4500"
                      value={planPrice}
                      onChange={(e) => setPlanPrice(e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={planLoading}
                    className="h-10 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {planLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Add Plan Tier
                  </button>
                </div>
              </form>

              {plans.length > 0 && (
                <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden bg-background/50">
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm flex items-center gap-2 flex-wrap">
                          <span className="truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            ({p.duration_days} days)
                          </span>
                        </div>
                        <div className="text-xs font-bold text-primary mt-0.5">
                          ₹{p.price.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={togglingPlanId === p.id}
                        onClick={() => handleTogglePlan(p.id, p.is_active)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 ${
                          p.is_active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                        }`}
                      >
                        {togglingPlanId === p.id
                          ? "Updating..."
                          : p.is_active
                          ? "Active"
                          : "Disabled"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Branch Locations */}
            <div className="pt-4 border-t border-border space-y-3.5">
              <h3 className="text-sm font-bold text-foreground">
                Branch Locations ({branches.length})
              </h3>

              {branchMsg && (
                <div
                  className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    branchMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}
                >
                  {branchMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{branchMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleAddBranch} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="settings-branch-name"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      Branch Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="settings-branch-name"
                      type="text"
                      required
                      placeholder="e.g. Indiranagar Branch"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settings-branch-city"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      City
                    </label>
                    <input
                      id="settings-branch-city"
                      type="text"
                      placeholder="e.g. Bengaluru"
                      value={branchCity}
                      onChange={(e) => setBranchCity(e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="settings-branch-address"
                    className="block text-xs font-semibold text-foreground mb-1"
                  >
                    Street Address
                  </label>
                  <input
                    id="settings-branch-address"
                    type="text"
                    placeholder="e.g. 100ft Road, 2nd Stage"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={branchLoading}
                    className="h-10 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {branchLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Create Branch
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden bg-background/50">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-foreground text-sm truncate">
                        {b.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {b.address || b.city || "Primary Gym Location"}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Check-in Enforcement Info */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-start gap-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground block mb-0.5">
                  Attendance & Expiry Enforcement
                </span>
                Active membership is required for self check-in. Expired memberships are gated on the kiosk unless staff logs an authorized grace override.
              </div>
            </div>
          </div>
        );

      case "payments":
        return (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-card-foreground leading-tight">
                  Gym Payment Collection
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Receipt format and manual collection configuration for member dues.
                </p>
              </div>
            </div>

            {/* Receipt Format Preview */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">
                  Print & WhatsApp Receipt Preview
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  Auto-generated
                </span>
              </div>
              <div className="p-3.5 bg-card rounded-xl border border-border font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {`🧾 ${initialGymName} — Official Receipt\n` +
                  `Receipt No: #A1B2C3D4\n` +
                  `Item: Membership Fee\n` +
                  `Amount: ₹3,000.00 (UPI)\n` +
                  `Status: PAID\n\n` +
                  `Computer-generated gym receipt • Thank you for training with us! 💪`}
              </div>
              <p className="text-xs text-muted-foreground">
                Receipts are generated automatically for Cash, UPI, and Card payments. Updating your gym name or phone in Gym Profile updates all newly generated receipts.
              </p>
            </div>

            {/* Manual UPI & Ledger Link */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-bold text-foreground">
                  UPI Verification & Payment Ledger
                </div>
                <p className="text-xs text-muted-foreground">
                  Review member-submitted UPI payment proofs, verify dues, and export payment records.
                </p>
              </div>
              <Link
                href={`/app/${gymId}/payments`}
                className="h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shrink-0"
              >
                Open Payments
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-card-foreground leading-tight">
                  Notifications & Templates
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Manual WhatsApp reminder templates and gym notice workflows.
                </p>
              </div>
            </div>

            {/* Active Manual WhatsApp Templates */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>Notice Broadcast Template</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    WhatsApp Direct
                  </span>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                  {`📢 *Notice from Gym Management*\n\nHello {Member Name},\n\n{Notice Message}`}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>Payment Receipt Template</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    WhatsApp Direct
                  </span>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                  {`🧾 *Gym Payment Receipt*\n\nHello {Member Name},\nPayment of ₹{Amount} received successfully.\nReceipt No: #{Receipt ID}`}
                </div>
              </div>
            </div>

            {/* Quick Links to Operational Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Link
                href={`/app/${gymId}/follow-ups`}
                className="p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold text-foreground">Follow-ups & Dues</div>
                  <div className="text-xs text-muted-foreground">Send renewal reminders</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
              <Link
                href={`/app/${gymId}/notices`}
                className="p-3.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold text-foreground">Gym Notice Board</div>
                  <div className="text-xs text-muted-foreground">Publish member announcements</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-card-foreground leading-tight">
                  Appearance & Preferences
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Select one of the four GymApra workspace themes. Changes apply instantly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themeList.map((cfg) => {
                const isSelected = mounted && theme === cfg.id;

                return (
                  <button
                    type="button"
                    key={cfg.id}
                    onClick={() => changeTheme(cfg.id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full border border-border shadow-xs flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: cfg.swatchColors[0] }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: cfg.swatchColors[1] }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                            <span>{cfg.name}</span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                              {cfg.mode}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {cfg.description}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="p-1 rounded-full bg-primary text-primary-foreground shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border w-full">
                      <div
                        className="h-2 rounded-full flex-1"
                        style={{ backgroundColor: cfg.primaryColor }}
                      />
                      <div
                        className="h-2 w-8 rounded-full border border-border"
                        style={{ backgroundColor: cfg.bgTone }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Platform Regional Defaults */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground font-medium">Currency</div>
                <div className="text-sm font-bold text-foreground mt-0.5">INR (₹)</div>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground font-medium">Timezone</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{APP_TIMEZONE_FULL_LABEL}</div>
              </div>
            </div>
          </div>
        );

      case "billing":
        return (
          <div className="space-y-5">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-card-foreground leading-tight">
                  Subscription & Billing
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Your GymApra workspace subscription status, pilot access, and account details.
                </p>
              </div>
            </div>

            {/* Subscription Status Card */}
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wider">
                  Current Tier
                </div>
                <div className="text-lg font-black text-foreground uppercase mt-0.5">
                  {account.tier} TIER
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {account.daysRemaining > 0
                    ? `Access is active with ${account.daysRemaining} days remaining`
                    : "Trial or pilot has expired"}
                </div>
              </div>
              <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full font-bold text-xs shadow-xs w-fit shrink-0">
                {account.isPilot ? "PILOT ACCESS" : "STANDARD TRIAL"}
              </span>
            </div>

            {/* Pilot Code Redemption Form */}
            <div className="pt-2 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Redeem Gym Pilot Invite Code
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter an official partner pilot code to extend your workspace access.
                </p>
              </div>

              {pilotMsg && (
                <div
                  className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    pilotMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}
                >
                  {pilotMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{pilotMsg.text}</span>
                </div>
              )}

              <form
                onSubmit={handleRedeemPilot}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <input
                  type="text"
                  required
                  placeholder="Enter pilot invite code"
                  value={pilotCode}
                  onChange={(e) => setPilotCode(e.target.value)}
                  className="flex-1 h-11 px-3.5 bg-background border border-border rounded-xl text-sm uppercase font-mono font-bold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={pilotLoading}
                  className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98] shrink-0 cursor-pointer"
                >
                  {pilotLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Redeem Code"
                  )}
                </button>
              </form>
            </div>

            {/* Account & Session Info */}
            <div className="pt-4 border-t border-border space-y-2.5">
              <h3 className="text-sm font-bold text-foreground">Account & Session</h3>
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground block font-medium">
                    Signed in Email
                  </span>
                  <span className="text-sm font-bold text-foreground truncate block">
                    {userEmail}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-card text-foreground font-bold text-xs capitalize border border-border shrink-0">
                  {userRole}
                </span>
              </div>
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">
                    Security
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    Encrypted password authentication
                  </span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1 shrink-0">
                  <Shield className="w-3.5 h-3.5" /> Protected
                </span>
              </div>
            </div>
          </div>
        );
    }
  }

  const generalSections = SETTINGS_SECTIONS.filter((s) => s.group === "general");
  const communicationSections = SETTINGS_SECTIONS.filter((s) => s.group === "communication");
  const preferenceSections = SETTINGS_SECTIONS.filter((s) => s.group === "preferences");

  function renderMobileOptionRow(item: SectionMeta) {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => selectSection(item.id)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-3.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground leading-tight truncate">
              {item.title}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {item.mobileSub}
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* =====================================================================
          MOBILE VIEW (< lg) — Image 1 Reference
          Landing view shows ONLY the 6 settings options; clicking one opens
          a dedicated section view with contextual back navigation.
          ===================================================================== */}
      <div className="lg:hidden space-y-4">
        {mobileActiveSection === null ? (
          <>
            {/* Mobile Settings Heading */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                Settings
              </h1>
            </div>

            {/* Gym Summary Card */}
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                  {gymInitial}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">
                    {initialGymName}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{primaryBranch}</span>
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 capitalize shrink-0">
                {userRole}
              </span>
            </div>

            {/* Group 1: General */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>General</span>
              </div>
              <div className="rounded-2xl bg-card border border-border shadow-xs divide-y divide-border overflow-hidden">
                {generalSections.map(renderMobileOptionRow)}
              </div>
            </div>

            {/* Group 2: Communication */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-foreground">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Communication</span>
              </div>
              <div className="rounded-2xl bg-card border border-border shadow-xs divide-y divide-border overflow-hidden">
                {communicationSections.map(renderMobileOptionRow)}
              </div>
            </div>

            {/* Group 3: Preferences */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-foreground">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                <span>Preferences</span>
              </div>
              <div className="rounded-2xl bg-card border border-border shadow-xs divide-y divide-border overflow-hidden">
                {preferenceSections.map(renderMobileOptionRow)}
              </div>
            </div>

            {/* Logout Button */}
            <form action={logoutAction} className="pt-1">
              <button
                type="submit"
                className="w-full h-12 px-4 rounded-2xl bg-card border border-border hover:bg-destructive/5 text-destructive font-bold text-sm flex items-center gap-2.5 shadow-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </form>
          </>
        ) : (
          /* Mobile Selected Section View */
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => selectSection(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 -ml-1 rounded-xl text-sm font-bold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-primary" />
              <span>Settings</span>
            </button>

            <div className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-xs">
              {renderSectionContent(mobileActiveSection)}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          DESKTOP VIEW (lg+) — Image 2 Reference
          Two-column layout: Left section nav + Right active section card.
          ===================================================================== */}
      <div className="hidden lg:block space-y-5">
        {/* Desktop Settings Heading */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Settings
          </h1>
        </div>

        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left Navigation Card */}
          <nav
            aria-label="Settings sections"
            className="col-span-4 bg-card p-2.5 rounded-2xl border border-border shadow-xs space-y-1"
          >
            {SETTINGS_SECTIONS.map((tab) => {
              const Icon = tab.icon;
              const isActive = desktopActiveSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectSection(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/25 shadow-2xs"
                      : "text-foreground hover:bg-muted/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/70 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-tight truncate">
                        {tab.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-normal truncate mt-0.5">
                        {tab.desktopSub}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Right Active Section Content Card */}
          <div className="col-span-8 min-w-0 bg-card p-6 rounded-2xl border border-border shadow-xs">
            {renderSectionContent(desktopActiveSection)}
          </div>
        </div>
      </div>
    </div>
  );
}
