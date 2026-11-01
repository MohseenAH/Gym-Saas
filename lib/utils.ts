import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a date formatted in Indian Standard Time (Asia/Kolkata, UTC+5:30)
 * as YYYY-MM-DD for consistent database queries and display.
 */
export function getISTDateString(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns today's date in Indian Standard Time (Asia/Kolkata, UTC+5:30) as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  return getISTDateString(new Date());
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validates whether a member's contract satisfies active attendance requirements:
 * 1. Must exist
 * 2. status === 'active'
 * 3. end_date >= today (IST)
 */
export function isMembershipValidForAttendance(
  membership: { status?: string | null; end_date?: string | null } | null | undefined,
  todayIST: string = getTodayIST()
): { isValid: boolean; isExpired: boolean; reason?: string } {
  if (!membership || !membership.end_date) {
    return {
      isValid: false,
      isExpired: true,
      reason: "No active membership plan on record",
    };
  }

  if (membership.status !== "active") {
    return {
      isValid: false,
      isExpired: membership.status === "expired" || membership.status === "completed",
      reason: `Membership status is ${membership.status}`,
    };
  }

  if (membership.end_date < todayIST) {
    return {
      isValid: false,
      isExpired: true,
      reason: `Membership expired on ${membership.end_date}`,
    };
  }

  return { isValid: true, isExpired: false };
}

/**
 * Calculates updated pending dues after a payment is applied.
 * Invariant: Dues can never drop below 0.
 */
export function calculateRemainingDues(
  currentDues: number | null | undefined,
  paymentAmount: number
): number {
  const dues = Number(currentDues ?? 0);
  const amount = Number(paymentAmount ?? 0);
  return Math.max(0, Math.round((dues - amount) * 100) / 100);
}

/**
 * Validates whether a payment amount is acceptable against current outstanding dues.
 * Rejects payments strictly exceeding outstanding dues when dues are positive.
 */
export function validatePaymentAmountAgainstDues(
  currentDues: number | null | undefined,
  paymentAmount: number
): { isValid: boolean; error?: string } {
  if (paymentAmount <= 0) {
    return { isValid: false, error: "Payment amount must be greater than 0" };
  }
  const dues = Number(currentDues ?? 0);
  if (dues > 0 && paymentAmount > dues) {
    return {
      isValid: false,
      error: `Payment amount (₹${paymentAmount}) exceeds outstanding dues (₹${dues})`,
    };
  }
  return { isValid: true };
}

/**
 * Returns consistent Design System status badge CSS classes:
 * - Active / Paid: Soft emerald pill
 * - Expired: Soft rose pill
 * - Pending: Soft amber pill
 * - Inactive / Rejected: Soft slate pill
 */
export function getStatusBadgeClass(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "paid" || s === "present" || s === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 font-medium px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1";
  }
  if (s === "expired" || s === "absent" || s === "overdue") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 font-medium px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1";
  }
  if (s === "pending" || s === "expiring_soon" || s === "due" || s === "partial") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 font-medium px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1";
  }
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-500/20 font-medium px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1";
}

