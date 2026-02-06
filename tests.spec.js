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
});
