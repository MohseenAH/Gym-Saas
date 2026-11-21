"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

function ResetPasswordContent() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Criteria matching UI mockup
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);

  useEffect(() => {
    const supabase = createClient();

    async function checkSession() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (user && !userError) {
          setSessionValid(true);
          setCheckingSession(false);
          return;
        }

        // Listen for session hydration event (e.g. PKCE or recovery token exchange in flight)
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY" || session?.user) {
              setSessionValid(true);
              setCheckingSession(false);
            }
          }
        );

        // If no user and no listener trigger within 1.5s, mark as invalid
        const timeout = setTimeout(() => {
          setCheckingSession((current) => {
            if (current) {
              setSessionValid(false);
              return false;
            }
            return current;
          });
        }, 1500);

        return () => {
          authListener.subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch {
        setSessionValid(false);
        setCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!hasNumber) {
      setError("Password must include at least one number.");
      return;
    }

    if (!hasUppercase) {
      setError("Password must include at least one uppercase letter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login?notice=password_updated");
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update password. Your reset link may have expired.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      imageSrc="/images/auth-gym-kettlebells.jpg"
      imageAlt="Gym kettlebells equipment with deep navy tones"
      leftHeadline={"Create a New\nPassword"}
      leftSubheadline="Set a secure password for your GymApra account."
      desktopTitle="Create a new password"
      desktopSubtitle="Set a secure password for your account to continue."
      mobileHeadline="Create a new password"
      mobileSubheadline="Set a secure password for your account."
    >
      <div className="w-full">
        {/* 1. Checking Session State */}
        {checkingSession && (
          <div className="py-8 text-center space-y-3">
            <div className="p-2.5 bg-blue-50 text-[#2563EB] rounded-xl w-fit mx-auto animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <h2 className="text-sm font-bold text-[#10243E]">
              Verifying recovery link...
            </h2>
            <p className="text-xs text-[#64748B]">
              Confirming security token with GymApra authentication.
            </p>
          </div>
        )}

        {/* 2. Success State */}
        {!checkingSession && success && (
          <div className="py-4 text-center space-y-3 animate-in fade-in-50">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-[#10243E] tracking-tight">
              Password Updated Successfully
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
              Your password has been changed. You will be redirected to the sign in page shortly.
            </p>
            <div className="pt-2">
              <Link
                href="/login?notice=password_updated"
                className="h-11 sm:h-11 w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Sign in now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* 3. Invalid or Expired Session State */}
        {!checkingSession && !success && !sessionValid && (
          <div className="py-3 text-center space-y-3 animate-in fade-in-50">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl w-fit mx-auto border border-amber-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-[#10243E] tracking-tight">
              Recovery Link Expired or Invalid
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              This password reset link is invalid, expired, or has already been used. For your security, reset links are single-use and time-limited.
            </p>
            <div className="pt-2 space-y-2">
              <Link
                href="/forgot-password"
                className="h-11 sm:h-11 w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Request a new reset link
              </Link>
              <Link
                href="/login"
                className="h-10 w-full rounded-xl border border-[#CBD5E1] hover:bg-slate-50 text-[#64748B] hover:text-[#10243E] font-medium text-xs transition-colors flex items-center justify-center"
              >
                Return to sign in
              </Link>
            </div>
          </div>
        )}

        {/* 4. Valid Session Form */}
        {!checkingSession && !success && sessionValid && (
          <>
            {error && (
              <div className="mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 font-medium animate-in fade-in-50 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
              {/* New Password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1 sm:mb-1.5"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 sm:top-3 pointer-events-none" />
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-11 sm:h-11 w-full pl-10 pr-10 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
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

              {/* Confirm New Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs sm:text-sm font-semibold text-[#10243E] mb-1 sm:mb-1.5"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5 sm:top-3 pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-11 sm:h-11 w-full pl-10 pr-10 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-2 h-7 w-7 flex items-center justify-center text-[#94A3B8] hover:text-[#10243E] rounded-lg transition-colors cursor-pointer"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Checklist */}
              <div className="py-2.5 px-3 rounded-xl bg-white border border-[#E2EAF5] space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      hasMinLength
                        ? "bg-emerald-100 text-emerald-600 font-bold"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span
                    className={
                      hasMinLength
                        ? "text-emerald-800 font-medium"
                        : "text-[#64748B]"
                    }
                  >
                    At least 8 characters
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      hasNumber
                        ? "bg-emerald-100 text-emerald-600 font-bold"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span
                    className={
                      hasNumber
                        ? "text-emerald-800 font-medium"
                        : "text-[#64748B]"
                    }
                  >
                    Include a number
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      hasUppercase
                        ? "bg-emerald-100 text-emerald-600 font-bold"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span
                    className={
                      hasUppercase
                        ? "text-emerald-800 font-medium"
                        : "text-[#64748B]"
                    }
                  >
                    Include an uppercase letter
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="h-11 sm:h-11 w-full mt-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#E2EAF5] text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#2563EB] hover:text-[#1D4ED8] font-bold hover:underline transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-white flex items-center justify-center p-4">
          <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
