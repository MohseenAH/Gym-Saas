"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordContent() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setUserEmail(user.email ?? null);
          setCheckingSession(false);
          return;
        }

        // Listen for session hydration event (e.g. PKCE or recovery token exchange in flight)
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY" || session?.user) {
              setSessionValid(true);
              setUserEmail(session?.user?.email ?? null);
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
    if (trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
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

  // 1. Initial Checking Session State
  if (checkingSession) {
    return (
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-10 text-card-foreground text-center space-y-4">
        <div className="p-3.5 bg-primary/10 text-primary rounded-2xl w-fit mx-auto animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          Verifying recovery link...
        </h2>
        <p className="text-xs text-muted-foreground">
          Confirming your security token with GymApra authentication.
        </p>
      </div>
    );
  }

  // 2. Success State
  if (success) {
    return (
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 text-card-foreground text-center space-y-4">
        <div className="p-3.5 bg-emerald-500/10 text-emerald-600 rounded-2xl w-fit mx-auto shadow-md shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Password Updated
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your password has been changed successfully. You will be redirected to the sign in page shortly.
        </p>
        <div className="pt-4">
          <Link
            href="/login?notice=password_updated"
            className="h-12 w-full rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Sign in now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // 3. Invalid or Expired Session State
  if (!sessionValid) {
    return (
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 text-card-foreground text-center space-y-4">
        <div className="p-3.5 bg-amber-500/10 text-amber-600 rounded-2xl w-fit mx-auto shadow-md shadow-amber-500/20">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Recovery Link Expired or Invalid
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          This password reset link is invalid, expired, or has already been used. For your security, password reset links are single-use and time-limited.
        </p>
        <div className="pt-4 space-y-2.5">
          <Link
            href="/forgot-password"
            className="h-12 w-full rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Request a new reset link
          </Link>
          <Link
            href="/login"
            className="h-11 w-full rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors flex items-center justify-center"
          >
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  // 4. Valid Session - Set New Password Form
  return (
    <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-8 sm:p-10 text-card-foreground">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-3.5 bg-primary text-primary-foreground rounded-2xl shadow-md shadow-primary/20 mb-3.5">
          <Dumbbell className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Set New Password
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {userEmail ? (
            <>
              Resetting credentials for{" "}
              <span className="font-semibold text-foreground">{userEmail}</span>
            </>
          ) : (
            "Create a new password for your account"
          )}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-600 font-medium animate-in fade-in-50">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            New Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="h-12 w-full pl-10 pr-11 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground transition-colors p-0.5"
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

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="h-12 w-full pl-10 pr-11 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground transition-colors p-0.5"
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

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full mt-3 rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        Remembered your credentials?{" "}
        <Link href="/login" className="text-primary hover:underline font-bold">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 transition-colors">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-xl p-10 flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
