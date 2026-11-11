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

export interface NormalizedPhoneResult {
  isValid: boolean;
  phone: string;
  error?: string;
}

/**
 * Pure helper to validate and normalize Indian mobile phone numbers.
 * Strictly asserts standard Indian mobile format: exactly 10 digits starting with 6, 7, 8, or 9.
 *
 * Accepts:
 * - 10 digits: "9876543210"
 * - Spaced/Hyphenated: "98765 43210", "98765-43210", "(0) 98765 43210"
 * - International prefix: "+91 9876543210", "+919876543210", "919876543210"
 * - Trunk prefix: "09876543210"
 *
 * Rejects:
 * - Non-permitted characters: "98765abc4321", "98765@4321" (not silently stripped)
 * - Numbers starting with 0-5
 * - Numbers with length != 10 after valid prefix removal
 */
export function normalizeIndianPhone(rawPhone: unknown): NormalizedPhoneResult {
  if (typeof rawPhone !== "string" || !rawPhone.trim()) {
    return { isValid: false, phone: "", error: "Phone number is required" };
  }

  const trimmed = rawPhone.trim();

  // 1. Guard against non-permitted formatting characters.
  // Permitted formatting characters: digits 0-9, spaces, hyphens, dots, parentheses, and leading '+'
  if (/[^\d\s\-().+]/.test(trimmed)) {
    return {
      isValid: false,
      phone: "",
      error: "Phone number contains invalid characters (letters or special symbols)",
    };
  }

  // A '+' is only permitted as the very first character
  if (trimmed.includes("+") && !trimmed.startsWith("+")) {
    return {
      isValid: false,
      phone: "",
      error: "Invalid '+' sign position in phone number",
    };
  }

  // 2. Extract digits
  const digits = trimmed.replace(/\D/g, "");

  // 3. Normalize valid prefixes to standard 10-digit base
  let normalized = digits;
  if (digits.length === 12 && digits.startsWith("91")) {
    normalized = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    normalized = digits.slice(1);
  }

  // 4. Assert strict Indian mobile specification: 10 digits starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    if (normalized.length !== 10) {
      return {
        isValid: false,
        phone: "",
        error: `Phone number must be exactly 10 digits (got ${normalized.length})`,
      };
    }
    return {
      isValid: false,
      phone: "",
      error: "Indian mobile numbers must start with 6, 7, 8, or 9",
    };
  }

  return {
    isValid: true,
    phone: normalized,
  };
}

/**
 * RFC 4180 compliant CSV parser.
 * Handles quoted fields with embedded commas, escaped quotes (""), and newlines.
 * Returns an array of records where keys are the trimmed headers from the first row.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  if (!text || !text.trim()) return [];

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        // Ignore carriage return
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let r = 1; r < lines.length; r++) {
    const rowObj: Record<string, string> = {};
    const rowValues = lines[r];
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = rowValues[c] ?? "";
    }
    rows.push(rowObj);
  }

  return rows;
}

