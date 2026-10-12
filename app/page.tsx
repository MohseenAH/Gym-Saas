import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginRedirect } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { Dumbbell, ShieldCheck, ArrowRight, Zap, Users, CreditCard } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const destination = await resolvePostLoginRedirect();
    redirect(destination.path);
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="px-6 py-4 border-b border-slate-200/60 bg-white/70 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
            <Dumbbell className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            GymApra <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">v2</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            Start Free Trial <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" /> Built for High-Velocity Gym Operations
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-950 tracking-tight leading-tight max-w-3xl">
          Everything your gym needs, <span className="text-indigo-600">under 30 seconds</span> per task.
        </h1>

        <p className="mt-6 text-lg text-slate-600 max-w-2xl leading-relaxed">
          Streamlined walk-ins, phone-first member self-claim, instant 1-click WhatsApp receipts, and front-desk attendance without software lag.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link
            href="/signup"
            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-base border border-slate-200 shadow-sm transition-all flex items-center justify-center"
          >
            Sign in to Workspace
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 w-full text-left">
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="p-2.5 w-fit rounded-xl bg-emerald-50 text-emerald-600 mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Single-Sheet Checkout</h3>
            <p className="text-sm text-slate-600">
              Register a member, assign a plan, and log payment in a single 30-second form.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="p-2.5 w-fit rounded-xl bg-indigo-50 text-indigo-600 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Phone-First Claim</h3>
            <p className="text-sm text-slate-600">
              Invite members directly via WhatsApp without requiring email upfront. Zero lockouts.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="p-2.5 w-fit rounded-xl bg-purple-50 text-purple-600 mb-4">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Real-World Payments</h3>
            <p className="text-sm text-slate-600">
              Instant logging for Cash, UPI, and Card with automated WhatsApp receipts.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 border-t border-slate-200/60 text-center text-xs text-slate-500">
        GymApra V2 &bull; Modern Gym Operations OS &bull; Built on clean architecture
      </footer>
    </div>
  );
}
