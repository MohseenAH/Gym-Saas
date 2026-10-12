import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StaffRole } from "@/lib/auth/roles";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymId: string }>;
}

export default async function GymLayout({ children, params }: LayoutProps) {
  const { gymId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/app/${gymId}/dashboard`);
  }

  // Get gym details and verify account ownership
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, account_id, accounts(owner_id)")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) {
    redirect("/select-workspace");
  }

  const isAccountOwner = (gym.accounts as any)?.owner_id === user.id;
  let role: StaffRole = "staff";
  let hasAccess = isAccountOwner;

  if (isAccountOwner) {
    role = "owner";
  } else {
    // Verify staff membership in gym_users
    const { data: gymUser } = await supabase
      .from("gym_users")
      .select("role, status")
      .eq("gym_id", gymId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (gymUser && gymUser.status === "active") {
      role = gymUser.role as StaffRole;
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    redirect("/select-workspace");
  }

  // Get branches
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("gym_id", gymId)
    .eq("is_active", true);

  // Get profile name safely
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <AppShell
      gymId={gymId}
      gymName={gym?.name || "Gym Workspace"}
      role={role}
      branches={branches || []}
      userEmail={user.email || ""}
      userName={userName}
    >
      {children}
    </AppShell>
  );
}
