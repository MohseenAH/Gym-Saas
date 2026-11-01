"use client";

import { useActionState } from "react";
import { signupOwnerAction } from "@/lib/actions/auth";
import Link from "next/link";
import { Dumbbell, Lock, Mail, User, Building2, Phone, Loader2, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const result = await signupOwnerAction(formData);
      return result;
    },
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 transition-colors">
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 text-card-foreground">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 bg-primary text-primary-foreground rounded-2xl shadow-md shadow-primary/20 mb-3.5">
            <Dumbbell className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Create your Gym Workspace
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Single-step setup &bull; Start 14-day free trial
          </p>
        </div>

        {state?.error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-600 font-medium animate-in fade-in-50">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
              <input
                type="text"
                name="fullName"
                required
                placeholder="Mohseen Khan"
                className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Gym / Business Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
              <input
                type="text"
                name="gymName"
                required
                placeholder="Iron Forge Fitness"
                className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
              <input
                type="tel"
                inputMode="tel"
                name="phone"
                required
                placeholder="+91 98765 43210"
                className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
              <input
                type="email"
                name="email"
                required
                placeholder="owner@ironforge.com"
                className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
              <input
                type="password"
                name="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
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
                Setting up your workspace...
              </>
            ) : (
              "Complete Setup & Launch"
            )}
          </button>
        </form>

        <div className="mt-6 space-y-2.5 border-t border-border pt-4 text-xs">
          <div className="flex items-center gap-2 text-foreground/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>14-day full access trial included</span>
          </div>
          <div className="flex items-center gap-2 text-foreground/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Zero credit card required upfront</span>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary hover:underline font-bold"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
