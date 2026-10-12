import crypto from "crypto";

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function buildInvitationLinks(params: {
  baseUrl: string;
  type: "staff" | "member";
  rawToken: string;
  gymName: string;
  role?: string;
  recipientPhone?: string;
  recipientName?: string;
}) {
  const invitePath =
    params.type === "staff"
      ? `/invite/staff/${params.rawToken}`
      : `/invite/member/${params.rawToken}`;

  const fullUrl = `${params.baseUrl}${invitePath}`;

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
