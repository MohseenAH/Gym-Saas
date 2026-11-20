/**
 * Shared Reporting Utilities for GymApra V2
 * Pure calendar math in gym-local timezone (Asia/Kolkata), CSV export with UTF-8 BOM
 * and CSV formula-injection protection, safe period comparisons, and formatting.
 */

export type ReportPeriod = "today" | "weekly" | "monthly" | "last_month" | "all_time";

export interface PeriodDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  priorStartDate: string | null; // YYYY-MM-DD
  priorEndDate: string | null; // YYYY-MM-DD
  label: string;
  comparisonLabel: string;
}

/**
 * Returns gym-local date (default Asia/Kolkata) as YYYY-MM-DD.
 * Never uses .toISOString() on local midnight to prevent off-by-one shifts.
 */
export function getLocalTodayDateString(timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Computes deterministic date ranges for the 5 supported report periods.
 */
export function getPeriodDateRange(period: ReportPeriod, timeZone = "Asia/Kolkata"): PeriodDateRange {
  const todayStr = getLocalTodayDateString(timeZone);
  const [y, m, d] = todayStr.split("-").map(Number);

  if (period === "today") {
    const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1));
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
    return {
      startDate: todayStr,
      endDate: todayStr,
      priorStartDate: yesterdayStr,
      priorEndDate: yesterdayStr,
      label: "Today",
      comparisonLabel: "vs yesterday",
    };
  }

  if (period === "weekly") {
    const curUtc = new Date(Date.UTC(y, m - 1, d));
    const day = curUtc.getUTCDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const monUtc = new Date(Date.UTC(y, m - 1, d + diffToMon));
    const weekStartStr = monUtc.toISOString().slice(0, 10);

    const prevMonUtc = new Date(Date.UTC(y, m - 1, d + diffToMon - 7));
    const prevSunUtc = new Date(Date.UTC(y, m - 1, d + diffToMon - 1));
    const prevWeekStartStr = prevMonUtc.toISOString().slice(0, 10);
    const prevWeekEndStr = prevSunUtc.toISOString().slice(0, 10);

    return {
      startDate: weekStartStr,
      endDate: todayStr,
      priorStartDate: prevWeekStartStr,
      priorEndDate: prevWeekEndStr,
      label: "Weekly",
      comparisonLabel: "vs last week",
    };
  }

  if (period === "last_month") {
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const startStr = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
    const lastDayPrevMonth = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const endStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(lastDayPrevMonth).padStart(2, "0")}`;

    const twoM = prevM === 1 ? 12 : prevM - 1;
    const twoY = prevM === 1 ? prevY - 1 : prevY;
    const priorStartStr = `${twoY}-${String(twoM).padStart(2, "0")}-01`;
    const lastDayTwoMonth = new Date(Date.UTC(prevY, prevM - 1, 0)).getUTCDate();
    const priorEndStr = `${twoY}-${String(twoM).padStart(2, "0")}-${String(lastDayTwoMonth).padStart(2, "0")}`;

    return {
      startDate: startStr,
      endDate: endStr,
      priorStartDate: priorStartStr,
      priorEndDate: priorEndStr,
      label: "Last Month",
      comparisonLabel: "vs prior month",
    };
  }

  if (period === "all_time") {
    return {
      startDate: "2020-01-01",
      endDate: todayStr,
      priorStartDate: null,
      priorEndDate: null,
      label: "All Time",
      comparisonLabel: "",
    };
  }

  // Default: "monthly" (current month from day 1 to today)
  const monthStartStr = `${y}-${String(m).padStart(2, "0")}-01`;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const priorMonthStartStr = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
  const lastDayPrevMonth = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const priorMonthEndStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(lastDayPrevMonth).padStart(2, "0")}`;

  return {
    startDate: monthStartStr,
    endDate: todayStr,
    priorStartDate: priorMonthStartStr,
    priorEndDate: priorMonthEndStr,
    label: "Monthly",
    comparisonLabel: "vs last month",
  };
}

/**
 * Safe percentage comparison helper.
 * If prior is 0 or null, returns "—" or "New", never Infinity% or NaN%.
 */
export function computeSafeComparison(
  current: number,
  prior: number | null | undefined
): {
  diff: number;
  pct: number | null;
  label: string;
  isUp: boolean;
  isDown: boolean;
  isNeutral: boolean;
} {
  if (prior === null || prior === undefined) {
    return { diff: current, pct: null, label: "—", isUp: false, isDown: false, isNeutral: true };
  }
  if (prior === 0) {
    if (current === 0) {
      return { diff: 0, pct: 0, label: "0%", isUp: false, isDown: false, isNeutral: true };
    }
    return { diff: current, pct: null, label: "New", isUp: true, isDown: false, isNeutral: false };
  }

  const diff = current - prior;
  const pct = Math.round((diff / prior) * 100);
  return {
    diff,
    pct,
    label: `${diff >= 0 ? "+" : ""}${pct}%`,
    isUp: diff > 0,
    isDown: diff < 0,
    isNeutral: diff === 0,
  };
}

/**
 * Sanitizes CSV cell with formula-injection protection (RFC 4180 + security guard).
 * Prepends a single quote if string begins with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Downloads a CSV file in browser with UTF-8 BOM (\uFEFF) for Excel compatibility.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const csvContent = [
    headers.map(sanitizeCsvCell).join(","),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format currency in Indian Rupees.
 */
export function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Format date for reports display (e.g. 19 Nov 2026).
 */
export function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}
