"use client";

import { useState } from "react";
import { Edit2, X, Loader2, Save } from "lucide-react";
import { updateMemberAction } from "@/lib/actions/members";

interface Branch {
  id: string;
  name: string;
}

interface EditMemberModalProps {
  gymId: string;
  member: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
    branchId: string;
    status: "active" | "inactive" | "suspended";
    notes?: string | null;
  };
  branches: Branch[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditMemberModal({
  gymId,
  member,
  branches,
  isOpen,
  onClose,
  onSuccess,
}: EditMemberModalProps) {
  const [fullName, setFullName] = useState(member.fullName);
  const [phone, setPhone] = useState(member.phone);
  const [email, setEmail] = useState(member.email || "");
  const [branchId, setBranchId] = useState(member.branchId);
  const [status, setStatus] = useState<"active" | "inactive" | "suspended">(member.status);
  const [notes, setNotes] = useState(member.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await updateMemberAction({
      gymId,
      memberId: member.id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      branchId,
      status,
      notes: notes.trim() || null,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to update member");
    } else {
      onSuccess?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Member Profile</h3>
              <p className="text-xs text-slate-500">Update member contact, branch assignment, or status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. member@example.com"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Health Info</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions, injuries, medical notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

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
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
