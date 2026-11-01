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
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors text-foreground">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-foreground tracking-tight text-xl">
                GymApra
              </span>
              <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Setup
              </span>
            </div>
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

        <div className="bg-card py-8 px-6 sm:px-8 rounded-3xl border border-border shadow-xl text-card-foreground">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Create your Gym Workspace
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Logged in as <span className="font-semibold text-foreground">{user.email}</span>. Configure your gym and initial main branch below.
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
