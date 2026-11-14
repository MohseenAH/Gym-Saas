import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { CreateNoticeModal } from "@/components/notices/create-notice-modal";
import { Bell, AlertTriangle, Info, Flame, Trash2, Eye, EyeOff } from "lucide-react";
import { toggleNoticeAction, deleteNoticeAction } from "@/lib/actions/notices";
import { formatDate } from "@/lib/utils";

interface NoticesPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function NoticesPage({ params }: NoticesPageProps) {
  const { gymId } = await params;

  const authContext = await getAuthorizedActionContext({
    gymId,
    capability: "notices:view",
  });

  const supabase = await createClient();

  // Fetch notices
  const { data: allNoticesData } = await supabase
    .from("notices")
    .select("id, title, content, priority, is_active, published_at, expires_at, branches(name)")
    .eq("gym_id", gymId)
    .order("published_at", { ascending: false });

  const branches = authContext.branches;
  const allNotices = allNoticesData || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Gym Notice Board</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Broadcast operational updates, holiday schedules, and notices to member portals
          </p>
        </div>
        <CreateNoticeModal gymId={gymId} branches={branches || []} />
      </div>

      {/* Notice List */}
      <div className="space-y-3">
        {allNotices.length === 0 ? (
          <div className="bg-card p-12 text-center rounded-3xl border border-border shadow-xs">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No Announcements Posted</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Keep your members informed! Post holiday notices, equipment maintenance alerts, or special event announcements.
            </p>
          </div>
        ) : (
          allNotices.map((notice) => {
            const isUrgent = notice.priority === "urgent";
            const isImportant = notice.priority === "important";

            return (
              <div
                key={notice.id}
                className={`p-5 rounded-3xl border shadow-xs transition-all ${
                  !notice.is_active
                    ? "opacity-60 bg-muted/20 border-border"
                    : isUrgent
                    ? "border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10"
                    : isImportant
                    ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                        isUrgent
                          ? "bg-rose-500/15 text-rose-500"
                          : isImportant
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {isUrgent ? (
                        <Flame className="w-5 h-5" />
                      ) : isImportant ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Info className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-foreground">{notice.title}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                              : isImportant
                              ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {notice.priority}
                        </span>
                        <span className="px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-semibold">
                          {(notice.branches as unknown as { name?: string } | null)?.name || "All Branches"}
                        </span>
                        {!notice.is_active && (
                          <span className="px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-bold">
                            Archived
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">
                        {notice.content}
                      </p>

                      <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground mt-3">
                        <span>
                          Posted: {formatDate(notice.published_at)}
                        </span>
                        {notice.expires_at && (
                          <>
                            <span>•</span>
                            <span>
                              Expires: {formatDate(notice.expires_at)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <form
                      action={async () => {
                        "use server";
                        await toggleNoticeAction({
                          gymId,
                          noticeId: notice.id,
                          isActive: !notice.is_active,
                        });
                      }}
                    >
                      <button
                        type="submit"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                        title={notice.is_active ? "Archive Notice" : "Reactivate Notice"}
                      >
                        {notice.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </form>

                    <form
                      action={async () => {
                        "use server";
                        await deleteNoticeAction({
                          gymId,
                          noticeId: notice.id,
                        });
                      }}
                    >
                      <button
                        type="submit"
                        className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}