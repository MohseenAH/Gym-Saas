"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { acceptStaffInvitationAction } from "@/lib/actions/invitations";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, Loader2, ArrowRight } from "lucide-react";

interface Props {
  token: string;
  gymName: string;
  role: string;
  invitedEmail?: string;
}

export function StaffAcceptanceClient({
  token,
  gymName,
  role,
  invitedEmail,
}: Props) {
  void gymName;
  void role;
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(invitedEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Check if user already has a session
      let activeUser = (await supabase.auth.getUser()).data.user;

      if (!activeUser) {
        // Sign up with new credentials
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });

        if (signUpError) {
          throw new Error(signUpError.message);
        }

        activeUser = signUpData.user;

        // If session was not immediately attached, sign in with password to guarantee session cookies
        if (!signUpData.session) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            throw new Error(signInError.message);
          }
          activeUser = signInData.user;
        }
      }

      // Upsert profile directly so foreign key to public.profiles is guaranteed
      if (activeUser) {
        await supabase.from("profiles").upsert({
          id: activeUser.id,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        });
      }

      // Accept invitation
      const acceptResult = await acceptStaffInvitationAction(token);
      if (!acceptResult.success) {
        throw new Error(acceptResult.error || "Failed to accept invitation");
      }

      const gymId = (acceptResult as { data?: { gym_id?: string } }).data?.gym_id;
      if (gymId) {
        router.push(`/app/${gymId}/dashboard`);
      } else {
        router.push("/select-workspace");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200/70 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Your Full Name
        </label>
        <div className="relative">
          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Create Password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Accepting & Joining...
          </>
        ) : (
          <>
            Accept & Enter Workspace <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
