import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";
import { metadata, viewport } from "@/app/layout";
import fs from "fs";
import path from "path";

describe("PWA Manifest & Mobile Standalone Metadata Suite", () => {
  // ==========================================================================
  // 1. Web App Manifest Specifications
  // ==========================================================================
  describe("Web App Manifest (manifest.ts)", () => {
    const pwaManifest = manifest();

    it("declares standalone display mode for native app feel", () => {
      expect(pwaManifest.display).toBe("standalone");
      expect(pwaManifest.orientation).toBe("portrait");
    });

    it("has valid branding name and short_name", () => {
      expect(pwaManifest.name).toBe("GymApra — Gym Operating System");
      expect(pwaManifest.short_name).toBe("GymApra");
      expect(pwaManifest.description).toContain("gym management");
    });

    it("specifies valid start_url for session entry", () => {
      expect(pwaManifest.start_url).toBeDefined();
      expect(pwaManifest.start_url).toBe("/");
    });

    it("configures obsidian theme and background colors", () => {
      expect(pwaManifest.theme_color).toBe("#09090b");
      expect(pwaManifest.background_color).toBe("#09090b");
    });

    it("includes required 192x192 and 512x512 app icons with any and maskable purposes", () => {
      const icons = pwaManifest.icons || [];
      expect(icons.length).toBeGreaterThanOrEqual(2);

      const has192 = icons.some((i) => i.sizes === "192x192");
      const has512 = icons.some((i) => i.sizes === "512x512");
      expect(has192).toBe(true);
      expect(has512).toBe(true);

      const hasMaskable = icons.some((i) => i.purpose === "maskable");
      const hasAny = icons.some((i) => i.purpose === "any");
      expect(hasMaskable).toBe(true);
      expect(hasAny).toBe(true);

      icons.forEach((icon) => {
        expect(icon.src).toMatch(/^\/icon-\d+\.png$/);
        expect(icon.type).toBe("image/png");
      });
    });
  });

  // ==========================================================================
  // 2. Physical App Icon Assets Verification
  // ==========================================================================
  describe("Static App Icons in Public Assets", () => {
    it("verifies physical PNG files exist for all referenced manifest icons", () => {
      const pwaManifest = manifest();
      const icons = pwaManifest.icons || [];

      // Determine public directory path (tests run from root or v2/)
      const candidatePaths = [
        path.resolve(process.cwd(), "public"),
        path.resolve(process.cwd(), "v2/public"),
      ];
      const publicDir = candidatePaths.find((p) => fs.existsSync(p));
      expect(publicDir).toBeDefined();

      icons.forEach((icon) => {
        const filePath = path.join(publicDir!, icon.src.replace(/^\//, ""));
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // 3. Root Layout Mobile Viewport & Apple Standalone Metadata
  // ==========================================================================
  describe("Root Layout Mobile & Standalone Metadata (layout.tsx)", () => {
    it("exports viewport restricting pinch-zoom on mobile inputs", () => {
      expect(viewport).toBeDefined();
      expect(viewport.themeColor).toBe("#09090b");
      expect(viewport.width).toBe("device-width");
      expect(viewport.initialScale).toBe(1);
      expect(viewport.maximumScale).toBe(1);
    });

    it("configures iOS Safari appleWebApp standalone capability", () => {
      expect(metadata.appleWebApp).toBeDefined();
      const appleWebApp = metadata.appleWebApp as {
        capable: boolean;
        statusBarStyle: string;
        title: string;
      };
      expect(appleWebApp.capable).toBe(true);
      expect(appleWebApp.statusBarStyle).toBe("black-translucent");
      expect(appleWebApp.title).toBe("GymApra");
    });

    it("disables automatic telephone formatting to prevent blue link styling on numbers", () => {
      expect(metadata.formatDetection).toBeDefined();
      expect(metadata.formatDetection?.telephone).toBe(false);
    });
  });
});
