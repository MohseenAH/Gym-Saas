"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

    try {
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

      if (!res.success) {
        setError(res.error || "Failed to update member");
      } else {
        onSuccess?.();
        onClose();
        setTimeout(() => {
          startTransition(() => {
            router.refresh();
          });
        }, 150);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl shadow-2xs">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Edit Member Profile</h3>
              <p className="text-xs text-muted-foreground">Update member contact, branch assignment, or status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Phone Number *</label>
              <input
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. member@example.com"
              className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Assigned Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "suspended")}
                className="w-full h-11 px-3.5 bg-muted/40 border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 capitalize cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Notes / Health Info</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions, injuries, medical notes..."
              className="w-full p-3 bg-muted/40 border border-input rounded-xl text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 h-11 px-5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl shadow-md shadow-primary/25 transition-all disabled:opacity-50 cursor-pointer"
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
