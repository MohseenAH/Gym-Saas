import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthorizedActionContext, AuthorizationError } from "@/lib/auth/guard";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymId: string }>;
}

export default async function GymLayout({ children, params }: LayoutProps) {
  const { gymId } = await params;

  // 1. Check user authentication
  const user = await getCachedUser();
  if (!user) {
    redirect(`/login?redirect=/app/${gymId}/dashboard`);
  }

  // 2. Resolve cached gym authorization (shared across layout and child page via React cache())
  let authContext;
  try {
    authContext = await getAuthorizedActionContext({ gymId });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      redirect("/select-workspace");
    }
    throw err;
  }

  const supabase = await createClient();

  // 3. Parallel fetch gym name, branches, and user profile
  const [gymRes, branchesRes, profileRes] = await Promise.all([
    supabase.from("gyms").select("id, name").eq("id", gymId).maybeSingle(),
    supabase.from("branches").select("id, name").eq("gym_id", gymId).eq("is_active", true),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  const gym = gymRes.data;
  if (!gym) {
    redirect("/select-workspace");
  }

  const branches = branchesRes.data || [];
  const profile = profileRes.data;
  const userName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <AppShell
      gymId={gymId}
      gymName={gym.name || "Gym Workspace"}
      role={authContext.role}
      branches={branches}
      userEmail={user.email || ""}
      userName={userName}
    >
      {children}
    </AppShell>
  );
}
