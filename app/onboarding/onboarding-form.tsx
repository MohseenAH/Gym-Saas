"use client";

import { useActionState } from "react";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { Building2, MapPin, User, Phone, ArrowRight, Loader2, Sparkles } from "lucide-react";

interface OnboardingFormProps {
  initialName?: string;
  initialPhone?: string;
}

export default function OnboardingForm({
  initialName = "",
  initialPhone = "",
}: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const result = await completeOnboardingAction(formData);
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 animate-in fade-in-50">
          {state.error}
        </div>
      )}

      {/* Gym Business Name */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Gym / Business Name <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Building2 className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
          <input
            type="text"
            name="gymName"
            required
            placeholder="e.g. Iron Fitness Center"
            className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
          />
        </div>
      </div>

      {/* Main Branch Name */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Initial Branch Name <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-muted-foreground/80">Default: Main Branch</span>
        </div>
        <div className="relative">
          <MapPin className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
          <input
            type="text"
            name="branchName"
            required
            defaultValue="Main Branch"
            placeholder="e.g. Main Branch, Downtown, or Central"
            className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Your members, attendance, and revenue records will be linked to this location.
        </p>
      </div>

      {/* Owner Full Name */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Owner / Manager Name <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
          <input
            type="text"
            name="fullName"
            required
            defaultValue={initialName}
            placeholder="e.g. Mohseen Khan"
            className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
          />
        </div>
      </div>

      {/* Contact Phone */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Contact Phone <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
          <input
            type="tel"
            inputMode="tel"
            name="phone"
            required
            defaultValue={initialPhone}
            placeholder="e.g. +91 98765 43210"
            className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Used for gym contact info, invoices, and direct WhatsApp receipts.
        </p>
      </div>

      {/* Pilot Code (Optional) */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Pilot Partner Invite Code <span className="text-muted-foreground/70 font-normal lowercase">(optional)</span>
        </label>
        <div className="relative">
          <Sparkles className="w-4 h-4 text-primary absolute left-3.5 top-4 pointer-events-none" />
          <input
            type="text"
            name="pilotCode"
            placeholder="e.g. PILOT60 (60-day free pilot auto-active)"
            className="h-12 w-full pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm uppercase font-mono focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          All registered partner gyms receive 60 days of full Pro pilot access with zero lockouts.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="h-12 w-full flex items-center justify-center gap-2 px-4 rounded-xl bg-primary hover:opacity-95 active:scale-[0.99] text-primary-foreground text-sm font-bold shadow-md shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating your workspace...</span>
            </>
          ) : (
            <>
              <span>Complete Setup & Launch Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
