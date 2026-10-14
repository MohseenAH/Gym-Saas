import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAppBaseUrl,
  buildInvitationLinks,
  PRODUCTION_APP_URL,
  DEFAULT_DEV_APP_URL,
} from "@/lib/auth/invitations";

describe("Production Invitation URL Resolution & Construction", () => {
  const originalEnv = process.env;

  function setNodeEnv(val: string | undefined) {
    if (val === undefined) {
      delete (process.env as Record<string, string | undefined>)["NODE_ENV"];
    } else {
      (process.env as Record<string, string | undefined>)["NODE_ENV"] = val;
    }
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ==========================================================================
  // 1. Base URL Resolution Tests
  // ==========================================================================
  describe("getAppBaseUrl", () => {
    it("returns configured production URL when NEXT_PUBLIC_APP_URL is set", () => {
      setNodeEnv("production");
      process.env.NEXT_PUBLIC_APP_URL = "https://gym-saas-v2.vercel.app";
      expect(getAppBaseUrl()).toBe("https://gym-saas-v2.vercel.app");
    });

    it("sanitizes trailing slashes from NEXT_PUBLIC_APP_URL", () => {
      setNodeEnv("production");
      process.env.NEXT_PUBLIC_APP_URL = "https://gym-saas-v2.vercel.app///";
      expect(getAppBaseUrl()).toBe("https://gym-saas-v2.vercel.app");
    });

    it("strictly falls back to canonical production URL in production if env is unset", () => {
      setNodeEnv("production");
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_ENV;
      expect(getAppBaseUrl()).toBe(PRODUCTION_APP_URL);
      expect(getAppBaseUrl()).toBe("https://gym-saas-v2.vercel.app");
    });

    it("strictly guards against generating localhost links in production if env is misconfigured with localhost", () => {
      setNodeEnv("production");
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
      // In production, localhost MUST be replaced with production URL
      expect(getAppBaseUrl()).toBe(PRODUCTION_APP_URL);
      expect(getAppBaseUrl()).toBe("https://gym-saas-v2.vercel.app");
    });

    it("strictly guards against 127.0.0.1 links in production", () => {
      setNodeEnv("production");
      process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
      expect(getAppBaseUrl()).toBe(PRODUCTION_APP_URL);
    });

    it("respects VERCEL_ENV=production when NODE_ENV is unset", () => {
      setNodeEnv(undefined);
      process.env.VERCEL_ENV = "production";
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getAppBaseUrl()).toBe(PRODUCTION_APP_URL);
    });

    it("defaults to localhost:3001 in development mode when unset", () => {
      setNodeEnv("development");
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_ENV;
      expect(getAppBaseUrl()).toBe(DEFAULT_DEV_APP_URL);
      expect(getAppBaseUrl()).toBe("http://localhost:3001");
    });

    it("preserves custom local dev URL in development mode", () => {
      setNodeEnv("development");
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4000";
      expect(getAppBaseUrl()).toBe("http://localhost:4000");
    });
  });

  // ==========================================================================
  // 2. Staff Invitation Link Construction Tests
  // ==========================================================================
  describe("buildInvitationLinks - Staff", () => {
    it("generates correct production staff invitation link without double slashes", () => {
      const rawToken = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
      const links = buildInvitationLinks({
        baseUrl: "https://gym-saas-v2.vercel.app/",
        type: "staff",
        rawToken,
        gymName: "Iron Dome Fitness",
        role: "manager",
        recipientPhone: "+91 98765 43210",
      });

      expect(links.inviteUrl).toBe(
        `https://gym-saas-v2.vercel.app/invite/staff/${rawToken}`
      );
      expect(links.inviteUrl).not.toContain("//invite");
      expect(links.whatsappUrl).toContain("https://wa.me/919876543210");
      expect(links.whatsappUrl).toContain(encodeURIComponent(links.inviteUrl));
      expect(links.messageText).toContain("manager");
      expect(links.messageText).toContain("Iron Dome Fitness");
    });

    it("uses getAppBaseUrl() when baseUrl parameter is omitted", () => {
      setNodeEnv("production");
      process.env.NEXT_PUBLIC_APP_URL = "https://gym-saas-v2.vercel.app";

      const rawToken = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
      const links = buildInvitationLinks({
        type: "staff",
        rawToken,
        gymName: "Apex Gym",
        role: "trainer",
      });

      expect(links.inviteUrl).toBe(
        `https://gym-saas-v2.vercel.app/invite/staff/${rawToken}`
      );
    });
  });

  // ==========================================================================
  // 3. Member Invitation Link Construction Tests
  // ==========================================================================
  describe("buildInvitationLinks - Member", () => {
    it("generates correct production member claim link", () => {
      const rawToken = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";
      const links = buildInvitationLinks({
        baseUrl: "https://gym-saas-v2.vercel.app",
        type: "member",
        rawToken,
        gymName: "FitZone Bangalore",
        recipientName: "Rahul Sharma",
        recipientPhone: "9876543210",
      });

      expect(links.inviteUrl).toBe(
        `https://gym-saas-v2.vercel.app/invite/member/${rawToken}`
      );
      expect(links.whatsappUrl).toContain("https://wa.me/9876543210");
      expect(links.messageText).toContain("Rahul Sharma");
      expect(links.messageText).toContain("FitZone Bangalore");
      expect(links.messageText).toContain("member portal");
    });
  });
});
