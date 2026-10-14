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
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-xs font-medium text-red-700">
          {state.error}
        </div>
      )}

      {/* Gym Business Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Gym / Business Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            name="gymName"
            required
            placeholder="e.g. Iron Fitness Center"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Branch Name */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Initial Branch Name <span className="text-red-500">*</span>
          </label>
          <span className="text-[11px] text-slate-400">Default: Main Branch</span>
        </div>
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            name="branchName"
            required
            defaultValue="Main Branch"
            placeholder="e.g. Main Branch, Downtown, or Central"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Your members, attendance, and revenue records will be linked to this location.
        </p>
      </div>

      {/* Owner Full Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Owner / Manager Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            name="fullName"
            required
            defaultValue={initialName}
            placeholder="e.g. Mohseen Khan"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Contact Phone */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Contact Phone <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="tel"
            name="phone"
            required
            defaultValue={initialPhone}
            placeholder="e.g. +91 98765 43210"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Used for gym contact info, invoices, and direct WhatsApp receipts.
        </p>
      </div>

      {/* Pilot Code (Optional) */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Pilot Partner Invite Code <span className="text-slate-400 font-normal lowercase">(optional)</span>
        </label>
        <div className="relative">
          <Sparkles className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            name="pilotCode"
            placeholder="e.g. PILOT60 (60-day free pilot auto-active)"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm uppercase font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          All registered partner gyms receive 60 days of full Pro pilot access with zero lockouts.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
