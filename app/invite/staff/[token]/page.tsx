import { verifyInvitationTokenAction } from "@/lib/actions/invitations";
import { StaffAcceptanceClient } from "./client";
import { Dumbbell, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function StaffInvitePage({ params }: PageProps) {
  const { token } = await params;
  const verification = await verifyInvitationTokenAction(token);

  if (!verification || !verification.valid || verification.type !== "staff") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 p-8 text-center shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Invalid or Expired Invitation
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            This staff invitation link has expired or has already been used.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm mb-3">
            <Dumbbell className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Join {verification.gym_name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            You've been invited to join as <span className="capitalize font-semibold text-slate-700">{verification.role}</span>
          </p>
        </div>

        <StaffAcceptanceClient
          token={token}
          gymName={verification.gym_name}
          role={verification.role}
          invitedEmail={verification.email}
        />
      </div>
    </div>
  );
}
