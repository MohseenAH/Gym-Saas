import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, UserCircle, ArrowRight, LogOut, Plus } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

interface GymSummary {
  id: string;
  name: string;
  address?: string | null;
}

interface AccountWithGyms {
  id: string;
  gyms: GymSummary[] | GymSummary | null;
}

interface StaffRoleEntry {
  gym_id: string;
  role: string;
  gyms: GymSummary | null;
}

interface MemberPortalEntry {
  id: string;
  full_name: string;
  branch_id: string;
  branches: {
    id: string;
    name: string;
    gym_id: string;
    gyms: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export default async function SelectWorkspacePage() {
  const user = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

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
  const staffRolesMap = new Map<string, StaffRoleEntry>();

  // Add owned gyms first with role = 'owner'
  const accounts = (ownedAccounts || []) as unknown as AccountWithGyms[];
  accounts.forEach((acc) => {
    const gymsList = Array.isArray(acc.gyms) ? acc.gyms : acc.gyms ? [acc.gyms] : [];
    gymsList.forEach((g) => {
      staffRolesMap.set(g.id, {
        gym_id: g.id,
        role: "owner",
        gyms: g,
      });
    });
  });

  // Add any additional staff roles
  const staffItems = (rawStaffRoles || []) as unknown as StaffRoleEntry[];
  staffItems.forEach((item) => {
    if (!staffRolesMap.has(item.gym_id)) {
      staffRolesMap.set(item.gym_id, item);
    }
  });

  const staffRoles = Array.from(staffRolesMap.values());

  // Fetch member portals
  const { data: rawMemberPortals } = await supabase
    .from("members")
    .select("id, full_name, branch_id, branches ( id, name, gym_id, gyms ( id, name ) )")
    .eq("user_id", user.id)
    .eq("status", "active");

  const memberPortals = (rawMemberPortals || []) as unknown as MemberPortalEntry[];

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-lg bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 text-card-foreground">
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Select Workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Logged in as <span className="font-semibold text-foreground">{user.email}</span>
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-6">
          {/* Staff Workspaces */}
          {staffRoles && staffRoles.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Staff & Operations
              </h2>
              <div className="space-y-2.5">
                {staffRoles.map((item) => (
                  <Link
                    key={item.gym_id}
                    href={`/app/${item.gym_id}/dashboard`}
                    className="group flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-2xs">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-sm">
                          {item.gyms?.name || "Gym Workspace"}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          Role: {item.role}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Member Portals */}
          {memberPortals && memberPortals.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Member Portals
              </h2>
              <div className="space-y-2.5">
                {memberPortals.map((m) => {
                  const gymId = m.branches?.gym_id;
                  const gymName = m.branches?.gyms?.name || "Gym";
                  return (
                    <Link
                      key={m.id}
                      href={`/portal/${gymId}/dashboard`}
                      className="group flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all shadow-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
                          <UserCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-sm">
                            {gymName} Member Portal
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Branch: {m.branches?.name || "Main Branch"}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {(!staffRoles || staffRoles.length === 0) &&
            (!memberPortals || memberPortals.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p className="mb-1 text-foreground font-semibold">No active gym memberships found.</p>
                <p className="text-xs text-muted-foreground mb-5">Set up your gym workspace with your main branch to get started.</p>
                <div>
                  <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Create a new gym workspace
                  </Link>
                </div>
              </div>
            )}

          {((staffRoles && staffRoles.length > 0) ||
            (memberPortals && memberPortals.length > 0)) && (
            <div className="pt-4 border-t border-border flex justify-center">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline transition-colors"
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
