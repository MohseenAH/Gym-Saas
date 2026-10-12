import { test, expect } from "@playwright/test";

test.describe("Phase 1 E2E: Public Entry & Visitor Navigation", () => {
  test("TEST-P1-001: Anonymous visitor can view Landing page with public CTAs", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify Brand & Public CTAs
    await expect(page.getByText("GymApra").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Start Free Trial/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Log in/i })).toBeVisible();

    // Verify zero tenant data exposed
    await expect(page.locator("text=Total Revenue")).not.toBeVisible();
    await expect(page.locator("text=Check-In Kiosk")).not.toBeVisible();
  });

  test("Navigation from Landing to Login and Signup works cleanly", async ({ page }) => {
    await page.goto("/");

    // Click Log in
    await page.getByRole("link", { name: /Log in/i }).click();
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole("heading", { name: /Sign in to GymApra/i })).toBeVisible();

    // Navigate to Signup from Login page
    await page.getByRole("link", { name: /Create an account/i }).click();
    await expect(page).toHaveURL(/.*signup/);
    await expect(page.getByRole("heading", { name: /Create your Gym Workspace/i })).toBeVisible();
  });

  test("TEST-P1-012: Signup form requires valid inputs and blocks submission when empty", async ({ page }) => {
    await page.goto("/signup");

    // Click submit without filling form
    const submitBtn = page.getByRole("button", { name: /Complete Setup & Launch/i });
    await submitBtn.click();

    // Required HTML5 / form validation prevents transition
    await expect(page).toHaveURL(/.*signup/);
  });
});
