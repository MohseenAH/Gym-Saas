"use client";

import { useState } from "react";
import { Plus, X, Bell, Loader2 } from "lucide-react";
import { createNoticeAction } from "@/lib/actions/notices";

interface CreateNoticeModalProps {
  gymId: string;
  branches: { id: string; name: string }[];
}

export function CreateNoticeModal({ gymId, branches }: CreateNoticeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [branchId, setBranchId] = useState<string>(""); // empty = all branches
  const [expiresAt, setExpiresAt] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !content.trim()) {
      setError("Please fill in both title and announcement message");
      return;
    }

    setLoading(true);
    const res = await createNoticeAction({
      gymId,
      branchId: branchId || null,
      title: title.trim(),
      content: content.trim(),
      priority,
      expiresAt: expiresAt || null,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to publish notice");
    } else {
      setIsOpen(false);
      setTitle("");
      setContent("");
      setPriority("normal");
      setExpiresAt("");
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-11 flex items-center gap-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold shadow-xs transition-all active:scale-[0.98]"
      >
        <Plus className="w-4 h-4" />
        Post Announcement
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-card-foreground">New Gym Announcement</h3>
                  <p className="text-xs text-muted-foreground">
                    Broadcast notices instantly to the member portal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gym Maintenance Hours this Sunday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Message Details
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Write message details for members..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "normal" | "important" | "urgent")}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 capitalize font-medium transition-all"
                  >
                    <option value="normal">Normal (Informational)</option>
                    <option value="important">Important (Highlighted)</option>
                    <option value="urgent">Urgent (Red Banner)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Target Branch
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                  >
                    <option value="">All Branches (Gym-Wide)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 font-medium transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-11 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 flex items-center gap-2 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Broadcast Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}