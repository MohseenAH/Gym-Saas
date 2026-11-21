"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });

      if (resetError) {
        throw new Error(resetError.message);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send reset link";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      imageSrc="/images/auth-gym-kettlebells.jpg"
      imageAlt="Gym kettlebells equipment with deep navy tones"
      leftHeadline={"Need Help\nSigning In?"}
      leftSubheadline="Recover access to your gym workspace or member account securely."
      desktopTitle="Forgot your password?"
      desktopSubtitle="Enter your email address and we'll send you a recovery link."
      mobileHeadline="Forgot your password?"
      mobileSubheadline="Enter your email address and we'll send you a recovery link."
    >
      <div className="w-full">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 font-medium animate-in fade-in-50 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 flex items-start gap-3 animate-in fade-in-50">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">
                  Check your email
                </h3>
                <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                  If an account exists, you&apos;ll receive a password reset link shortly at{" "}
                  <span className="font-semibold text-emerald-950">{email}</span>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setEmail("");
              }}
              className="text-xs sm:text-sm text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-semibold block text-center w-full cursor-pointer pt-1"
            >
              Didn&apos;t receive it? Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@yourgym.com"
                  className="h-11 sm:h-11 w-full pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#94A3B8] text-[#10243E] placeholder-[#94A3B8] text-sm focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-normal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 sm:h-11 w-full mt-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-[#E2EAF5] text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#2563EB] hover:text-[#1D4ED8] font-bold hover:underline transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
