import { test, expect } from "@playwright/test";
import { createTestOwnerFixture, createTestMemberFixture, generateRunId } from "../fixtures/run-id";

test.describe("Security E2E: Cross-Tenant Isolation & Role Boundary Protection", () => {
  test("TEST-SEC-001: Owner A cannot access Gym B dashboard and is redirected to workspace selector", async ({
    browser,
  }) => {
    const runIdA = generateRunId();
    const ownerA = createTestOwnerFixture(runIdA);

    const runIdB = generateRunId();
    const ownerB = createTestOwnerFixture(runIdB);

    // 1. Context A: Owner A creates Gym A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await pageA.goto("/signup");
    await pageA.locator('input[name="fullName"]').fill(ownerA.fullName);
    await pageA.locator('input[name="gymName"]').fill(ownerA.gymName);
    await pageA.locator('input[name="phone"]').fill(ownerA.phone);
    await pageA.locator('input[name="email"]').fill(ownerA.email);
    await pageA.locator('input[name="password"]').fill(ownerA.password);
    await pageA.getByRole("button", { name: /Complete Setup & Launch/i }).click();

    await expect(pageA).toHaveURL(/\/app\/([0-9a-fA-F-]+)\/dashboard/, { timeout: 30000 });
    const matchA = pageA.url().match(/\/app\/([0-9a-fA-F-]+)\/dashboard/);
    const gymIdA = matchA![1];

    // 2. Context B: Owner B creates Gym B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto("/signup");
    await pageB.locator('input[name="fullName"]').fill(ownerB.fullName);
    await pageB.locator('input[name="gymName"]').fill(ownerB.gymName);
    await pageB.locator('input[name="phone"]').fill(ownerB.phone);
    await pageB.locator('input[name="email"]').fill(ownerB.email);
    await pageB.locator('input[name="password"]').fill(ownerB.password);
    await pageB.getByRole("button", { name: /Complete Setup & Launch/i }).click();

    await expect(pageB).toHaveURL(/\/app\/([0-9a-fA-F-]+)\/dashboard/, { timeout: 30000 });
    const matchB = pageB.url().match(/\/app\/([0-9a-fA-F-]+)\/dashboard/);
    const gymIdB = matchB![1];
    expect(gymIdA).not.toBe(gymIdB);

    // 3. Attack Vector: Owner A attempts to force-navigate to Gym B's dashboard
    await pageA.goto(`/app/${gymIdB}/dashboard`);

    // Verify tenant boundary enforcement: Owner A is kicked out to /select-workspace
    await expect(pageA).toHaveURL(/\/select-workspace/, { timeout: 30000 });

    // Verify zero information leakage from Gym B
    await expect(pageA.getByText(ownerB.gymName)).not.toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test("TEST-SEC-005: Member cannot access staff Command Center and is redirected away", async ({
    page,
    browser,
  }) => {
    const runId = generateRunId();
    const owner = createTestOwnerFixture(runId);
    const member = createTestMemberFixture(runId);

    // 1. Owner sets up Gym
    await page.goto("/signup");
    await page.locator('input[name="fullName"]').fill(owner.fullName);
    await page.locator('input[name="gymName"]').fill(owner.gymName);
    await page.locator('input[name="phone"]').fill(owner.phone);
    await page.locator('input[name="email"]').fill(owner.email);
    await page.locator('input[name="password"]').fill(owner.password);
    await page.getByRole("button", { name: /Complete Setup & Launch/i }).click();

    await expect(page).toHaveURL(/\/app\/([0-9a-fA-F-]+)\/dashboard/, { timeout: 30000 });
    const match = page.url().match(/\/app\/([0-9a-fA-F-]+)\/dashboard/);
    const gymId = match![1];

    // 2. Owner enrolls member
    await page.goto(`/app/${gymId}/members`);
    await page.getByRole("button", { name: /Quick Enroll Member/i }).click();
    await expect(page.getByRole("heading", { name: /Quick Member Onboarding/i })).toBeVisible();

    await page.locator('input[placeholder="e.g. Rahul Sharma"]').fill(member.fullName);
    await page.locator('input[placeholder="e.g. 9876543210"]').fill(member.phone);
    await page.getByRole("button", { name: /Complete Registration/i }).click();

    await expect(page.getByText(/Member Enrolled Successfully!/i)).toBeVisible({ timeout: 30000 });
    const inviteUrl = await page.locator('input[readonly]').inputValue();

    // 3. Member claims account in member context
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    await memberPage.goto(inviteUrl);
    await memberPage.locator('input[placeholder="youremail@example.com"]').fill(member.email);
    await memberPage.locator('input[placeholder="At least 6 characters"]').fill("MemberPass123!");
    await memberPage.getByRole("button", { name: /Claim Account & Enter Portal/i }).click();

    await expect(memberPage).toHaveURL(new RegExp(`/portal/${gymId}/dashboard`), { timeout: 30000 });

    // 4. Attack Vector: Authenticated member attempts to access staff dashboard
    await memberPage.goto(`/app/${gymId}/dashboard`);

    // Gated layout must redirect non-staff member to /select-workspace
    await expect(memberPage).toHaveURL(/\/select-workspace/, { timeout: 30000 });

    await memberContext.close();
  });
});
