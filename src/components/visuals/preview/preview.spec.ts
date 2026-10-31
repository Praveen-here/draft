import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("tangent-point")).toBeVisible();
});

test("all teaching visuals render, with no browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("tab", { name: "Changing a curve" }).click();
  await expect(page.getByTestId("function-curve")).toBeVisible();
  await page.getByRole("tab", { name: "Area", exact: true }).click();
  await expect(page.getByTestId("shaded-area")).toBeVisible();
  await page.getByRole("tab", { name: "Number line", exact: true }).click();
  await expect(page.getByRole("img", { name: /Number line from/ })).toBeVisible();
  await page.getByRole("tab", { name: "Value table" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("a student can change the tangent position with the keyboard", async ({ page }) => {
  const slider = page.getByRole("slider", { name: "Tangent position" });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("slope-value")).toContainText("-6");
  await page.keyboard.press("End");
  await expect(page.getByTestId("slope-value")).toContainText("6");
});

test("checker distinguishes correct, incorrect, and uncertain work", async ({ page }) => {
  await page.getByRole("button", { name: "Correct step", exact: true }).click();
  await page.getByRole("button", { name: "Check my work" }).click();
  await expect(page.getByTestId("check-result")).toHaveAttribute("data-result", "ok");
  await page.getByRole("button", { name: "Sign mistake", exact: true }).click();
  await page.getByRole("button", { name: "Check my work" }).click();
  await expect(page.getByTestId("check-result")).toHaveAttribute("data-result", "not-equivalent");
  await page.getByRole("button", { name: "Needs context", exact: true }).click();
  await page.getByRole("button", { name: "Check my work" }).click();
  await expect(page.getByTestId("check-result")).toHaveAttribute("data-result", "unsure");
  await page.getByLabel("Your next line").fill("x+");
  await expect(page.getByTestId("check-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Check my work" }).click();
  await expect(page.getByTestId("check-result")).toHaveAttribute("data-result", "unparseable");
});

test("final integral answers are checked without needing another teammate's service", async ({ page }) => {
  await page.getByRole("button", { name: "Check an answer", exact: true }).click();
  await page.getByLabel("Problem", { exact: true }).fill("\\int x e^x\\,dx");
  await page.getByLabel("Your answer", { exact: true }).fill("x e^{x}-e^x+C");
  await page.getByRole("button", { name: "Check my work" }).click();
  await expect(page.getByTestId("check-result")).toHaveAttribute("data-result", "ok");
});

test("tool-driven animation changes a value without remounting the graph", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("tab", { name: "Changing a curve" }).click();
  const slider = page.getByRole("slider", { name: "Parameter a" });
  await slider.evaluate((element) => element.setAttribute("data-original-node", "yes"));
  await page.evaluate(() => window.partDPreview!.run({ type: "animateParam", plotId: "lesson", param: "a", from: 1, to: 3, ms: 1200 }));
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(1);
  expect(Number(await slider.inputValue())).toBeLessThan(3);
  await expect(slider).toHaveValue("3");
  await expect(slider).toHaveAttribute("data-original-node", "yes");
  await expect(page.locator('[data-visual-id="lesson"]')).toHaveCount(1);
});

test("reduced motion applies target values immediately and pause freezes an animation", async ({ page }) => {
  await page.getByRole("tab", { name: "Changing a curve" }).click();
  await page.evaluate(() => window.partDPreview!.run({ type: "animateParam", plotId: "lesson", param: "a", from: 1, to: 3, ms: 4000 }));
  const slider = page.getByRole("slider", { name: "Parameter a" });
  await expect(slider).toHaveValue("3");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => window.partDPreview!.run({ type: "animateParam", plotId: "lesson", param: "a", from: 3, to: 1, ms: 4000 }));
  await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(3);
  await page.evaluate(() => window.partDPreview!.stop());
  const paused = await slider.inputValue();
  await page.waitForTimeout(200);
  await expect(slider).toHaveValue(paused);
});

test("bad formulas fail gracefully, and clearing removes only owned visuals", async ({ page }) => {
  await page.evaluate(() => window.partDPreview!.run({ type: "plot", id: "bad", fn: "import(1)", xRange: [-3, 3], near: { shapeId: "demo" } }));
  await expect(page.locator('[data-visual-id="bad"]')).toContainText("couldn't draw");
  await page.evaluate(() => window.partDPreview!.clear());
  await expect(page.locator("[data-visual-id]")).toHaveCount(0);
});

test("tablet and phone layouts fit without horizontal overflow", async ({ page }) => {
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(page.getByTestId("tangent-point")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflow).toBe(false);
  }
});

test("concept tabs support arrow-key navigation", async ({ page }) => {
  await page.getByRole("tab", { name: "Slope & tangent" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Changing a curve" })).toBeFocused();
  await expect(page.getByRole("slider", { name: "Parameter a" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Function lab" })).toBeFocused();
  await expect(page.getByLabel("Your function", { exact: true })).toBeVisible();
});

async function dragPoint(page: Page, marker: string, dx: number) {
  const point = page.getByTestId(marker);
  await point.scrollIntoViewIfNeeded();
  const box = await point.boundingBox();
  if (!box) throw new Error("Point is missing: " + marker);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("a graph point can be dragged directly and moved with labelled keyboard controls", async ({ page }) => {
  await dragPoint(page, "tangent-point", 55);
  const slider = page.getByRole("slider", { name: "Tangent position", exact: true });
  expect(Number(await slider.inputValue())).toBeGreaterThan(1.4);
  const handle = page.getByRole("slider", { name: "Drag tangent point", exact: true });
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  const at = Number(await handle.getAttribute("aria-valuenow"));
  await expect(page.getByTestId("slope-value")).toContainText(String(Number((2 * at).toPrecision(4))));
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("-3");
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("3");
});

test("area handles reshape the actual shaded region", async ({ page }) => {
  await page.getByRole("tab", { name: "Area", exact: true }).click();
  const before = await page.getByTestId("shaded-area").getAttribute("points");
  await dragPoint(page, "area-to", 45);
  expect(Number(await page.getByRole("slider", { name: "Area end", exact: true }).inputValue())).toBeGreaterThan(2.2);
  await expect(page.getByTestId("shaded-area")).not.toHaveAttribute("points", before!);
  await page.getByRole("slider", { name: "Drag area start", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await page.getByRole("slider", { name: "Area start", exact: true }).inputValue())).toBeGreaterThan(0);
});

test("taking hold of a point pauses the explanation and cancels its later commands", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Play explanation" }).click();
  await page.getByTestId("tangent-point").click();
  await expect(page.getByRole("button", { name: "Play explanation" })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Tangent position", exact: true });
  const held = await slider.inputValue();
  await page.waitForTimeout(4200);
  await expect(slider).toHaveValue(held);
  await expect(page.getByTestId("narration")).toContainText("You're in control");
});

test("custom functions create sliders and respond to direct tracing", async ({ page }) => {
  await page.getByRole("tab", { name: "Function lab" }).click();
  await page.getByLabel("Your function", { exact: true }).fill("a*x^3+b");
  await page.getByRole("button", { name: "Draw function" }).click();
  await expect(page.getByRole("slider", { name: "Parameter c", exact: true })).toHaveCount(0);
  const curve = page.getByTestId("function-curve");
  const before = await curve.getAttribute("points");
  await page.getByRole("slider", { name: "Parameter a", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(curve).not.toHaveAttribute("points", before!);
  await dragPoint(page, "trace-point", -45);
  const at = Number(await page.getByRole("slider", { name: "Point on curve" }).getAttribute("aria-valuenow"));
  expect(at).toBeLessThan(1);
  const a = Number(await page.getByRole("slider", { name: "Parameter a", exact: true }).inputValue());
  const b = Number(await page.getByRole("slider", { name: "Parameter b", exact: true }).inputValue());
  await expect(page.getByTestId("trace-value")).toContainText(String(Number((a * at ** 3 + b).toPrecision(4))));
});

test("custom views preserve values, handle poles, and keep the last graph on invalid input", async ({ page }) => {
  await page.getByRole("tab", { name: "Function lab" }).click();
  await page.getByRole("button", { name: "Cubic", exact: true }).click();
  await page.getByRole("button", { name: "Tangent", exact: true }).click();
  await expect(page.getByTestId("slope-value")).toContainText("0.5");
  await expect(page.getByRole("slider", { name: "Parameter b", exact: true })).toHaveValue("-1");
  await page.getByRole("button", { name: "Area", exact: true }).click();
  await expect(page.getByTestId("shaded-area")).toBeVisible();
  await page.getByRole("button", { name: "Reciprocal", exact: true }).click();
  await page.getByRole("button", { name: "Curve", exact: true }).click();
  await expect(page.getByTestId("function-curve")).toHaveCount(2);
  await page.getByLabel("Your function", { exact: true }).fill("import(1)");
  await page.getByRole("button", { name: "Draw function" }).click();
  await expect(page.getByRole("alert")).toContainText("Try a function");
  await expect(page.getByTestId("function-curve")).toHaveCount(2);
  await page.getByLabel("Your function", { exact: true }).fill("\\sin(x)");
  await page.getByRole("button", { name: "Draw function" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("function-curve")).toHaveCount(1);
});

test("the function lab validates view limits and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.goto("/#function-lab");
  const active = page.getByRole("tab", { name: "Function lab" });
  await expect(active).toHaveAttribute("aria-selected", "true");
  await expect.poll(async () => {
    const box = await active.boundingBox();
    return !!box && box.x >= 0 && box.x + box.width <= 390;
  }).toBe(true);
  await page.getByText("View range", { exact: true }).click();
  await page.getByLabel("x minimum", { exact: true }).fill("2");
  await page.getByLabel("x maximum", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Apply range", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("range must increase");
  await page.getByLabel("x minimum", { exact: true }).fill("-2");
  await page.getByRole("button", { name: "Apply range", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Point on curve" })).toHaveAttribute("aria-valuemin", "-2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test("touch dragging moves the point without scrolling the page", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173");
    const point = page.getByTestId("tangent-point");
    await point.scrollIntoViewIfNeeded();
    const box = await point.boundingBox();
    if (!box) throw new Error("Touch target missing");
    const scroll = await page.evaluate(() => scrollY);
    const session = await context.newCDPSession(page);
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 8; step++) await session.send("Input.dispatchTouchEvent", {
      type: "touchMove", touchPoints: [{ x: start.x + step * 4, y: start.y + step * 2 }],
    });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(Number(await page.getByRole("slider", { name: "Tangent position", exact: true }).inputValue())).toBeGreaterThan(1.3);
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
  } finally { await context.close(); }
});
