"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { acceptMemberClaimAction } from "@/lib/actions/invitations";
import { useRouter } from "next/navigation";
import { Lock, Mail, Phone, Loader2, ArrowRight } from "lucide-react";

interface Props {
  token: string;
  memberName: string;
  memberPhone?: string;
  memberEmail?: string;
  gymId: string;
}

export function MemberClaimClient({
  token,
  memberName,
  memberPhone,
  memberEmail,
  gymId,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(memberEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      let activeUser = (await supabase.auth.getUser()).data.user;

      if (!activeUser) {
        // Sign up with member's chosen email and password
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: memberName,
              phone: memberPhone,
            },
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

      if (activeUser) {
        await supabase.from("profiles").upsert({
          id: activeUser.id,
          full_name: memberName,
          phone: memberPhone || null,
          updated_at: new Date().toISOString(),
        });
      }

      // Claim member profile
      const claimResult = await acceptMemberClaimAction(token);
      if (!claimResult.success) {
        throw new Error(claimResult.error || "Failed to claim member account");
      }

      router.push(`/portal/${gymId}/dashboard`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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

      {memberPhone && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Registered Phone
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              disabled
              value={memberPhone}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm cursor-not-allowed"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Your Email Address
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="youremail@example.com"
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Used to log in to your portal and receive receipts
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
          Create a Password
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
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Claiming Account...
          </>
        ) : (
          <>
            Claim Account & Enter Portal <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
