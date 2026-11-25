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

test.describe("Home page", () => {
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

  test("space key on top map does not cause layout shift or scroll", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const scrollBefore = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));
    await page.locator("#map1").click({ position: { x: 150, y: 150 } });
    await page.keyboard.press("Space");
    const scrollAfter = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));
    expect(scrollAfter.x).toBe(scrollBefore.x);
    expect(scrollAfter.y).toBe(scrollBefore.y);
  });

  test("map tap on mobile does not scroll controls under the header", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const layoutBefore = await page.evaluate(() => {
      const control = document.querySelector("#map1 .leaflet-top");
      const header = document.getElementById("header");
      const controlRect = control.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        controlTop: controlRect.top,
        headerBottom: headerRect.bottom,
      };
    });
    expect(layoutBefore.controlTop).toBeGreaterThanOrEqual(layoutBefore.headerBottom);
    await page.locator("#map1").click({ position: { x: 150, y: 200 } });
    await page.waitForTimeout(100);
    const layoutAfter = await page.evaluate(() => {
      const control = document.querySelector("#map1 .leaflet-top");
      const header = document.getElementById("header");
      const controlRect = control.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        controlTop: controlRect.top,
        headerBottom: headerRect.bottom,
      };
    });
    expect(layoutAfter.scrollY).toBe(layoutBefore.scrollY);
    expect(layoutAfter.controlTop).toBe(layoutBefore.controlTop);
    expect(layoutAfter.controlTop).toBeGreaterThanOrEqual(layoutAfter.headerBottom);
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

  test("tagline hidden on small screens, randomize button visible next to header", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForSelector("#header");
    await expect(page.locator("#header h1")).toContainText("City Zoom");
    await expect(page.locator("#header .tagline")).toBeHidden();
    await expect(page.locator("#randomizeButton")).toBeVisible();
  });

  test("location button centers map, resets bearing, and enforces a minimum zoom", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 42.35, longitude: -83.05 });
    await page.goto(
      "/?zoom=11&lat1=42.33&lon1=-83.04&lat2=42.33&lon2=-83.04&rot1=45&rot2=90"
    );
    await page.waitForSelector("#map1", { state: "attached" });
    const locationBtn = page.locator(".leaflet-control-location-btn").first();
    await expect(locationBtn).toBeVisible({ timeout: 5000 });
    await locationBtn.click();
    await expect(page).toHaveURL(/lat1=42\.3/, { timeout: 5000 });
    await expect(page).toHaveURL(/zoom=14/);
    await expect(page).not.toHaveURL(/rot1=/);
    await expect(page).toHaveURL(/rot2=90/);
    const state = await page.evaluate(() => ({
      map1Bearing: Math.round(window.map1.getBearing()),
      map2Bearing: Math.round(window.map2.getBearing()),
      zoom: window.map1.getZoom(),
    }));
    expect(state.map1Bearing).toBe(0);
    expect(state.map2Bearing).toBe(90);
    expect(state.zoom).toBe(14);
  });

  test("location button keeps a closer zoom when already zoomed in", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 42.35, longitude: -83.05 });
    await page.goto("/?zoom=17&lat1=42.33&lon1=-83.04&lat2=42.33&lon2=-83.04");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.locator(".leaflet-control-location-btn").first().click();
    await expect(page).toHaveURL(/lat1=42\.3/, { timeout: 5000 });
    await expect(page).toHaveURL(/zoom=17/);
  });

  test("basemap dropdown updates URL and layer", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const select1 = page.locator("#basemapSelect1");
    const select2 = page.locator("#basemapSelect2");
    await expect(select1).toHaveValue("osm");
    await expect(select2).toHaveValue("osm");
    await select1.selectOption("esri");
    await expect(page).toHaveURL(/sat1=true/);
    await select1.selectOption("osm");
    await expect(page).not.toHaveURL(/sat1=/);
    await select2.selectOption("esri");
    await expect(page).toHaveURL(/sat2=true/);
  });

  test("legacy satellite=1 URL selects Esri basemap", async ({ page }) => {
    await page.goto("/?satellite=1");
    await page.waitForSelector("#map1", { state: "attached" });
    await expect(page.locator("#basemapSelect1")).toHaveValue("esri");
    await expect(page.locator("#basemapSelect2")).toHaveValue("esri");
  });

  test("returns to last view when visiting without query params", async ({ page }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=41&lon2=-84&rot1=45&rot2=90");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.goto("/");
    await expect(page).toHaveURL(/lat1=42\.5/, { timeout: 5000 });
    await expect(page).toHaveURL(/lat2=41/);
    await expect(page).toHaveURL(/zoom=12/);
    await expect(page).toHaveURL(/rot1=45/);
    await expect(page).toHaveURL(/rot2=90/);
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

  test("rotates each map independently and stores bearings in the URL", async ({
    page,
  }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=42.5&lon2=-83");
    await page.waitForSelector("#map1", { state: "attached" });
    await expect(page.locator(".leaflet-control-rotate").first()).toBeVisible();
    await page.evaluate(() => {
      window.map1.setBearing(90);
      window.map2.setBearing(180);
    });
    await expect(page).toHaveURL(/rot1=90/, { timeout: 5000 });
    await expect(page).toHaveURL(/rot2=180/);
    const bearings = await page.evaluate(() => ({
      map1: Math.round(window.map1.getBearing()),
      map2: Math.round(window.map2.getBearing()),
    }));
    expect(bearings.map1).toBe(90);
    expect(bearings.map2).toBe(180);
  });

  test("loads and restores independent rotation from the URL", async ({ page }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=42.5&lon2=-83&rot1=30&rot2=60");
    await page.waitForSelector("#map1", { state: "attached" });
    const initial = await page.evaluate(() => ({
      map1: Math.round(window.map1.getBearing()),
      map2: Math.round(window.map2.getBearing()),
    }));
    expect(initial.map1).toBe(30);
    expect(initial.map2).toBe(60);
    await page.evaluate(() => {
      window.map1.setBearing(120);
    });
    await expect(page).toHaveURL(/rot1=120/, { timeout: 5000 });
    await expect(page).toHaveURL(/rot2=60/);
    await page.goBack();
    await expect(page).toHaveURL(/rot1=30/);
    await expect(page).toHaveURL(/rot2=60/);
    const restored = await page.evaluate(() => ({
      map1: Math.round(window.map1.getBearing()),
      map2: Math.round(window.map2.getBearing()),
    }));
    expect(restored.map1).toBe(30);
    expect(restored.map2).toBe(60);
  });

  test("omits rot params from the URL when bearings are north", async ({ page }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=42.5&lon2=-83&rot1=15&rot2=20");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.evaluate(() => {
      window.map1.setBearing(0);
      window.map2.setBearing(0);
    });
    await expect(page).toHaveURL(/lat1=42\.5/, { timeout: 5000 });
    await expect(page).not.toHaveURL(/rot1=/);
    await expect(page).not.toHaveURL(/rot2=/);
  });

  test("keeps zoom levels synced when one map zooms and updates the URL", async ({
    page,
  }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=42.5&lon2=-83&rot1=20&rot2=40");
    await page.waitForSelector("#map1", { state: "attached" });
    await page.evaluate(() => {
      window.map2.setZoom(14);
    });
    await expect(page).toHaveURL(/zoom=14/, { timeout: 5000 });
    const state = await page.evaluate(() => ({
      z1: window.map1.getZoom(),
      z2: window.map2.getZoom(),
      rot1: Math.round(window.map1.getBearing()),
      rot2: Math.round(window.map2.getBearing()),
      exclusive: !!(
        window.map1.touchGestures &&
        window.map1.touchGestures._exclusivePinchRotate &&
        window.map2.touchGestures &&
        window.map2.touchGestures._exclusivePinchRotate
      ),
    }));
    expect(state.z1).toBe(14);
    expect(state.z2).toBe(14);
    expect(state.rot1).toBe(20);
    expect(state.rot2).toBe(40);
    expect(state.exclusive).toBe(true);
    await expect(page).toHaveURL(/rot1=20/);
    await expect(page).toHaveURL(/rot2=40/);
  });

  test("touch gesture indicator highlights zoom or rotate controls", async ({
    page,
  }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=42.5&lon2=-83");
    await page.waitForSelector("#map1", { state: "attached" });
    const result = await page.evaluate(() => {
      const map = window.map1;
      const root = map.getContainer();
      const zoom = root.querySelector(".leaflet-control-zoom");
      const rotate = root.querySelector(".leaflet-control-rotate");
      const toggle = root.querySelector(".leaflet-control-rotate-toggle");
      root.classList.add("touch-gesture-rotate");
      rotate.classList.add("touch-gesture-active");
      toggle.classList.add("touch-gesture-active");
      const rotateBorder = getComputedStyle(rotate).borderColor;
      const toggleBg = getComputedStyle(toggle).backgroundColor;
      const toggleShadow = getComputedStyle(toggle).boxShadow;
      root.classList.remove("touch-gesture-rotate");
      rotate.classList.remove("touch-gesture-active");
      toggle.classList.remove("touch-gesture-active");
      root.classList.add("touch-gesture-zoom");
      zoom.classList.add("touch-gesture-active");
      const zoomBorder = getComputedStyle(zoom).borderColor;
      root.classList.remove("touch-gesture-zoom");
      zoom.classList.remove("touch-gesture-active");
      return {
        hasZoom: !!zoom,
        hasRotate: !!rotate,
        hasToggle: !!toggle,
        rotateBorder,
        zoomBorder,
        toggleBg,
        toggleShadow,
        exclusiveInstalled: !!(
          map.touchGestures && map.touchGestures._exclusivePinchRotate
        ),
        remaining: root.querySelectorAll(".touch-gesture-active").length,
      };
    });
    expect(result.hasZoom).toBe(true);
    expect(result.hasRotate).toBe(true);
    expect(result.hasToggle).toBe(true);
    expect(result.rotateBorder).toContain("0, 136, 255");
    expect(result.zoomBorder).toContain("0, 136, 255");
    expect(result.toggleBg).toContain("232, 244, 255");
    expect(result.toggleShadow).not.toBe("none");
    expect(result.exclusiveInstalled).toBe(true);
    expect(result.remaining).toBe(0);
  });

  test("randomize does not overwrite stored last view", async ({ page }) => {
    await page.goto("/?zoom=12&lat1=42.5&lon1=-83&lat2=41&lon2=-84");
    await page.waitForSelector("#map1", { state: "attached" });
    await Promise.all([
      page.waitForURL(/\?zoom=.+&lat1=/, { timeout: 10000 }),
      page.locator("#randomizeButton").click(),
    ]);
    await page.goto("/");
    await expect(page).toHaveURL(/lat1=42\.5/, { timeout: 5000 });
    await expect(page).toHaveURL(/lat2=41/);
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

  test("randomize loads a cityzoom.link example as a local URL", async ({ page }) => {
    const examples = await (await page.request.get("/src/data.json")).json();
    const examplePaths = examples.map((example) => {
      const url = new URL(example.url);
      return url.pathname + url.search + url.hash;
    });

    await page.goto("/");
    await page.waitForSelector("#randomizeButton", { state: "visible" });
    await Promise.all([
      page.waitForURL(/\?zoom=.+&lat1=/, { timeout: 10000 }),
      page.locator("#randomizeButton").click(),
    ]);

    const current = new URL(page.url());
    expect(current.hostname).toBe("localhost");
    expect(current.pathname).toBe("/");
    expect(examplePaths).toContain(current.pathname + current.search + current.hash);

    const toastName = (await page.locator("#toast").textContent())?.trim();
    expect(examples.some((example) => example.name === toastName)).toBe(true);
  });
});

test.describe("Circle tool", () => {
  test("two clicks place circle and update URL", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#circleBox1").click();
    await expect(page.locator("#wrapper1")).toHaveClass(/draw-mode/);
    await map1.click({ position: { x: 150, y: 200 } });
    await map1.click({ position: { x: 250, y: 200 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
  });

  test("circle persists in URL and is restored on reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#circleBox1").click();
    await map1.click({ position: { x: 150, y: 200 } });
    await map1.click({ position: { x: 250, y: 200 } });
    const url = page.url();
    await expect(url).toMatch(/\#.+/);
    await page.goto(url);
    await page.waitForSelector("#map1", { state: "attached" });
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
  });

  test("can draw two circles on same map and both persist", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#circleBox1").click();
    await map1.click({ position: { x: 120, y: 180 } });
    await map1.click({ position: { x: 180, y: 180 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await page.locator("#circleBox1").click();
    await map1.click({ position: { x: 220, y: 220 } });
    await map1.click({ position: { x: 280, y: 220 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    const circles = page.locator(
      "#map1 .leaflet-overlay-pane path.leaflet-interactive"
    );
    await expect(circles.first()).toBeVisible();
    await expect(circles).toHaveCount(4);
    const url = page.url();
    await page.goto(url);
    await page.waitForSelector("#map1", { state: "attached" });
    const circlesAfter = page.locator(
      "#map1 .leaflet-overlay-pane path.leaflet-interactive"
    );
    await expect(circlesAfter).toHaveCount(4);
  });

  test("no connection preview from previous line when in circle mode", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await page.keyboard.press("Escape");
    const overlayPaths = page.locator(
      "#map1 .leaflet-overlay-pane path.leaflet-interactive"
    );
    const pathCountAfterLine = await overlayPaths.count();
    await page.locator("#circleBox1").click();
    await expect(page.locator("#wrapper1")).toHaveClass(/draw-mode/);
    await map1.hover({ position: { x: 250, y: 100 } });
    await expect(overlayPaths).toHaveCount(pathCountAfterLine);
  });
});

test.describe("Rectangle tool", () => {
  test("two clicks place rectangle and update URL", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#rectBox1").click();
    await expect(page.locator("#wrapper1")).toHaveClass(/draw-mode/);
    await map1.click({ position: { x: 120, y: 160 } });
    await map1.click({ position: { x: 260, y: 280 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
  });

  test("rectangle persists in URL and is restored on reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#rectBox1").click();
    await map1.click({ position: { x: 120, y: 160 } });
    await map1.click({ position: { x: 260, y: 280 } });
    const url = page.url();
    await expect(url).toMatch(/\#.+/);
    await page.goto(url);
    await page.waitForSelector("#map1", { state: "attached" });
    await expect(page.locator("#map1 path.leaflet-interactive").first()).toBeVisible();
  });

  test("can draw two rectangles on same map and both persist", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#rectBox1").click();
    await map1.click({ position: { x: 100, y: 140 } });
    await map1.click({ position: { x: 180, y: 220 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await page.locator("#rectBox1").click();
    await map1.click({ position: { x: 220, y: 160 } });
    await map1.click({ position: { x: 300, y: 240 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await expect(page).toHaveURL(/\#.+/);
    const rects = page.locator("#map1 .leaflet-overlay-pane path.leaflet-interactive");
    await expect(rects.first()).toBeVisible();
    await expect(rects).toHaveCount(4);
    const url = page.url();
    await page.goto(url);
    await page.waitForSelector("#map1", { state: "attached" });
    const rectsAfter = page.locator(
      "#map1 .leaflet-overlay-pane path.leaflet-interactive"
    );
    await expect(rectsAfter).toHaveCount(4);
  });
});

test.describe("Line tool", () => {
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

  test("after completing a shape, next draw is not connected to previous", async ({
    page,
  }) => {
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
    expect(maxSegments).toBeGreaterThanOrEqual(2);
  });

  test("Escape after one new segment keeps original closed shape and adds segment", async ({
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
    expect(Math.max(...segmentCounts)).toBeGreaterThanOrEqual(3);
  });

  test("after closing a second shape, only second shape is shown", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await map1.click({ position: { x: 105, y: 150 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 250, y: 100 } });
    await map1.click({ position: { x: 300, y: 220 } });
    await map1.click({ position: { x: 255, y: 100 } });
    await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
    const overlayPaths = page.locator(
      "#map1 .leaflet-overlay-pane path.leaflet-interactive"
    );
    await expect(overlayPaths.first()).toBeVisible();
    const paths = await overlayPaths.all();
    const segmentCounts = await Promise.all(
      paths.map((p) => p.getAttribute("d").then((d) => (d.match(/L/g) || []).length))
    );
    expect(Math.max(...segmentCounts)).toBe(2);
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

  test("shows close indicator when hovering near start on desktop", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await map1.hover({ position: { x: 105, y: 150 } });
    await expect(page.locator("#wrapper1")).toHaveClass(/within-close-range/);
    await expect(map1.locator(".leaflet-draw-close-indicator")).toBeVisible();
  });

  test("does not show touch pulse indicators on desktop", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#map1", { state: "attached" });
    const map1 = page.locator("#map1");
    await page.locator("#drawBox1").click();
    await map1.click({ position: { x: 100, y: 150 } });
    await map1.click({ position: { x: 200, y: 180 } });
    await map1.click({ position: { x: 160, y: 280 } });
    await expect(map1.locator(".leaflet-draw-pulse")).not.toBeVisible();
    await expect(map1.locator(".leaflet-draw-pulse-close")).not.toBeVisible();
  });
});

// Viewport sizes: small (mobile), medium (tablet), large (desktop)
const VIEWPORTS = [
  { name: "small", width: 375, height: 667 },
  { name: "medium", width: 768, height: 1024 },
  { name: "large", width: 1280, height: 720 },
];

test.describe("Map annotations", { tag: "@snapshot" }, () => {
  for (const { name, width, height } of VIEWPORTS) {
    test(`snapshot at ${name} viewport (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/?sat2=true");
      await page.waitForSelector("#map1", { state: "attached" });
      const map1 = page.locator("#map1");
      const map2 = page.locator("#map2");
      // Map1: line segment then closed triangle (4 clicks, 4th same as 1st)
      await page.locator("#drawBox1").click();
      await map1.click({ position: { x: 100, y: 150 } });
      await map1.click({ position: { x: 200, y: 180 } });
      await page.keyboard.press("Escape");
      await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
      await page.locator("#drawBox1").click();
      const triangleFirst = { x: 250, y: 100 };
      await map1.click({ position: triangleFirst });
      await map1.click({ position: { x: 300, y: 220 } });
      await map1.click({ position: { x: 200, y: 220 } });
      await map1.click({ position: triangleFirst });
      await expect(page.locator("#wrapper1")).not.toHaveClass(/draw-mode/);
      // Map2: circle (left) then rectangle (right) — avoid zoom/draw controls
      await page.locator("#circleBox2").click();
      await map2.click({ position: { x: 120, y: 200 } });
      await map2.click({ position: { x: 180, y: 200 } });
      await expect(page.locator("#wrapper2")).not.toHaveClass(/draw-mode/);
      await page.locator("#rectBox2").click();
      await map2.click({ position: { x: 240, y: 80 } });
      await map2.click({ position: { x: 320, y: 160 } });
      await expect(page.locator("#wrapper2")).not.toHaveClass(/draw-mode/);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`home-${name}.png`, {
        fullPage: false /* viewport only; app fills viewport so full scroll adds phantom blank space */,
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
