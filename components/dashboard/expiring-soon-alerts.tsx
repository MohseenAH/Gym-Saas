"use client";

import Link from "next/link";
import { MessageSquare, ArrowRight, Clock, Sparkles } from "lucide-react";

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
  isEmbedded?: boolean;
}

export function ExpiringSoonAlerts({
  gymId,
  gymName,
  expiringMembers,
}: ExpiringSoonAlertsProps) {
  if (expiringMembers.length === 0) {
    return (
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border border-t-2 border-t-emerald-500 shadow-xs text-card-foreground">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Expiring in 7 Days</h2>
              <p className="text-xs text-muted-foreground">Renewal Radar</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            0 Due
          </span>
        </div>
        <div className="py-4 text-center">
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            All memberships healthy — 0 expiring this week
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Retention is steady. Great job keeping members engaged!
          </p>
          <Link
            href={`/app/${gymId}/memberships?tab=active`}
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            <span>View All Active Memberships</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border border-t-2 border-t-amber-500 shadow-xs text-card-foreground">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/15 text-amber-600 rounded-xl">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Expiring in 7 Days</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send instant WhatsApp reminders before contracts lapse
            </p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
          {expiringMembers.length} Due
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
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 rounded-xl px-2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-sm border border-amber-500/20 shrink-0">
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
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                  {m.daysLeft === 0 ? "Today" : `${m.daysLeft}d left`}
                </span>
                <a
                  href={waReminderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Send WhatsApp Renewal Reminder"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <Link
                  href={`/app/${gymId}/members/${m.memberId}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-bold transition-colors"
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
