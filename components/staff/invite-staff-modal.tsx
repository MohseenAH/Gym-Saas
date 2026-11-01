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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-card text-card-foreground rounded-3xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-card-foreground text-base">
                Invite Staff Member
              </h2>
              <p className="text-xs text-muted-foreground">
                Grant team access with branch scoping and 1-click sharing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          {!generatedLinks ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvitableStaffRole)}
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value="trainer">Trainer (Member View, Attendance)</option>
                  <option value="staff">Front Desk Staff (Members, Attendance, Payments)</option>
                  <option value="manager">Manager (Members, Operations, Reports, Expenses)</option>
                  <option value="partner">Partner (Full Operations, Staff, Plans)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Phone Number (for WhatsApp)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@gym.com"
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Branch Scope */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Branch Permissions
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-border rounded-xl p-3 bg-muted/20">
                    {branches.map((b) => (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(b.id)}
                          onChange={() => handleToggleBranch(b.id)}
                          className="rounded text-primary focus:ring-primary"
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
                className="w-full h-12 mt-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
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
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                Invitation link generated! Choose a 1-click sharing action below:
              </div>

              {/* URL Box with Copy */}
              <div className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/40">
                <input
                  type="text"
                  readOnly
                  value={generatedLinks.inviteUrl}
                  className="flex-1 px-2 bg-transparent text-xs font-mono text-foreground outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-9 px-3 rounded-lg bg-card border border-border hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
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
                  className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Send via WhatsApp
                </a>

                <a
                  href={generatedLinks.gmailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-foreground text-background hover:opacity-90 font-bold text-xs shadow-xs transition-colors"
                >
                  <Mail className="w-4 h-4" /> Send via Gmail
                </a>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedLinks(null);
                    onClose();
                  }}
                  className="h-10 px-4 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
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