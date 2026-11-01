"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Building2,
  Calendar,
  Receipt,
  User,
  Shield,
  Sparkles,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Palette,
  Check,
} from "lucide-react";
import {
  updateGymProfileAction,
  createPlanAction,
  togglePlanAction,
  redeemPilotCodeAction,
} from "@/lib/actions/gym";
import { createBranchAction } from "@/lib/actions/branches";
import { useGymTheme, THEME_CONFIGS, GymTheme } from "@/lib/theme";

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
}

export function SettingsViewClient({
  gymId,
  gymName: initialGymName,
  gymPhone: initialGymPhone,
  branches,
  plans,
  account,
  userEmail,
  userRole,
}: SettingsViewClientProps) {
  const router = useRouter();
  const { theme, changeTheme } = useGymTheme();

  const [activeTab, setActiveTab] = useState<
    "profile" | "theme" | "branches" | "plans" | "receipts" | "account" | "pilot"
  >("profile");

  // Gym Profile Form State
  const [gymName, setGymName] = useState(initialGymName);
  const [gymPhone, setGymPhone] = useState(initialGymPhone || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Plan Form State
  const [planName, setPlanName] = useState("");
  const [planDuration, setPlanDuration] = useState("30");
  const [planPrice, setPlanPrice] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Branch Form State
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
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
    await togglePlanAction({
      gymId,
      planId,
      isActive: !currentStatus,
    });
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
      phone: branchPhone || undefined,
    });

    setBranchLoading(false);
    if (!res.success) {
      setBranchMsg({ type: "error", text: res.error || "Failed to create branch" });
    } else {
      setBranchMsg({ type: "success", text: "New branch created successfully!" });
      setBranchName("");
      setBranchAddress("");
      setBranchCity("");
      setBranchPhone("");
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Gym & System Settings</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure gym business details, membership pricing, themes, receipt templates, and subscription access
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {(
          [
            { id: "profile", label: "Gym Profile", icon: Building2 },
            { id: "theme", label: "Appearance & Themes", icon: Palette },
            { id: "branches", label: `Branches (${branches.length})`, icon: Building2 },
            { id: "plans", label: `Membership Plans (${plans.length})`, icon: Calendar },
            { id: "receipts", label: "Receipt Settings", icon: Receipt },
            { id: "pilot", label: "Pilot & Subscription", icon: Sparkles },
            { id: "account", label: "My Account", icon: User },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Gym Profile */}
      {activeTab === "profile" && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-2xl">
          <h2 className="text-sm font-bold text-card-foreground mb-1">Gym Identity & Contact</h2>
          <p className="text-xs text-muted-foreground mb-4">
            This name and contact number will appear on member receipts and digital passes.
          </p>

          {profileMsg && (
            <div
              className={`mb-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                profileMsg.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {profileMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Gym Name *</label>
              <input
                type="text"
                required
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Public Phone / WhatsApp *</label>
              <input
                type="tel"
                inputMode="tel"
                value={gymPhone}
                onChange={(e) => setGymPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="h-11 inline-flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {profileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Gym Profile
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Theme & Appearance */}
      {activeTab === "theme" && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-3xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-card-foreground">Workspace Theme & Aesthetic</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Select one of the 4 tailored gym color themes. Changes apply instantly across the staff application and member views.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(THEME_CONFIGS) as GymTheme[]).map((themeKey) => {
              const cfg = THEME_CONFIGS[themeKey];
              const isSelected = theme === themeKey;

              return (
                <div
                  key={themeKey}
                  onClick={() => changeTheme(themeKey)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-4 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                      : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full border border-border shadow-xs flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cfg.bgTone }}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: cfg.primaryColor }}
                        />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>{cfg.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            ({themeKey})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="p-1 rounded-full bg-primary text-primary-foreground shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <div
                      className="h-2 rounded-full flex-1"
                      style={{ backgroundColor: cfg.primaryColor }}
                    />
                    <div
                      className="h-2 w-8 rounded-full border border-border"
                      style={{ backgroundColor: cfg.bgTone }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Branches */}
      {activeTab === "branches" && (
        <div className="space-y-6">
          {/* Add Branch */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-2xl">
            <h2 className="text-sm font-bold text-card-foreground mb-1">Add New Branch Location</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Add multiple fitness centers or studio locations under your GymApra account.
            </p>

            {branchMsg && (
              <div
                className={`mb-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  branchMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {branchMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{branchMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Branch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indiranagar Branch"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 100ft Road, 2nd Stage"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={branchLoading}
                className="h-11 inline-flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {branchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create Branch
              </button>
            </form>
          </div>

          {/* Existing Branches List */}
          <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden max-w-2xl">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Active Branches ({branches.length})
            </div>
            <div className="divide-y divide-border">
              {branches.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="font-bold text-foreground text-sm">{b.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {b.address || b.city || "Primary Gym Location"}
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Membership Plans */}
      {activeTab === "plans" && (
        <div className="space-y-6">
          {/* Add Plan Form */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-2xl">
            <h2 className="text-sm font-bold text-card-foreground mb-1">Create Membership Tier</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Define subscription plans that reception staff can assign and renew for members.
            </p>

            {planMsg && (
              <div
                className={`mb-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  planMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {planMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{planMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddPlan} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quarterly Pro"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Duration (Days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={planDuration}
                    onChange={(e) => setPlanDuration(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    inputMode="decimal"
                    placeholder="e.g. 4500"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-bold transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={planLoading}
                className="h-11 inline-flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {planLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Plan Tier
              </button>
            </form>
          </div>

          {/* Existing Plans */}
          <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden max-w-2xl">
            <div className="p-4 border-b border-border font-bold text-sm text-card-foreground">
              Configured Plans ({plans.length})
            </div>
            <div className="divide-y divide-border">
              {plans.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="font-bold text-foreground text-sm flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">({p.duration_days} days)</span>
                    </div>
                    <div className="text-xs font-bold text-primary mt-0.5">
                      ₹{p.price.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTogglePlan(p.id, p.is_active)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      p.is_active
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.is_active ? "Active" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Receipt Settings */}
      {activeTab === "receipts" && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-2xl space-y-4">
          <h2 className="text-sm font-bold text-card-foreground mb-1">Computer-Generated Receipt Configuration</h2>
          <p className="text-xs text-muted-foreground">
            Receipts in GymApra are generated automatically for manual payments (Cash, UPI, Card).
          </p>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-2">
            <div className="font-bold text-foreground">Print & WhatsApp Receipt Format Preview:</div>
            <div className="p-3.5 bg-card rounded-xl border border-border font-mono text-[11px] text-foreground whitespace-pre">
              {`🧾 ${initialGymName} — Official Receipt\n` +
                `Receipt No: #A1B2C3D4\n` +
                `Item: Membership Fee\n` +
                `Amount: ₹3,000.00 (UPI)\n` +
                `Status: PAID\n\n` +
                `Computer-generated gym receipt • Thank you for training with us! 💪`}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            * Note: Changing your gym name or contact number in Gym Profile will apply to all newly generated and reprinted receipts automatically.
          </p>
        </div>
      )}

      {/* Tab 6: Pilot & Subscription */}
      {activeTab === "pilot" && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-2xl space-y-5">
          <div>
            <h2 className="text-sm font-bold text-card-foreground">Subscription & 60-Day Pilot Access</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controlled pilot access enables Indian gyms to test all features risk-free.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-primary uppercase">Current Tier</div>
              <div className="text-base font-black text-foreground uppercase mt-0.5">
                {account.tier} TIER
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {account.daysRemaining > 0
                  ? `Access is active with ${account.daysRemaining} days remaining`
                  : "Trial or pilot has expired"}
              </div>
            </div>
            <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full font-bold text-xs shadow-xs">
              {account.isPilot ? "PILOT ACCESS" : "STANDARD TRIAL"}
            </span>
          </div>

          {/* Pilot Code Redemption Form */}
          <div className="pt-3 border-t border-border">
            <h3 className="text-xs font-bold text-foreground mb-1">Redeem Gym Pilot Invite Code</h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Enter your official partner pilot invite code (e.g. <span className="font-mono font-bold text-primary">PILOT60</span>) to extend your gym&apos;s trial to 60 days of full Pro access.
            </p>

            {pilotMsg && (
              <div
                className={`mb-3 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  pilotMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {pilotMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{pilotMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleRedeemPilot} className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Enter PILOT60 or coupon code"
                value={pilotCode}
                onChange={(e) => setPilotCode(e.target.value)}
                className="flex-1 h-11 px-3.5 bg-background border border-border rounded-xl text-xs uppercase font-mono font-bold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <button
                type="submit"
                disabled={pilotLoading}
                className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {pilotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Redeem Code"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 7: My Account */}
      {activeTab === "account" && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-xs max-w-2xl space-y-4">
          <h2 className="text-sm font-bold text-card-foreground mb-1">My Account & Credentials</h2>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between">
              <div>
                <span className="text-muted-foreground block font-medium">Signed in Email</span>
                <span className="font-bold text-foreground">{userEmail}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-muted text-foreground font-bold text-[11px] capitalize border border-border">
                {userRole}
              </span>
            </div>

            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border flex items-center justify-between">
              <div>
                <span className="text-muted-foreground block font-medium">Security</span>
                <span className="font-semibold text-foreground">Encrypted password authentication</span>
              </div>
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Protected
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}