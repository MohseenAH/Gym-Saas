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
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs text-card-foreground">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-foreground">Expiring Memberships (Next 7 Days)</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
            0 Renewals Due
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          No subscriptions are expiring in the next 7 days. Member retention is steady! 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-2xl border border-amber-500/30 shadow-xs text-card-foreground">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Expiring Soon &bull; Action Required
            </h2>
            <p className="text-sm text-muted-foreground">
              Send instant WhatsApp reminders before contracts lapse
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
          {expiringMembers.length} Expiring in 7 Days
        </span>
      </div>

      <div className="divide-y divide-border">
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
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 rounded-xl px-2.5 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-sm border border-amber-500/20 shrink-0">
                  {m.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{m.fullName}</span>
                    <span className="text-xs text-muted-foreground font-medium">({m.branchName})</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{m.phone}</span>
                    <span>•</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {m.planName} (Expires {m.endDate})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  {m.daysLeft === 0 ? "Expires Today" : `${m.daysLeft}d left`}
                </span>
                <a
                  href={waReminderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Send WhatsApp Renewal Reminder"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <Link
                  href={`/app/${gymId}/members/${m.memberId}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-bold transition-colors"
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
