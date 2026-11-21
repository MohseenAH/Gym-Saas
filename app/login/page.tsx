"use client";

import { useActionState, Suspense, useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import Link from "next/link";
import { Lock, Mail, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "";
  const errorParam = searchParams.get("error");
  const noticeParam = searchParams.get("notice");
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const result = await loginAction(formData);
      return result;
    },
    null
  );

  const errorMessage = state?.error || errorParam;
  const noticeMessage =
    noticeParam === "password_updated"
      ? "Your password has been reset successfully. Please sign in with your new password."
      : null;

  return (
    <AuthSplitLayout
      imageSrc="/images/auth-gym-dumbbells.jpg"
      imageAlt="Gym dumbbells rack with cool lighting"
      leftHeadline={"Run Your Gym.\nSimplify Everything."}
      leftSubheadline="The complete operating system for fitness clubs, trainers, and gym owners."
      desktopTitle="Welcome back"
      desktopSubtitle="Sign in to your GymApra account to continue."
      mobileHeadline={"Run Your Gym.\nSimplify Everything."}
      mobileSubheadline="Sign in to your GymApra account."
    >
      <div className="w-full">
        {noticeMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 font-medium animate-in fade-in-50 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{noticeMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 font-medium animate-in fade-in-50 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        <form action={formAction} className="space-y-3 sm:space-y-3.5">
          {redirectParam && (
            <input type="hidden" name="redirect" value={redirectParam} />
          )}

          {/* Email field */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1 sm:mb-1.5"
            >
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 sm:top-3 pointer-events-none" />
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="owner@yourgym.com"
                className="h-11 sm:h-11 w-full pl-10 sm:pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <div className="flex items-center justify-between mb-1 sm:mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs sm:text-sm font-semibold text-[#10243E]"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 sm:top-3 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-11 sm:h-11 w-full pl-10 sm:pl-10 pr-10 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
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

            <div className="flex justify-end mt-1.5">
              <Link
                href="/forgot-password"
                className="text-xs text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isPending}
            className="h-11 sm:h-11 w-full mt-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
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

        <div className="mt-5 pt-4 border-t border-[#E2EAF5] text-center text-xs text-[#64748B]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-bold transition-colors ml-1"
          >
            Create account
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-white flex items-center justify-center p-4">
          <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
