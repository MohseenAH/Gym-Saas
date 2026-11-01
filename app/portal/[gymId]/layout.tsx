import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dumbbell, LogOut, Home, CalendarCheck, CreditCard, Bell } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

interface BranchRelation {
  gym_id: string;
  gyms: { name: string } | null;
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymId: string }>;
}

export default async function MemberPortalLayout({
  children,
  params,
}: LayoutProps) {
  const { gymId } = await params;
  const user = await getCachedUser();

  if (!user) {
    redirect(`/login?redirect=/portal/${gymId}/dashboard`);
  }

  const supabase = await createClient();

  // Verify member profile in this gym
  const { data: member, error } = await supabase
    .from("members")
    .select("id, full_name, branch_id, branches!inner(gym_id, gyms(name))")
    .eq("user_id", user.id)
    .eq("branches.gym_id", gymId)
    .eq("status", "active")
    .single();

  if (error || !member) {
    redirect("/select-workspace");
  }

  const branchData = member.branches as unknown as BranchRelation | null;
  const gymName = branchData?.gyms?.name || "Member Portal";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Top Header */}
      <header className="h-16 px-6 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-xs">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black text-foreground tracking-tight">
              {gymName}
            </div>
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
              Member Portal
            </div>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href={`/portal/${gymId}/dashboard`}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            Home
          </Link>
          <Link
            href={`/portal/${gymId}/attendance`}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            Attendance
          </Link>
          <Link
            href={`/portal/${gymId}/payments`}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            Payments & Dues
          </Link>
          <Link
            href={`/portal/${gymId}/notices`}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            Notices
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/select-workspace"
            className="text-xs text-muted-foreground hover:text-foreground hidden sm:block font-medium transition-colors"
          >
            Switch Gym
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24 sm:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-around z-40 px-2 transition-colors">
        <Link
          href={`/portal/${gymId}/dashboard`}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary active:text-primary text-[11px] font-bold transition-colors"
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>
        <Link
          href={`/portal/${gymId}/attendance`}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary active:text-primary text-[11px] font-bold transition-colors"
        >
          <CalendarCheck className="w-5 h-5" />
          <span>Check-in</span>
        </Link>
        <Link
          href={`/portal/${gymId}/payments`}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary active:text-primary text-[11px] font-bold transition-colors"
        >
          <CreditCard className="w-5 h-5" />
          <span>Payments</span>
        </Link>
        <Link
          href={`/portal/${gymId}/notices`}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary active:text-primary text-[11px] font-bold transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span>Notices</span>
        </Link>
      </nav>
    </div>
  );
}