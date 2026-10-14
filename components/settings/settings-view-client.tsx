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
} from "lucide-react";
import {
  updateGymProfileAction,
  createPlanAction,
  togglePlanAction,
  redeemPilotCodeAction,
} from "@/lib/actions/gym";
import { createBranchAction } from "@/lib/actions/branches";

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
  const [activeTab, setActiveTab] = useState<
    "profile" | "branches" | "plans" | "receipts" | "account" | "pilot"
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
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Gym & System Settings</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure gym business details, membership pricing, receipt templates, and subscription access
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {(
          [
            { id: "profile", label: "Gym Profile", icon: Building2 },
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Gym Identity & Contact</h2>
          <p className="text-xs text-slate-500 mb-4">
            This name and contact number will appear on member receipts and digital passes.
          </p>

          {profileMsg && (
            <div
              className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                profileMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {profileMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gym Name *</label>
              <input
                type="text"
                required
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Public Phone / WhatsApp *</label>
              <input
                type="tel"
                value={gymPhone}
                onChange={(e) => setGymPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {profileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Gym Profile
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Branches */}
      {activeTab === "branches" && (
        <div className="space-y-6">
          {/* Add Branch */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Add New Branch Location</h2>
            <p className="text-xs text-slate-500 mb-4">
              Add multiple fitness centers or studio locations under your GymApra account.
            </p>

            {branchMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  branchMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {branchMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{branchMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddBranch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indiranagar Branch"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 100ft Road, 2nd Stage"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={branchLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {branchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create Branch
              </button>
            </form>
          </div>

          {/* Existing Branches List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Active Branches ({branches.length})
            </div>
            <div className="divide-y divide-slate-100">
              {branches.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{b.name}</div>
                    <div className="text-xs text-slate-500">
                      {b.address || b.city || "Primary Gym Location"}
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Membership Plans */}
      {activeTab === "plans" && (
        <div className="space-y-6">
          {/* Add Plan Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Create Membership Tier</h2>
            <p className="text-xs text-slate-500 mb-4">
              Define subscription plans that reception staff can assign and renew for members.
            </p>

            {planMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  planMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {planMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{planMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddPlan} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quarterly Pro"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={planDuration}
                    onChange={(e) => setPlanDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 4500"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={planLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {planLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Plan Tier
              </button>
            </form>
          </div>

          {/* Existing Plans */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Configured Plans ({plans.length})
            </div>
            <div className="divide-y divide-slate-100">
              {plans.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-400 font-normal">({p.duration_days} days)</span>
                    </div>
                    <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                      ₹{p.price.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTogglePlan(p.id, p.is_active)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                      p.is_active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : "bg-slate-100 text-slate-500"
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

      {/* Tab 4: Receipt Settings */}
      {activeTab === "receipts" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl space-y-4">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Computer-Generated Receipt Configuration</h2>
          <p className="text-xs text-slate-500">
            Receipts in GymApra are generated automatically for manual payments (Cash, UPI, Card).
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-800">Print & WhatsApp Receipt Format Preview:</div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-600 whitespace-pre">
              {`🧾 ${initialGymName} — Official Receipt\n` +
                `Receipt No: #A1B2C3D4\n` +
                `Item: Membership Fee\n` +
                `Amount: ₹3,000.00 (UPI)\n` +
                `Status: PAID\n\n` +
                `Computer-generated gym receipt • Thank you for training with us! 💪`}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            * Note: Changing your gym name or contact number in Gym Profile will apply to all newly generated and reprinted receipts automatically.
          </p>
        </div>
      )}

      {/* Tab 5: Pilot & Subscription */}
      {activeTab === "pilot" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Subscription & 60-Day Pilot Access</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Controlled pilot access enables Indian gyms to test all features risk-free.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-indigo-500 uppercase">Current Tier</div>
              <div className="text-base font-black text-indigo-950 uppercase mt-0.5">
                {account.tier} TIER
              </div>
              <div className="text-xs text-indigo-700 mt-1">
                {account.daysRemaining > 0
                  ? `Access is active with ${account.daysRemaining} days remaining`
                  : "Trial or pilot has expired"}
              </div>
            </div>
            <span className="px-3 py-1 bg-indigo-600 text-white rounded-full font-bold text-xs shadow-2xs">
              {account.isPilot ? "PILOT ACCESS" : "STANDARD TRIAL"}
            </span>
          </div>

          {/* Pilot Code Redemption Form */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 mb-1">Redeem Gym Pilot Invite Code</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Enter your official partner pilot invite code (e.g. <span className="font-mono font-bold">PILOT60</span>) to extend your gym&apos;s trial to 60 days of full Pro access.
            </p>

            {pilotMsg && (
              <div
                className={`mb-3 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  pilotMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
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
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={pilotLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {pilotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Redeem Code"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 6: My Account */}
      {activeTab === "account" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl space-y-4">
          <h2 className="text-sm font-bold text-slate-900 mb-1">My Account & Credentials</h2>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Signed in Email</span>
                <span className="font-bold text-slate-800">{userEmail}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold text-[11px] capitalize">
                {userRole}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block font-medium">Security</span>
                <span className="font-semibold text-slate-700">Encrypted password authentication</span>
              </div>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Protected
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
