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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Team & Staff Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your team members, branch authorizations, and staff invitations
          </p>
        </div>

        {canManageStaff && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invite Staff Member
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "team"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Active Team ({staffList.length})
        </button>

        <button
          onClick={() => setActiveTab("invitations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "invitations"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Invitations ({pendingInvites.length})
        </button>
      </div>

      {/* Tab 1: Active Team */}
      {activeTab === "team" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Staff Member</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Contact</th>
                  {canManageStaff && <th className="px-6 py-3.5 text-right">Access Control</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {staffList.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">
                        {member.profiles?.full_name || "Staff Member"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 capitalize border border-slate-200/60">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-red-50 text-red-700 border border-red-200/60"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {member.profiles?.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{member.profiles.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {canManageStaff && (
                      <td className="px-6 py-4 text-right">
                        {member.role !== "owner" && (
                          <button
                            onClick={() => handleToggleStatus(member.id, member.status)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                              member.status === "active"
                                ? "bg-red-50 hover:bg-red-100 text-red-700"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Recipient Identifier</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Expires</th>
                  {canManageStaff && <th className="px-6 py-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No invitations found. Click &quot;Invite Staff Member&quot; to issue an invitation link.
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {inv.email.includes("@wa.invite") ? inv.email.replace("@wa.invite", " (Phone)") : inv.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize font-semibold text-slate-700">
                          {ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            inv.status === "pending"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : inv.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      {canManageStaff && (
                        <td className="px-6 py-4 text-right">
                          {inv.status === "pending" && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold transition-colors"
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
