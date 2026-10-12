import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, UserCircle, ArrowRight, LogOut, Plus } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

export default async function SelectWorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch gyms owned directly via accounts table
  const { data: ownedAccounts } = await supabase
    .from("accounts")
    .select("id, gyms ( id, name, address )")
    .eq("owner_id", user.id);

  // 2. Fetch staff gyms safely
  const { data: rawStaffRoles } = await supabase
    .from("gym_users")
    .select("role, gym_id, gyms ( id, name, address )")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Merge owned gyms and staff roles
  const staffRolesMap = new Map<string, any>();

  // Add owned gyms first with role = 'owner'
  (ownedAccounts || []).forEach((acc: any) => {
    (acc.gyms || []).forEach((g: any) => {
      staffRolesMap.set(g.id, {
        gym_id: g.id,
        role: "owner",
        gyms: g,
      });
    });
  });

  // Add any additional staff roles
  (rawStaffRoles || []).forEach((item: any) => {
    if (!staffRolesMap.has(item.gym_id)) {
      staffRolesMap.set(item.gym_id, item);
    }
  });

  const staffRoles = Array.from(staffRolesMap.values());

  // Fetch member portals
  const { data: memberPortals } = await supabase
    .from("members")
    .select("id, full_name, branch_id, branches ( id, name, gym_id, gyms ( id, name ) )")
    .eq("user_id", user.id)
    .eq("status", "active");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Select Workspace
            </h1>
            <p className="text-sm text-slate-500">
              Logged in as {user.email}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-6">
          {/* Staff Workspaces */}
          {staffRoles && staffRoles.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Staff & Operations
              </h2>
              <div className="space-y-2">
                {staffRoles.map((item: any) => (
                  <Link
                    key={item.gym_id}
                    href={`/app/${item.gym_id}/dashboard`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-slate-200/80 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {item.gyms?.name || "Gym Workspace"}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">
                          Role: {item.role}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Member Portals */}
          {memberPortals && memberPortals.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Member Portals
              </h2>
              <div className="space-y-2">
                {memberPortals.map((m: any) => {
                  const gymId = m.branches?.gym_id;
                  const gymName = m.branches?.gyms?.name || "Gym";
                  return (
                    <Link
                      key={m.id}
                      href={`/portal/${gymId}/dashboard`}
                      className="group flex items-center justify-between p-4 rounded-xl border border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <UserCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {gymName} Member Portal
                          </div>
                          <div className="text-xs text-slate-500">
                            Branch: {m.branches?.name || "Main Branch"}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {(!staffRoles || staffRoles.length === 0) &&
            (!memberPortals || memberPortals.length === 0) && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <p className="mb-1 text-slate-600 font-medium">No active gym memberships found.</p>
                <p className="text-xs text-slate-400 mb-5">Set up your gym workspace with your main branch to get started.</p>
                <div>
                  <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" /> Create a new gym workspace
                  </Link>
                </div>
              </div>
            )}

          {((staffRoles && staffRoles.length > 0) ||
            (memberPortals && memberPortals.length > 0)) && (
            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Set up another gym workspace
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
