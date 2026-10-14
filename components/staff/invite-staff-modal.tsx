"use client";

import { useState } from "react";
import { createStaffInvitationAction } from "@/lib/actions/invitations";
import { StaffRole } from "@/lib/auth/roles";
import {
  X,
  Copy,
  Check,
  Share2,
  Mail,
  Phone,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface ModalProps {
  gymId: string;
  branches: Branch[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type InvitableStaffRole = Exclude<StaffRole, "owner">;

export function InviteStaffModal({
  gymId,
  branches,
  isOpen,
  onClose,
  onSuccess,
}: ModalProps) {
  const [role, setRole] = useState<InvitableStaffRole>("staff");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(
    branches.map((b) => b.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<{
    inviteUrl: string;
    whatsappUrl: string;
    gmailUrl: string;
    messageText: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleToggleBranch = (branchId: string) => {
    if (selectedBranches.includes(branchId)) {
      setSelectedBranches(selectedBranches.filter((id) => id !== branchId));
    } else {
      setSelectedBranches([...selectedBranches, branchId]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createStaffInvitationAction({
        gymId,
        email: email || undefined,
        phone: phone || undefined,
        role,
        branchIds: selectedBranches,
      });

      if (!result.success || !result.links) {
        throw new Error(result.error || "Failed to generate invitation");
      }

      setGeneratedLinks(result.links);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLinks) return;
    navigator.clipboard.writeText(generatedLinks.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                Invite Staff Member
              </h2>
              <p className="text-xs text-slate-500">
                Grant team access with branch scoping and 1-click sharing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200/70 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {!generatedLinks ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvitableStaffRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="trainer">Trainer (Member View, Attendance)</option>
                  <option value="staff">Front Desk Staff (Members, Attendance, Payments)</option>
                  <option value="manager">Manager (Members, Operations, Reports, Expenses)</option>
                  <option value="partner">Partner (Full Operations, Staff, Plans)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Phone Number (for WhatsApp)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@gym.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Branch Scope */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Branch Permissions
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-3">
                    {branches.map((b) => (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(b.id)}
                          onChange={() => handleToggleBranch(b.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{b.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Secure Token...
                  </>
                ) : (
                  "Generate Invitation Link"
                )}
              </button>
            </form>
          ) : (
            /* Sharing CTAs View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium">
                Invitation link generated! Choose a 1-click sharing action below:
              </div>

              {/* URL Box with Copy */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <input
                  type="text"
                  readOnly
                  value={generatedLinks.inviteUrl}
                  className="flex-1 bg-transparent text-xs font-mono text-slate-700 outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>

              {/* 1-Click CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={generatedLinks.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Send via WhatsApp
                </a>

                <a
                  href={generatedLinks.gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  <Mail className="w-4 h-4" /> Send via Gmail
                </a>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedLinks(null);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
