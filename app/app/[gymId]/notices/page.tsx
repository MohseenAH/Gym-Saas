import { createClient } from "@/lib/supabase/server";
import { getAuthorizedActionContext } from "@/lib/auth/guard";
import { CreateNoticeModal } from "@/components/notices/create-notice-modal";
import { Bell, AlertTriangle, Info, Flame, Trash2, Eye, EyeOff } from "lucide-react";
import { toggleNoticeAction, deleteNoticeAction } from "@/lib/actions/notices";

interface NoticesPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function NoticesPage({ params }: NoticesPageProps) {
  const { gymId } = await params;

  await getAuthorizedActionContext({
    gymId,
    capability: "notices:view",
  });

  const supabase = await createClient();

  // Fetch branches and notices in parallel
  const [branchesRes, noticesRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("gym_id", gymId)
      .eq("is_active", true),
    supabase
      .from("notices")
      .select("id, title, content, priority, is_active, published_at, expires_at, branches(name)")
      .eq("gym_id", gymId)
      .order("published_at", { ascending: false }),
  ]);

  const branches = branchesRes.data || [];
  const allNotices = noticesRes.data || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gym Notice Board</h1>
          <p className="text-xs text-slate-500 mt-1">
            Broadcast operational updates, holiday schedules, and notices to member portals
          </p>
        </div>
        <CreateNoticeModal gymId={gymId} branches={branches || []} />
      </div>

      {/* Notice List */}
      <div className="space-y-3">
        {allNotices.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Announcements Posted</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
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
                className={`bg-white p-5 rounded-2xl border shadow-xs transition-all ${
                  !notice.is_active
                    ? "opacity-60 border-slate-200"
                    : isUrgent
                    ? "border-red-300 bg-red-50/20"
                    : isImportant
                    ? "border-amber-300 bg-amber-50/20"
                    : "border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isUrgent
                          ? "bg-red-100 text-red-700"
                          : isImportant
                          ? "bg-amber-100 text-amber-700"
                          : "bg-indigo-50 text-indigo-600"
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
                        <h3 className="text-base font-bold text-slate-900">{notice.title}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? "bg-red-100 text-red-800"
                              : isImportant
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {notice.priority}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-medium">
                          {(notice.branches as unknown as { name?: string } | null)?.name || "All Branches"}
                        </span>
                        {!notice.is_active && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-semibold">
                            Archived
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                        {notice.content}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-3">
                        <span>
                          Posted: {new Date(notice.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        {notice.expires_at && (
                          <>
                            <span>•</span>
                            <span>
                              Expires: {new Date(notice.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
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
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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
