import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Dumbbell, LogOut, User, Home, CalendarCheck, CreditCard, Bell } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymId: string }>;
}

export default async function MemberPortalLayout({
  children,
  params,
}: LayoutProps) {
  const { gymId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/portal/${gymId}/dashboard`);
  }

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

  const gymName = (member.branches as any)?.gyms?.name || "Member Portal";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="h-16 px-6 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 tracking-tight">
              {gymName}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
              Member Portal
            </div>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href={`/portal/${gymId}/dashboard`}
            className="text-xs font-semibold text-slate-700 hover:text-emerald-600 transition-colors"
          >
            Home
          </Link>
          <Link
            href={`/portal/${gymId}/attendance`}
            className="text-xs font-semibold text-slate-700 hover:text-emerald-600 transition-colors"
          >
            Attendance
          </Link>
          <Link
            href={`/portal/${gymId}/payments`}
            className="text-xs font-semibold text-slate-700 hover:text-emerald-600 transition-colors"
          >
            Payments & Dues
          </Link>
          <Link
            href={`/portal/${gymId}/notices`}
            className="text-xs font-semibold text-slate-700 hover:text-emerald-600 transition-colors"
          >
            Notices
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/select-workspace"
            className="text-xs text-slate-500 hover:text-slate-800 hidden sm:block"
          >
            Switch Gym
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-20 sm:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around z-40 px-2">
        <Link
          href={`/portal/${gymId}/dashboard`}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-emerald-600 text-[11px] font-medium"
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>
        <Link
          href={`/portal/${gymId}/attendance`}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-emerald-600 text-[11px] font-medium"
        >
          <CalendarCheck className="w-5 h-5" />
          <span>Check-in</span>
        </Link>
        <Link
          href={`/portal/${gymId}/payments`}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-emerald-600 text-[11px] font-medium"
        >
          <CreditCard className="w-5 h-5" />
          <span>Payments</span>
        </Link>
        <Link
          href={`/portal/${gymId}/notices`}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-emerald-600 text-[11px] font-medium"
        >
          <Bell className="w-5 h-5" />
          <span>Notices</span>
        </Link>
      </nav>
    </div>
  );
}
