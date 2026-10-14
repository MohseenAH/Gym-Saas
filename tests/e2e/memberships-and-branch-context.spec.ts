import { test, expect } from "@playwright/test";
import { createTestOwnerFixture, generateRunId } from "../fixtures/run-id";

test.describe("Navigation, Branch Context & Memberships Page E2E", () => {
  test("TEST-MBR-001: Owner can navigate to Memberships page, view grouped sidebar, and access branch context", async ({
    page,
  }) => {
    const runId = generateRunId();
    const owner = createTestOwnerFixture(runId);

    // 1. Sign up owner and provision workspace
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

    // 2. Verify Grouped Sidebar navigation items exist
    await expect(page.getByText("Overview", { exact: true })).toBeVisible();
    await expect(page.getByText("Gym Operations", { exact: true })).toBeVisible();
    await expect(page.getByText("Finance & Insights", { exact: true })).toBeVisible();
    await expect(page.getByText("Gym Management", { exact: true })).toBeVisible();

    // 3. Navigate to the new Memberships Page via sidebar
    const membershipsLink = page.getByRole("link", { name: "Memberships" });
    await expect(membershipsLink).toBeVisible();
    await membershipsLink.click();

    await expect(page).toHaveURL(new RegExp(`/app/${gymId}/memberships`));
    await expect(page.getByRole("heading", { name: /Membership Contracts & Plans/i })).toBeVisible();

    // 4. Verify Memberships KPI summary cards render
    await expect(page.getByText("Active Contracts")).toBeVisible();
    await expect(page.getByText("Expiring (7 Days)")).toBeVisible();
    await expect(page.getByText("Expired", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending Balances")).toBeVisible();

    // 5. Verify User Profile Dropdown in Top Navbar
    const profileButton = page.getByRole("button", { name: /User account menu/i });
    await expect(profileButton).toBeVisible();
    await profileButton.click();

    // Check dropdown content
    await expect(page.getByRole("menuitem", { name: /Account & Settings/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Switch Workspace/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Sign out/i })).toBeVisible();

    // Close menu with Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: /Account & Settings/i })).not.toBeVisible();

    // 6. Test Membership Plans Tab & Plan Management
    const plansTabButton = page.getByRole("button", { name: /Membership Plans/i });
    await expect(plansTabButton).toBeVisible();
    await plansTabButton.click();

    // Verify Plans KPI summary metrics render
    await expect(page.getByText("Total Plans", { exact: true })).toBeVisible();
    await expect(page.getByText("Active Plans", { exact: true })).toBeVisible();
    await expect(page.getByText("Active Subscribers", { exact: true })).toBeVisible();

    // 7. Create a new membership plan via modal
    const createPlanBtn = page.getByRole("button", { name: /Create Plan/i }).first();
    await expect(createPlanBtn).toBeVisible();
    await createPlanBtn.click();

    await expect(page.getByRole("heading", { name: /Create Membership Plan/i })).toBeVisible();
    await page.locator('input[placeholder*="Monthly Standard"]').fill(`Gold Annual Pass ${runId}`);
    await page.locator('input[placeholder="0.00"]').fill("12000");
    await page.getByRole("button", { name: /1 Year/i }).click();

    await page.getByRole("button", { name: "Create Plan", exact: true }).click();

    // Verify success banner and new plan card appear
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Gold Annual Pass ${runId}`)).toBeVisible();
    await expect(page.getByText("₹12,000")).toBeVisible();

    // 8. Switch back to Contracts Tab
    const contractsTabButton = page.getByRole("button", { name: /Contracts/i }).first();
    await expect(contractsTabButton).toBeVisible();
    await contractsTabButton.click();
    await expect(page.getByText("Active Contracts")).toBeVisible();
  });
});
