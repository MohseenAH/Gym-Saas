import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingForm from "./onboarding-form";
import { logoutAction } from "@/lib/actions/auth";
import { Dumbbell, LogOut } from "lucide-react";

export default async function OnboardingPage() {
  const user = await getCachedUser();

  if (!user) {
    redirect("/login?redirect=/onboarding");
  }

  const supabase = await createClient();

  // Preload profile if already saved
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const initialName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "";
  const initialPhone = profile?.phone || user.user_metadata?.phone || "";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-lg">
                GymOS
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                Setup
              </span>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </form>
        </div>

        <div className="bg-white py-8 px-6 sm:px-8 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Create your Gym Workspace
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Logged in as <span className="font-medium text-slate-700">{user.email}</span>. Configure your gym and initial main branch below.
            </p>
          </div>

          <OnboardingForm
            initialName={initialName}
            initialPhone={initialPhone}
          />
        </div>
      </div>
    </div>
  );
}
