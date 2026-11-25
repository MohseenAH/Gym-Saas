"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InviteStaffModal } from "@/components/staff/invite-staff-modal";
import {
  UserPlus,
  ShieldCheck,
  Phone,
  Clock,
  Users,
  CheckCircle2,
  Mail,
  Layers,
  Search,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { ROLE_LABELS, StaffRole } from "@/lib/auth/roles";
import { revokeInvitationAction, toggleStaffStatusAction } from "@/lib/actions/invitations";
import { getStatusBadgeClass, formatDate } from "@/lib/utils";

export interface StaffMember {
  id: string;
  userId: string;
  role: StaffRole;
  status: "active" | "suspended";
  profiles: {
    full_name: string;
    phone?: string;
  };
  email?: string;
}

export interface StaffInvitation {
  id: string;
  role: StaffRole;
  email: string;
  phone?: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Props {
  gymId: string;
  gymName: string;
  staffList: StaffMember[];
  invitations: StaffInvitation[];
  branches: Branch[];
  canManageStaff: boolean;
}

export function StaffClientView({
  gymId,
  gymName,
  staffList,
  invitations,
  branches,
  canManageStaff,
}: Props) {
  void gymName;
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"team" | "invitations">("team");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  async function handleRevoke(invitationId: string) {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    await revokeInvitationAction({ gymId, invitationId });
    router.refresh();
  }

  async function handleToggleStatus(gymUserId: string, currentStatus: "active" | "suspended") {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    await toggleStaffStatusAction({ gymId, gymUserId, status: nextStatus });
    router.refresh();
  }

  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const activeStaffCount = staffList.filter((s) => s.status === "active").length;
  const distinctRolesCount = new Set(staffList.map((s) => s.role)).size;

  const filteredStaff = staffList.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = s.profiles.full_name.toLowerCase().includes(q);
      const phoneMatch = (s.profiles.phone || "").toLowerCase().includes(q);
      const roleMatch = (ROLE_LABELS[s.role] || s.role).toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !roleMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Staff &amp; Access
          </h1>
        </div>

        {canManageStaff && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Invite Staff
          </button>
        )}
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          label="Total Staff"
          value={staffList.length}
          variant="purple"
          icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
          subtext="Team members"
        />
        <KpiCard
          label="Active Staff"
          value={activeStaffCount}
          variant="green"
          icon={<CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          subtext="With active access"
        />
        <KpiCard
          label="Pending Invitations"
          value={pendingInvites.length}
          variant="amber"
          icon={<Mail className="w-4 h-4 sm:w-5 sm:h-5" />}
          subtext="Awaiting acceptance"
        />
        <KpiCard
          label="Roles Assigned"
          value={distinctRolesCount}
          variant="blue"
          icon={<Layers className="w-4 h-4 sm:w-5 sm:h-5" />}
          subtext="Distinct access tiers"
        />
      </div>

      {/* Navigation Tabs + Search/Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "team"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Active Team ({staffList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "invitations"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Invitations ({pendingInvites.length})
          </button>
        </div>

        {activeTab === "team" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, role..."
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
              {(["all", "active", "suspended"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab 1: Active Team */}
      {activeTab === "team" && (
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border font-bold uppercase tracking-wider text-muted-foreground text-xs">
                <tr>
                  <th className="px-6 py-3.5">Staff Member</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Contact</th>
                  {canManageStaff && <th className="px-6 py-3.5 text-right">Access Control</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground text-base">
                        {member.profiles?.full_name || "Staff Member"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium bg-muted text-foreground capitalize border border-border">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          member.status === "active"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {member.profiles?.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span>{member.profiles.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {canManageStaff && (
                      <td className="px-6 py-4 text-right">
                        {member.role !== "owner" && (
                          <button
                            onClick={() => handleToggleStatus(member.id, member.status)}
                            className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                              member.status === "active"
                                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20"
                            }`}
                          >
                            {member.status === "active" ? "Suspend Access" : "Reactivate"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pending Invitations */}
      {activeTab === "invitations" && (
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border font-bold uppercase tracking-wider text-muted-foreground text-xs">
                <tr>
                  <th className="px-6 py-3.5">Recipient Identifier</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Expires</th>
                  {canManageStaff && <th className="px-6 py-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-muted-foreground font-medium">
                      No invitations found. Click &quot;Invite Staff Member&quot; to issue an invitation link.
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {inv.email.includes("@wa.invite") ? inv.email.replace("@wa.invite", " (Phone)") : inv.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize font-semibold text-foreground">
                          {ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            inv.status === "pending"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : inv.status === "accepted"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(inv.expiresAt)}
                      </td>
                      {canManageStaff && (
                        <td className="px-6 py-4 text-right">
                          {inv.status === "pending" && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl text-sm font-semibold transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InviteStaffModal
        gymId={gymId}
        branches={branches}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}