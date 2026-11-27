/**
 * Centralized Time Zone & Regional Configuration for GymApra V2
 *
 * - Internal IANA identifier MUST remain "Asia/Kolkata" (never "Asia/Mumbai").
 * - User-facing display uses Mumbai (IST).
 * - Stored database timestamps remain in UTC; business-day math uses APP_TIMEZONE.
 */

export const APP_TIMEZONE = "Asia/Kolkata" as const;
export const APP_LOCALE = "en-IN" as const;
export const APP_TIMEZONE_CITY = "Mumbai" as const;
export const APP_TIMEZONE_LABEL = "Mumbai (IST)" as const;
export const APP_TIMEZONE_FULL_LABEL =
  "Mumbai — Indian Standard Time (UTC+05:30)" as const;
