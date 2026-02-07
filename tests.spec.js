import { test, expect } from "@playwright/test";

// Global setup to fail tests on console errors
const consoleErrors = new Map();

test.beforeEach(async ({ page }) => {
  const errors = [];

  // Listen for console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`Console error: ${msg.text()}`);
    }
  });

  // Listen for page errors (uncaught exceptions)
  page.on("pageerror", (error) => {
    errors.push(`Page error: ${error.message}${error.stack ? `\n${error.stack}` : ""}`);
  });

  // Store errors for this test
  consoleErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  // Check for console errors and fail the test if any exist
  const errors = consoleErrors.get(page) || [];
  if (errors.length > 0) {
    consoleErrors.delete(page);
    throw new Error(`Console/Page errors detected:\n${errors.join("\n")}`);
  }
  consoleErrors.delete(page);
});

test.describe("City Zoom", () => {
  test("should load the page and show the header", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#header");
    await expect(page.locator("#header h1")).toContainText("City Zoom");
  });

  test("should show the map", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    await expect(page.locator("#map1")).toBeVisible();
  });

  test("drawing persists after Escape", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.locator("#drawBox1").click();
    const map1 = page.locator("#map1");
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\#.+/);
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
  });

  test("second draw on same map preserves original line", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await page.keyboard.press("Escape");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 250, y: 100 } });
    await map1.click({ position: { x: 300, y: 220 } });
    await page.keyboard.press("Escape");
    const path = page.locator("#map1 path.leaflet-interactive").first();
    await expect(path).toBeVisible();
    const d = await path.getAttribute("d");
    const lineSegments = (d.match(/L/g) || []).length;
    expect(lineSegments).toBeGreaterThanOrEqual(3);
  });

  test("Copy URL resets to Copy URL when drawing fragment changes", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#copyButton");
    await page.evaluate(() => {
      const btn = document.getElementById("copyButton");
      btn.textContent = "Copied!";
      btn.classList.add("copied");
    });
    await expect(page.locator("#copyButton")).toHaveText("Copied!");
    await page.locator("#drawBox1").click();
    const map1 = page.locator("#map1");
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await page.keyboard.press("Escape");
    await expect(page.locator("#copyButton")).toHaveText("Copy URL");
  });
});
