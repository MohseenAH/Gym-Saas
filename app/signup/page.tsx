"use client";

import { useActionState, useState } from "react";
import { signupOwnerAction } from "@/lib/actions/auth";
import Link from "next/link";
import {
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const result = await signupOwnerAction(formData);
      return result;
    },
    null
  );

  return (
    <AuthSplitLayout
      imageSrc="/images/auth-gym-dumbbells.jpg"
      imageAlt="Gym dumbbells rack with cool lighting"
      leftHeadline={"Create Your Gym\nin Minutes."}
      leftSubheadline={"Start your 14-day free trial.\nNo credit card required."}
      desktopTitle="Create your gym workspace"
      desktopSubtitle="Single-step setup • Start your 14-day free trial"
      mobileHeadline={"Create Your Gym\nin Minutes."}
      mobileSubheadline={"Start your 14-day free trial.\nNo credit card required."}
    >
      <div className="w-full">
        {state?.error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 font-medium animate-in fade-in-50 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{state.error}</span>
          </div>
        )}

        <form action={formAction} className="space-y-2.5 sm:space-y-3">
          {/* Full Name */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1"
            >
              Full name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
              <input
                id="fullName"
                type="text"
                name="fullName"
                required
                autoComplete="name"
                placeholder="Enter your full name"
                className="h-10.5 sm:h-11 w-full pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
              />
            </div>
          </div>

          {/* Gym Name */}
          <div>
            <label
              htmlFor="gymName"
              className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1"
            >
              Gym or business name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
              <input
                id="gymName"
                type="text"
                name="gymName"
                required
                autoComplete="organization"
                placeholder="Enter gym name"
                className="h-10.5 sm:h-11 w-full pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
              />
            </div>
          </div>

          {/* Phone Number with +91 Indian Prefix */}
          <div>
            <label
              htmlFor="phone"
              className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1"
            >
              Phone number
            </label>
            <div className="relative flex rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/15 transition-all overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 bg-slate-50 border-r border-[#CBD5E1] text-xs sm:text-sm font-semibold text-[#10243E] select-none shrink-0">
                <span className="text-sm">🇮🇳</span>
                <span>+91</span>
              </div>
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 sm:top-3.5 pointer-events-none" />
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  name="phone"
                  required
                  autoComplete="tel"
                  placeholder="98765 43210"
                  className="h-10.5 sm:h-11 w-full pl-9.5 pr-4 bg-transparent text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden font-normal"
                />
              </div>
            </div>
          </div>

          {/* Work Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1"
            >
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="owner@yourgym.com"
                className="h-10.5 sm:h-11 w-full pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 sm:top-3.5 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="h-10.5 sm:h-11 w-full pl-10 pr-10 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 h-7 w-7 flex items-center justify-center text-[#94A3B8] hover:text-[#10243E] rounded-lg transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="h-11 sm:h-11 w-full mt-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up workspace...
              </>
            ) : (
              "Create My Gym"
            )}
          </button>
        </form>

        {/* Benefits reminder */}
        <div className="mt-3.5 pt-2.5 border-t border-[#E2EAF5] flex items-center justify-between text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>No credit card required</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 text-center text-xs text-[#64748B]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-bold transition-colors ml-1"
          >
            Sign in
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
