import { createClient } from "@/lib/supabase/server";
import { Bell, Flame, AlertTriangle, Info, Calendar } from "lucide-react";

interface NoticesPageProps {
  params: Promise<{ gymId: string }>;
}

export default async function MemberNoticesPage({ params }: NoticesPageProps) {
  const { gymId } = await params;
  const supabase = await createClient();

  // Fetch notices for gym (and specific branch or gym-wide)
  const { data: notices } = await supabase
    .from("notices")
    .select("id, title, content, priority, published_at, expires_at")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("published_at", { ascending: false });

  const allNotices = notices || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gym Notice Board</h1>
        <p className="text-xs text-slate-500 mt-1">
          Official announcements, holiday schedules, and updates from gym management
        </p>
      </div>

      <div className="space-y-3">
        {allNotices.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Announcements Right Now</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Check back later for news, fitness workshops, and schedule updates.
            </p>
          </div>
        ) : (
          allNotices.map((n) => {
            const isUrgent = n.priority === "urgent";
            const isImportant = n.priority === "important";

            return (
              <div
                key={n.id}
                className={`bg-white p-5 rounded-2xl border shadow-xs transition-all ${
                  isUrgent
                    ? "border-red-300 bg-red-50/20"
                    : isImportant
                    ? "border-amber-300 bg-amber-50/20"
                    : "border-slate-200/80"
                }`}
              >
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

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{n.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          isUrgent
                            ? "bg-red-100 text-red-800"
                            : isImportant
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {n.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                      {n.content}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(n.published_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
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
