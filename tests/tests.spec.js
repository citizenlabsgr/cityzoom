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

  test("can fill in the search form", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const searchInput = page.locator(".leaflet-control-geosearch input").first();
    await searchInput.waitFor({ state: "visible" });
    await searchInput.fill("Chicago");
    await expect(searchInput).toHaveValue("Chicago");
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
    const overlayPaths = page.locator(
      "#map1 .leaflet-overlay-pane path.leaflet-interactive"
    );
    await expect(overlayPaths.first()).toBeVisible();
    const paths = await overlayPaths.all();
    const segmentCounts = await Promise.all(
      paths.map((p) => p.getAttribute("d").then((d) => (d.match(/L/g) || []).length))
    );
    const maxSegments = Math.max(...segmentCounts);
    expect(maxSegments).toBeGreaterThanOrEqual(3);
  });

  test("clicking close to first point completes circuit and exits annotation mode", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await map1.click({ position: { x: 105, y: 150 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
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

  test("invalid points fragment shows toast and removes fragment", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.evaluate(() => {
      window.location.hash = "!";
    });
    await expect(page).not.toHaveURL(/\#/, { timeout: 5000 });
    await expect(page.locator("#toast")).toContainText("Invalid map annotations");
  });

  test("tagline and randomize button hidden on small screens", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#header");
    await expect(page.locator("#header h1")).toContainText("City Zoom");
    await expect(page.locator("#header .tagline-wrap")).toBeHidden();
    await expect(page.locator("#randomizeButton")).toBeHidden();
  });

  test("location button sets map to current position without changing zoom", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 42.35, longitude: -83.05 });
    await page.goto("/?zoom=11&lat1=42.33&lon1=-83.04&lat2=42.33&lon2=-83.04");
    await page.waitForSelector("#map1", { state: "attached" });
    const locationBtn = page.locator(".leaflet-control-location-btn").first();
    await expect(locationBtn).toBeVisible({ timeout: 5000 });
    await locationBtn.click();
    await expect(page).toHaveURL(/lat1=42\.3/, { timeout: 5000 });
    await expect(page).toHaveURL(/zoom=11/);
  });

  test("back button restores previous map view", async ({ page }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=42.5&lon2=-83");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.evaluate(() => {
      window.map1.setView([43, -84], 12);
    });
    await expect(page).toHaveURL(/lat1=43/);
    await page.goBack();
    await expect(page).toHaveURL(/lat1=42\.5/);
    await expect(page).toHaveURL(/zoom=12/);
  });

  test("randomize shows toast with example name after reload and clears fragment", async ({
    page,
  }) => {
    await page.goto("/#something");
    await page.waitForSelector("#randomizeButton", { state: "visible" });
    await Promise.all([
      page.waitForURL(/\?zoom=.+&lat1=/, { timeout: 10000 }),
      page.locator("#randomizeButton").click(),
    ]);
    await expect(page.locator("#toast.visible")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("#toast")).toContainText(" vs. ");
    await expect(page).not.toHaveURL(/#/);
  });
});

// Viewport sizes: small (mobile), medium (tablet), large (desktop)
const VIEWPORTS = [
  { name: "small", width: 375, height: 667 },
  { name: "medium", width: 768, height: 1024 },
  { name: "large", width: 1280, height: 720 },
];

test.describe("Visual snapshots", { tag: "@snapshot" }, () => {
  for (const { name, width, height } of VIEWPORTS) {
    test(`snapshot at ${name} viewport (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.waitForSelector("#map1", { state: "attached" });
      await expect(page).toHaveScreenshot(`home-${name}.png`, {
        fullPage: true,
      });
    });
  }
});
