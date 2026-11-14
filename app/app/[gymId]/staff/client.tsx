"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InviteStaffModal } from "@/components/staff/invite-staff-modal";
import {
  UserPlus,
  ShieldCheck,
  Phone,
  Clock,
} from "lucide-react";
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Team & Staff Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members, branch authorizations, and staff invitations
          </p>
        </div>

        {canManageStaff && (
          <button
            onClick={() => setModalOpen(true)}
            className="h-11 inline-flex items-center gap-2 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold shadow-xs transition-all active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" /> Invite Staff Member
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "team"
              ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/25"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Active Team ({staffList.length})
        </button>

        <button
          onClick={() => setActiveTab("invitations")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "invitations"
              ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/25"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Invitations ({pendingInvites.length})
        </button>
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
                {staffList.map((member) => (
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