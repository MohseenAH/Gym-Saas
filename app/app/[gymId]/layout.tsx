import { getCachedUser } from "@/lib/supabase/server";
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

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;

  const userName =
    authContext.profile?.full_name ||
    metadataName ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <AppShell
      gymId={gymId}
      gymName={authContext.gym.name || "Gym Workspace"}
      role={authContext.role}
      branches={authContext.branches}
      userEmail={user.email || ""}
      userName={userName}
    >
      {children}
    </AppShell>
  );
}
