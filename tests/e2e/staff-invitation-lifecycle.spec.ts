import { test, expect } from "@playwright/test";
import { createTestOwnerFixture, createTestStaffFixture, generateRunId } from "../fixtures/run-id";

test.describe("Phase 2 E2E: Staff Invitation Lifecycle & Claim Flow", () => {
  test("TEST-P2-001/010/011/012: Full invitation lifecycle (Owner creates invite -> Staff claims -> Replay prevented)", async ({
    page,
    browser,
  }) => {
    const runId = generateRunId();
    const owner = createTestOwnerFixture(runId);
    const staff = createTestStaffFixture(runId, "staff");

    // 1. Owner signs up and provisions gym
    await page.goto("/signup");
    await page.locator('input[name="fullName"]').fill(owner.fullName);
    await page.locator('input[name="gymName"]').fill(owner.gymName);
    await page.locator('input[name="phone"]').fill(owner.phone);
    await page.locator('input[name="email"]').fill(owner.email);
    await page.locator('input[name="password"]').fill(owner.password);
    await page.getByRole("button", { name: /Complete Setup & Launch/i }).click();

    await expect(page).toHaveURL(/\/app\/([0-9a-fA-F-]+)\/dashboard/, { timeout: 30000 });
    const match = page.url().match(/\/app\/([0-9a-fA-F-]+)\/dashboard/);
    expect(match).not.toBeNull();
    const gymId = match![1];

    // 2. Owner navigates to Staff Management
    await page.goto(`/app/${gymId}/staff`);
    await expect(page.getByRole("heading", { name: /Team & Staff Directory/i })).toBeVisible();

    // 3. Open Invite Staff Modal
    await page.getByRole("button", { name: /Invite Staff Member/i }).click();
    await expect(page.getByRole("heading", { name: /Invite Staff Member/i })).toBeVisible();

    // Fill modal form
    await page.locator('input[type="tel"]').fill(staff.phone);
    await page.locator('input[type="email"]').fill(staff.email);
    await page.getByRole("button", { name: /Generate Invitation Link/i }).click();

    // 4. Retrieve generated invitation link
    const inviteInput = page.locator('input[readonly]');
    await expect(inviteInput).toBeVisible({ timeout: 30000 });
    const inviteUrl = await inviteInput.inputValue();
    expect(inviteUrl).toContain("/invite/staff/");

    // 5. In a new isolated incognito browser context, Staff opens invitation link
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();

    await staffPage.goto(inviteUrl);

    // Verify invitation card details
    await expect(staffPage.getByRole("heading", { name: new RegExp(`Join ${owner.gymName}`, "i") })).toBeVisible({ timeout: 30000 });
    await expect(staffPage.getByText(/You've been invited to join as/i)).toBeVisible();

    // Fill claim form
    await staffPage.locator('input[placeholder="John Doe"]').fill(staff.fullName);
    // Email is already prefilled or can be confirmed
    await staffPage.locator('input[placeholder="At least 6 characters"]').fill(staff.password);

    // Submit claim
    await staffPage.getByRole("button", { name: /Accept & Enter Workspace/i }).click();

    // Verify Staff is redirected to the gym app dashboard
    await expect(staffPage).toHaveURL(new RegExp(`/app/${gymId}/dashboard`), { timeout: 30000 });
    await expect(staffPage.getByRole("heading", { name: /Command Center & Financial P&L/i })).toBeVisible();

    // 6. TEST-P2-012: Replay Attack Verification
    // Opening the same link again in another fresh context must be rejected
    const replayContext = await browser.newContext();
    const replayPage = await replayContext.newPage();

    await replayPage.goto(inviteUrl);

    await expect(replayPage.getByRole("heading", { name: /Invalid or Expired Invitation/i })).toBeVisible();
    await expect(replayPage.getByText(/already been used/i)).toBeVisible();

    // Clean up contexts
    await staffContext.close();
    await replayContext.close();
  });

  test("TEST-P2-014: Tampered invitation token displays invalid error", async ({ page }) => {
    await page.goto("/invite/staff/tampered_token_invalid_hash_xyz_9999");
    await expect(page.getByRole("heading", { name: /Invalid or Expired Invitation/i })).toBeVisible();
    await expect(page.getByText(/expired or has already been used/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Return to Login/i })).toBeVisible();
  });
});
