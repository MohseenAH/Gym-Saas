import { test, expect } from "@playwright/test";
import { createTestOwnerFixture, generateRunId } from "../fixtures/run-id";

test.describe("Phase 1 E2E: Owner Signup & Workspace Provisioning", () => {
  test("TEST-P1-010: Complete single-step Owner signup and land on Command Center Dashboard", async ({ page }) => {
    const runId = generateRunId();
    const owner = createTestOwnerFixture(runId);

    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Create your Gym Workspace/i })).toBeVisible();

    // Fill the signup form
    await page.locator('input[name="fullName"]').fill(owner.fullName);
    await page.locator('input[name="gymName"]').fill(owner.gymName);
    await page.locator('input[name="phone"]').fill(owner.phone);
    await page.locator('input[name="email"]').fill(owner.email);
    await page.locator('input[name="password"]').fill(owner.password);

    // Submit form
    await page.getByRole("button", { name: /Complete Setup & Launch/i }).click();

    // Verify navigation to dashboard
    await expect(page).toHaveURL(/\/app\/[0-9a-fA-F-]+\/dashboard/, { timeout: 30000 });

    // Verify Dashboard Command Center elements
    await expect(page.getByRole("heading", { name: /Command Center & Financial P&L/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Check-In Kiosk/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Enroll Member/i })).toBeVisible();

    // Verify P&L and metrics cards render
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByText("Total Expenses")).toBeVisible();
    await expect(page.getByText("Net Cash Flow")).toBeVisible();
  });

  test("TEST-P1-011: Attempting to sign up with an existing email shows error message", async ({ page }) => {
    const runId = generateRunId();
    const owner = createTestOwnerFixture(runId);

    // First, register the owner
    await page.goto("/signup");
    await page.locator('input[name="fullName"]').fill(owner.fullName);
    await page.locator('input[name="gymName"]').fill(owner.gymName);
    await page.locator('input[name="phone"]').fill(owner.phone);
    await page.locator('input[name="email"]').fill(owner.email);
    await page.locator('input[name="password"]').fill(owner.password);
    await page.getByRole("button", { name: /Complete Setup & Launch/i }).click();
    await expect(page).toHaveURL(/\/app\/[0-9a-fA-F-]+\/dashboard/, { timeout: 30000 });

    // In a new browser context (or clear cookies), attempt signup with same email but different password
    const context = await page.context().browser()!.newContext();
    const newPage = await context.newPage();

    await newPage.goto("/signup");
    await newPage.locator('input[name="fullName"]').fill("Duplicate Attempter");
    await newPage.locator('input[name="gymName"]').fill("Duplicate Gym");
    await newPage.locator('input[name="phone"]').fill("+919876543299");
    await newPage.locator('input[name="email"]').fill(owner.email);
    await newPage.locator('input[name="password"]').fill("DifferentPass123!");
    await newPage.getByRole("button", { name: /Complete Setup & Launch/i }).click();

    // Should stay on signup or show duplicate error message
    // If it caught existing user with wrong password or already registered
    const errorBanner = newPage.locator(".bg-red-50");
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    const errorText = await errorBanner.textContent();
    expect(errorText?.length).toBeGreaterThan(0);

    await context.close();
  });
});
