import { describe, it, expect } from "vitest";
import {
  APP_TIMEZONE,
  APP_LOCALE,
  APP_TIMEZONE_CITY,
  APP_TIMEZONE_LABEL,
  APP_TIMEZONE_FULL_LABEL,
} from "@/lib/config/timezone";
import { getLocalTodayDateString, getPeriodDateRange } from "@/lib/reports/report-utils";

describe("Mumbai Time Zone Display & Internal Asia/Kolkata Standardization", () => {
  it("retains valid Asia/Kolkata IANA identifier and en-IN locale", () => {
    expect(APP_TIMEZONE).toBe("Asia/Kolkata");
    expect(APP_TIMEZONE).not.toBe("Asia/Mumbai");
    expect(APP_LOCALE).toBe("en-IN");
  });

  it("exposes standardized Mumbai display labels", () => {
    expect(APP_TIMEZONE_CITY).toBe("Mumbai");
    expect(APP_TIMEZONE_LABEL).toBe("Mumbai (IST)");
    expect(APP_TIMEZONE_FULL_LABEL).toBe("Mumbai — Indian Standard Time (UTC+05:30)");
  });

  it("produces valid YYYY-MM-DD business dates using default APP_TIMEZONE", () => {
    const today = getLocalTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const range = getPeriodDateRange("today");
    expect(range.startDate).toBe(today);
    expect(range.endDate).toBe(today);
  });
});
