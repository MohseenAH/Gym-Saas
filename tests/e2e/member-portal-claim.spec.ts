import { test, expect } from "@playwright/test";
import { createTestOwnerFixture, createTestMemberFixture, generateRunId } from "../fixtures/run-id";

test.describe("Phase 2 E2E: Member Enrollment & Self-Service Portal Claim Flow", () => {
  test("TEST-P2-020/021/022/023: Owner enrolls member -> Member claims portal account -> Replay prevented", async ({
    page,
    browser,
  }) => {
    const runId = generateRunId();
    const owner = createTestOwnerFixture(runId);
    const member = createTestMemberFixture(runId);

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

    // 2. Owner navigates to Member Management
    await page.goto(`/app/${gymId}/members`);
    await expect(page.getByRole("heading", { name: /Member Management/i })).toBeVisible();

    // 3. Open Quick Enroll Modal
    await page.getByRole("button", { name: /Quick Enroll Member/i }).click();
    await expect(page.getByRole("heading", { name: /Quick Member Onboarding/i })).toBeVisible();

    // Fill member enrollment form
    await page.locator('input[placeholder="e.g. Rahul Sharma"]').fill(member.fullName);
    await page.locator('input[placeholder="e.g. 9876543210"]').fill(member.phone);
    await page.getByRole("button", { name: /Complete Registration/i }).click();

    // 4. Retrieve generated member portal invitation link
    await expect(page.getByText(/Member Enrolled Successfully!/i)).toBeVisible({ timeout: 30000 });
    const inviteInput = page.locator('input[readonly]');
    await expect(inviteInput).toBeVisible({ timeout: 30000 });
    const inviteUrl = await inviteInput.inputValue();
    expect(inviteUrl).toContain("/invite/member/");

    // 5. In an isolated member browser context, Member opens the portal claim link
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    await memberPage.goto(inviteUrl);

    // Verify Welcome and Member name
    await expect(memberPage.getByRole("heading", { name: new RegExp(`Welcome to ${owner.gymName}`, "i") })).toBeVisible({ timeout: 30000 });
    await expect(memberPage.getByText(new RegExp(`Hi ${member.fullName}!`, "i"))).toBeVisible();

    // Fill Member credentials
    await memberPage.locator('input[placeholder="youremail@example.com"]').fill(member.email);
    await memberPage.locator('input[placeholder="At least 6 characters"]').fill("MemberPass123!");

    // Submit claim
    await memberPage.getByRole("button", { name: /Claim Account & Enter Portal/i }).click();

    // 6. Verify Member is redirected to the Member Portal Dashboard
    await expect(memberPage).toHaveURL(new RegExp(`/portal/${gymId}/dashboard`), { timeout: 30000 });
    await expect(memberPage.getByRole("heading", { name: member.fullName })).toBeVisible();
    await expect(memberPage.getByText(/Active Member/i)).toBeVisible();
    await expect(memberPage.getByText(new RegExp(`${owner.gymName} Pass`, "i"))).toBeVisible();

    // 7. Replay Attack Verification: Re-opening the claimed link in a new context must fail
    const replayContext = await browser.newContext();
    const replayPage = await replayContext.newPage();

    await replayPage.goto(inviteUrl);
    await expect(replayPage.getByRole("heading", { name: /Invalid or Expired Link/i })).toBeVisible();
    await expect(replayPage.getByText(/already been claimed/i)).toBeVisible();

    // Clean up contexts
    await memberContext.close();
    await replayContext.close();
  });
});
