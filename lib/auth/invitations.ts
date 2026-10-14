import crypto from "crypto";

export const PRODUCTION_APP_URL = "https://gym-saas-v2.vercel.app";
export const DEFAULT_DEV_APP_URL = "http://localhost:3001";

/**
 * Resolves the public base URL for invitations and external redirects.
 *
 * Rules:
 * 1. Uses `process.env.NEXT_PUBLIC_APP_URL` if defined.
 * 2. In production (`NODE_ENV === 'production'` or `VERCEL_ENV === 'production'`),
 *    strictly guards against generating `localhost` URLs by falling back to `PRODUCTION_APP_URL`.
 * 3. In development / testing, defaults to `DEFAULT_DEV_APP_URL` (http://localhost:3001).
 * 4. Always strips trailing slashes to guarantee clean path concatenation.
 */
export function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (envUrl) {
    if (isProduction && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      return PRODUCTION_APP_URL;
    }
    return envUrl.replace(/\/+$/, "");
  }

  if (isProduction) {
    return PRODUCTION_APP_URL;
  }

  return DEFAULT_DEV_APP_URL;
}

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function buildInvitationLinks(params: {
  baseUrl?: string;
  type: "staff" | "member";
  rawToken: string;
  gymName: string;
  role?: string;
  recipientPhone?: string;
  recipientName?: string;
}) {
  const cleanBase = (params.baseUrl?.trim() || getAppBaseUrl()).replace(/\/+$/, "");

  const invitePath =
    params.type === "staff"
      ? `/invite/staff/${params.rawToken}`
      : `/invite/member/${params.rawToken}`;

  const fullUrl = `${cleanBase}${invitePath}`;

  const messageText =
    params.type === "staff"
      ? `Hello! You have been invited to join ${params.gymName} as ${params.role || "Staff"}. Claim your account here: ${fullUrl}`
      : `Hello ${params.recipientName || ""}! Welcome to ${params.gymName}. Access your member portal, check-in history, and receipts here: ${fullUrl}`;

  // WhatsApp 1-click sharing link
  const cleanPhone = params.recipientPhone?.replace(/\D/g, "") || "";
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  // Gmail compose link
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
    `Invitation to ${params.gymName}`
  )}&body=${encodeURIComponent(messageText)}`;

  return {
    inviteUrl: fullUrl,
    whatsappUrl,
    gmailUrl,
    messageText,
  };
}
