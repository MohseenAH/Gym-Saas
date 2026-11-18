"use client";

import { useState, useEffect } from "react";

export function DashboardHeaderDate({
  dateStr,
  fallback = "Today",
}: {
  dateStr: string;
  fallback?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    setIsMounted(true);
    try {
      const d = new Date(dateStr + "T00:00:00+05:30");
      setFormatted(
        d.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
      );
    } catch {
      setFormatted(fallback);
    }
  }, [dateStr, fallback]);

  return (
    <span className="font-medium text-foreground" suppressHydrationWarning>
      {isMounted && formatted ? formatted : fallback}
    </span>
  );
}

export function CheckInTimeBadge({
  isoTime,
  fallback = "--:--",
}: {
  isoTime: string;
  fallback?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    setIsMounted(true);
    try {
      setFormatted(
        new Date(isoTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        })
      );
    } catch {
      setFormatted(fallback);
    }
  }, [isoTime, fallback]);

  return (
    <span
      className="text-[11px] sm:text-xs font-semibold text-muted-foreground tabular-nums"
      suppressHydrationWarning
    >
      {isMounted && formatted ? formatted : fallback}
    </span>
  );
}
