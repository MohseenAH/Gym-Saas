import { describe, it, expect } from "vitest";
import { getISTDateString, getTodayIST, formatDate } from "@/lib/utils";

describe("IST Timezone Normalization (Asia/Kolkata, UTC+5:30)", () => {
  it("formats dates in YYYY-MM-DD format", () => {
    const d = new Date("2026-05-15T10:00:00Z");
    const formatted = getISTDateString(d);
    expect(formatted).toBe("2026-05-15");
  });

  it("handles UTC evening rollover into the next day in IST (+5:30)", () => {
    // 20:00 UTC on May 15 is 01:30 AM on May 16 in IST
    const lateUtc = new Date("2026-05-15T20:00:00Z");
    expect(getISTDateString(lateUtc)).toBe("2026-05-16");
  });

  it("handles UTC pre-midnight hour that remains on same day in IST (+5:30)", () => {
    // 18:00 UTC on May 15 is 23:30 on May 15 in IST
    const eveningUtc = new Date("2026-05-15T18:00:00Z");
    expect(getISTDateString(eveningUtc)).toBe("2026-05-15");
  });

  it("handles UTC midnight (00:00:00Z) which is 05:30 AM same day in IST", () => {
    const midnightUtc = new Date("2026-05-15T00:00:00Z");
    expect(getISTDateString(midnightUtc)).toBe("2026-05-15");
  });

  it("accepts string date representations", () => {
    expect(getISTDateString("2026-11-01")).toBe("2026-11-01");
    expect(getISTDateString("2026-01-01T00:00:00.000Z")).toBe("2026-01-01");
  });

  it("returns empty string gracefully for invalid date inputs", () => {
    expect(getISTDateString("invalid-date")).toBe("");
  });

  it("returns today's date matching YYYY-MM-DD pattern via getTodayIST()", () => {
    const today = getTodayIST();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats dates in human-readable IST format via formatDate()", () => {
    const d = new Date("2026-05-15T20:00:00Z"); // May 16 in IST
    const formatted = formatDate(d);
    expect(formatted).toContain("16");
    expect(formatted).toContain("May");
    expect(formatted).toContain("2026");
  });
});
