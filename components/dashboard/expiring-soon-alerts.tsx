"use client";

import Link from "next/link";
import { Clock, MessageSquare, ArrowRight, AlertTriangle } from "lucide-react";

export interface ExpiringMember {
  memberId: string;
  fullName: string;
  phone: string;
  planName: string;
  endDate: string;
  daysLeft: number;
  branchName: string;
}

interface ExpiringSoonAlertsProps {
  gymId: string;
  gymName: string;
  expiringMembers: ExpiringMember[];
}

export function ExpiringSoonAlerts({
  gymId,
  gymName,
  expiringMembers,
}: ExpiringSoonAlertsProps) {
  if (expiringMembers.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Expiring Memberships (Next 7 Days)</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
            0 Renewals Due
          </span>
        </div>
        <p className="text-xs text-slate-400">
          No subscriptions are expiring in the next 7 days. Member retention is steady! 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-amber-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Expiring Soon &bull; Action Required
            </h2>
            <p className="text-[11px] text-slate-500">
              Send instant WhatsApp reminders before contracts lapse
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
          {expiringMembers.length} Expiring in 7 Days
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {expiringMembers.map((m) => {
          const cleanPhone = m.phone.replace(/\D/g, "");
          const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
          const waReminderUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
            `Hello ${m.fullName}! 💪\n` +
              `This is a friendly reminder from *${gymName}*.\n` +
              `Your *${m.planName}* membership is expiring in *${
                m.daysLeft === 0 ? "today" : `${m.daysLeft} days`
              }* (on ${m.endDate}).\n\n` +
              `Please renew today at the front desk to continue your workout streak without interruptions! 🏋️`
          )}`;

          return (
            <div
              key={m.memberId}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 rounded-xl px-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-xs border border-amber-200">
                  {m.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{m.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({m.branchName})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{m.phone}</span>
                    <span>•</span>
                    <span className="font-semibold text-amber-700">
                      {m.planName} (Expires {m.endDate})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                  {m.daysLeft === 0 ? "Expires Today" : `${m.daysLeft}d left`}
                </span>
                <a
                  href={waReminderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  title="Send WhatsApp Renewal Reminder"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <Link
                  href={`/app/${gymId}/members/${m.memberId}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  <span>360</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
