import { chromium } from "file:///C:/Users/Arc/.gemini/antigravity/scratch/Gym-Saas/v2/node_modules/playwright/index.mjs";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMsgs = [];
  page.on("console", (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });
  page.on("pageerror", (err) => {
    console.log("[PAGE ERROR]:", err.message);
  });

  const runId = Math.random().toString(36).substring(2, 7);
  console.log("Navigating to signup on dev server...");
  await page.goto("http://localhost:3001/signup", { waitUntil: "networkidle" });
  await page.locator('input[name="fullName"]').fill("Mohsin Hawaldar");
  await page.locator('input[name="gymName"]').fill("Iron Fitness " + runId);
  await page.locator('input[name="phone"]').fill("98" + Math.floor(10000000 + Math.random() * 90000000));
  await page.locator('input[name="email"]').fill("mohsin_" + runId + "@gym.com");
  await page.locator('input[name="password"]').fill("Pass_12345!");
  await page.getByRole("button", { name: /Create My Gym/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  console.log("Landed on:", page.url());

  // Wait a bit for any hydration warnings
  await page.waitForTimeout(3000);

  // Now reload the page so we get a fresh full SSR page load with cookies attached!
  console.log("Reloading dashboard for fresh SSR request...");
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/dashboard") && res.status() === 200),
    page.reload({ waitUntil: "networkidle" }),
  ]);

  const ssrHtml = await response.text();
  console.log("SSR HTML length:", ssrHtml.length);

  await page.waitForTimeout(3000);

  console.log("--- All console messages during reload ---");
  consoleMsgs.forEach((m) => {
    if (m.type === "error" || m.type === "warning") {
      console.log(`[${m.type.toUpperCase()}] ${m.text}`);
    }
  });

  await browser.close();
}

run().catch(console.error);
