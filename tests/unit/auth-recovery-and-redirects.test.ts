import { describe, it, expect } from "vitest";
import { isSafeInternalRedirect } from "@/lib/auth/redirect";
import { z } from "zod";

describe("Authentication Reliability & Password Recovery Suite (Batch 1)", () => {
  // ==========================================================================
  // 1. Safe Internal Redirect Validation
  // ==========================================================================
  describe("isSafeInternalRedirect", () => {
    it("permits standard internal application routes", () => {
      expect(isSafeInternalRedirect("/reset-password")).toBe(true);
      expect(isSafeInternalRedirect("/select-workspace")).toBe(true);
      expect(isSafeInternalRedirect("/onboarding")).toBe(true);
      expect(isSafeInternalRedirect("/app/gym-01/dashboard")).toBe(true);
      expect(isSafeInternalRedirect("/portal/gym-01/dashboard")).toBe(true);
    });

    it("permits deep-linked invitation paths for staff and members", () => {
      expect(isSafeInternalRedirect("/invite/staff/sec_token_12345")).toBe(true);
      expect(isSafeInternalRedirect("/invite/member/claim_token_67890")).toBe(true);
    });

    it("permits valid internal paths with query parameters and hash anchors", () => {
      expect(isSafeInternalRedirect("/app/gym-01/attendance?date=2026-11-20")).toBe(true);
      expect(isSafeInternalRedirect("/portal/gym-01/dashboard?branch=main#schedule")).toBe(true);
      expect(isSafeInternalRedirect("/login?notice=password_updated")).toBe(true);
    });

    it("strictly rejects external absolute URLs", () => {
      expect(isSafeInternalRedirect("https://attacker.com")).toBe(false);
      expect(isSafeInternalRedirect("http://attacker.com/reset-password")).toBe(false);
      expect(isSafeInternalRedirect("https://gymapra.com.attacker.com")).toBe(false);
      expect(isSafeInternalRedirect("ftp://files.example.com")).toBe(false);
    });

    it("strictly rejects protocol-relative and scheme-relative URLs", () => {
      expect(isSafeInternalRedirect("//attacker.com")).toBe(false);
      expect(isSafeInternalRedirect("//attacker.com/reset-password")).toBe(false);
      expect(isSafeInternalRedirect("///attacker.com")).toBe(false);
    });

    it("strictly rejects backslash navigation and path-traversal tricks", () => {
      expect(isSafeInternalRedirect("/\\attacker.com")).toBe(false);
      expect(isSafeInternalRedirect("\\attacker.com")).toBe(false);
      expect(isSafeInternalRedirect("/app\\dashboard")).toBe(false);
      expect(isSafeInternalRedirect("/\\/attacker.com")).toBe(false);
    });

    it("strictly rejects executable or data URI schemes", () => {
      expect(isSafeInternalRedirect("javascript:alert(1)")).toBe(false);
      expect(isSafeInternalRedirect("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe(false);
      expect(isSafeInternalRedirect("mailto:owner@gymapra.com")).toBe(false);
      expect(isSafeInternalRedirect("tel:+919876543210")).toBe(false);
    });

    it("handles null, undefined, and non-string or empty inputs safely", () => {
      expect(isSafeInternalRedirect(null)).toBe(false);
      expect(isSafeInternalRedirect(undefined)).toBe(false);
      expect(isSafeInternalRedirect("")).toBe(false);
      expect(isSafeInternalRedirect("   ")).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Password Recovery Email Request Validation
  // ==========================================================================
  describe("Password Recovery Request Validation", () => {
    const forgotPasswordSchema = z.object({
      email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    });

    it("accepts valid email addresses for password reset", () => {
      const valid = forgotPasswordSchema.safeParse({ email: "owner@ironforge.com" });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe("owner@ironforge.com");
      }
    });

    it("normalizes email case and trims surrounding whitespace", () => {
      const valid = forgotPasswordSchema.safeParse({ email: "   OWNER@IronForge.com   " });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe("owner@ironforge.com");
      }
    });

    it("rejects malformed email formats", () => {
      const invalidEmails = ["not-an-email", "@domain.com", "user@", "user@.com", ""];
      for (const bad of invalidEmails) {
        const result = forgotPasswordSchema.safeParse({ email: bad });
        expect(result.success).toBe(false);
      }
    });
  });

  // ==========================================================================
  // 3. Set New Password Form Validation
  // ==========================================================================
  describe("Set New Password Form Logic", () => {
    const resetPasswordSchema = z
      .object({
        password: z.string().min(6, "Password must be at least 6 characters long"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });

    it("accepts valid matching passwords of length >= 6", () => {
      const valid = resetPasswordSchema.safeParse({
        password: "NewSecurePassword123!",
        confirmPassword: "NewSecurePassword123!",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects password shorter than 6 characters", () => {
      const invalid = resetPasswordSchema.safeParse({
        password: "12345",
        confirmPassword: "12345",
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toContain("at least 6 characters");
      }
    });

    it("rejects mismatched confirm password", () => {
      const mismatched = resetPasswordSchema.safeParse({
        password: "SecurePassword123!",
        confirmPassword: "DifferentPassword456!",
      });
      expect(mismatched.success).toBe(false);
      if (!mismatched.success) {
        expect(mismatched.error.issues[0].message).toContain("do not match");
      }
    });
  });

  // ==========================================================================
  // 4. Callback Redirect Parameter Decision Matrix
  // ==========================================================================
  describe("Auth Callback Redirect Determination", () => {
    function resolveCallbackTargetPath(
      nextParam: string | null | undefined,
      resolvedDestination: string = "/app/gym-123/dashboard"
    ): string {
      const safePath = isSafeInternalRedirect(nextParam) ? nextParam.trim() : null;

      // When next is missing or points to generic hub, route to dynamic destination
      if (!safePath || safePath === "/" || safePath === "/select-workspace") {
        return resolvedDestination;
      }

      // Valid explicit deep links are preserved
      return safePath;
    }

    it("preserves password reset destination from email recovery flow", () => {
      const target = resolveCallbackTargetPath("/reset-password");
      expect(target).toBe("/reset-password");
    });

    it("preserves staff invitation destination", () => {
      const target = resolveCallbackTargetPath("/invite/staff/tok_abc");
      expect(target).toBe("/invite/staff/tok_abc");
    });

    it("preserves member portal claim destination", () => {
      const target = resolveCallbackTargetPath("/invite/member/tok_xyz");
      expect(target).toBe("/invite/member/tok_xyz");
    });

    it("neutralizes external attack in next param and routes safely to resolved destination", () => {
      const target = resolveCallbackTargetPath("https://malicious-site.com/steal-token");
      expect(target).toBe("/app/gym-123/dashboard");
    });

    it("neutralizes protocol-relative attack in next param", () => {
      const target = resolveCallbackTargetPath("//attacker.com/evil");
      expect(target).toBe("/app/gym-123/dashboard");
    });

    it("resolves dynamic destination when next is / or /select-workspace", () => {
      expect(resolveCallbackTargetPath("/")).toBe("/app/gym-123/dashboard");
      expect(resolveCallbackTargetPath("/select-workspace")).toBe("/app/gym-123/dashboard");
      expect(resolveCallbackTargetPath(null)).toBe("/app/gym-123/dashboard");
    });
  });
});
