"use client";

import { useActionState, Suspense } from "react";
import { loginAction } from "@/lib/actions/auth";
import Link from "next/link";
import { Dumbbell, Lock, Mail, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "";
  const errorParam = searchParams.get("error");

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const result = await loginAction(formData);
      return result;
    },
    null
  );

  const errorMessage = state?.error || errorParam;

  return (
    <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 text-card-foreground">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-3.5 bg-primary text-primary-foreground rounded-2xl shadow-md shadow-primary/20 mb-3.5">
          <Dumbbell className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Sign in to GymApra
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Access your gym workspace or member portal
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-600 font-medium animate-in fade-in-50">
          {errorMessage}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {redirectParam && (
          <input type="hidden" name="redirect" value={redirectParam} />
        )}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
            <input
              type="email"
              name="email"
              required
              placeholder="owner@yourgym.com"
              className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline font-semibold"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="h-12 w-full mt-3 rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        New gym owner?{" "}
        <Link
          href="/signup"
          className="text-primary hover:underline font-bold"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 transition-colors">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-10 flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
