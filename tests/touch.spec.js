import { test, expect } from "@playwright/test";

const TOUCH_DRAW_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

async function stubTouchDrawDevice(page) {
  await page.addInitScript((query) => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (q) => {
      if (q === query) {
        return {
          matches: true,
          media: q,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return true;
          },
        };
      }
      return original(q);
    };
  }, TOUCH_DRAW_MEDIA_QUERY);
}

const consoleErrors = new Map();

test.beforeEach(async ({ page }) => {
  const errors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`Console error: ${msg.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    errors.push(`Page error: ${error.message}${error.stack ? `\n${error.stack}` : ""}`);
  });

  consoleErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  const errors = consoleErrors.get(page) || [];
  if (errors.length > 0) {
    consoleErrors.delete(page);
    throw new Error(`Console/Page errors detected:\n${errors.join("\n")}`);
  }
  consoleErrors.delete(page);
});

test.describe("Touch line drawing", () => {
  test("adds one point per tap and shows contextual toasts", async ({ page }) => {
    await stubTouchDrawDevice(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");

    await page.locator("#drawBox1").click();
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap the map to start drawing"
    );

    await map1.click({ position: { x: 100, y: 150 } });
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap to add the next point"
    );
    await expect(map1.locator(".leaflet-draw-pulse")).toBeVisible();

    await page.waitForTimeout(500);
    await map1.click({ position: { x: 220, y: 200 } });
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap to add the next point"
    );

    await page.waitForTimeout(500);
    await map1.click({ position: { x: 160, y: 280 } });
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap the first point to close the shape"
    );
    await expect(map1.locator(".leaflet-draw-pulse-close")).toBeVisible();
  });

  test("closing shape hides toast and exits draw mode", async ({ page }) => {
    await stubTouchDrawDevice(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");

    await page.locator("#drawBox1").click();
    const first = { x: 100, y: 150 };
    await map1.click({ position: first });
    await page.waitForTimeout(500);
    await map1.click({ position: { x: 200, y: 180 } });
    await page.waitForTimeout(500);
    await map1.click({ position: { x: 160, y: 280 } });
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap the first point to close the shape"
    );

    await page.waitForTimeout(500);
    await map1.click({ position: { x: 105, y: 150 } });
    await expect(page.locator("#toast.visible")).not.toBeVisible();
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
  });
});

test.describe("Touch circle drawing", () => {
  test("shows pulse at center after placing circle center", async ({ page }) => {
    await stubTouchDrawDevice(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");

    await page.locator("#circleBox1").click();
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap to place the circle center"
    );

    await map1.click({ position: { x: 150, y: 200 } });
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap to set the circle radius"
    );
    await expect(map1.locator(".leaflet-draw-pulse")).toBeVisible();
  });

  test("two taps place circle, dismiss toast, and exit draw mode", async ({ page }) => {
    await stubTouchDrawDevice(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");

    await page.locator("#circleBox1").click();
    await expect(page.locator("#wrapper1")).toHaveClass(/draw-mode/);
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap to place the circle center"
    );

    await map1.click({ position: { x: 150, y: 200 } });
    await expect(page.locator("#toast.visible")).toContainText(
      "Tap to set the circle radius"
    );
    await expect(map1.locator(".leaflet-draw-pulse")).toBeVisible();

    await page.waitForTimeout(500);
    await map1.click({ position: { x: 250, y: 200 } });
    await expect(page.locator("#toast.visible")).not.toBeVisible();
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
    await expect(map1.locator(".leaflet-draw-pulse")).not.toBeVisible();
  });
});
