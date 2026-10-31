import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const artifacts = path.join(root, "docs/part-d");
const ffmpeg = process.env.PART_D_FFMPEG;
if (ffmpeg) execFileSync(ffmpeg, ["-version"], { stdio: "ignore", windowsHide: true });
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const stills = await browser.newContext({ viewport: { width: 1440, height: 1040 }, reducedMotion: "reduce" });
  const preview = await stills.newPage();
  preview.setDefaultTimeout(60000);
  await preview.goto("http://127.0.0.1:4173");
  await preview.getByTestId("tangent-point").waitFor();
  await preview.evaluate(() => document.fonts.ready);
  for (const [label, width] of [["desktop", 1440], ["tablet", 820], ["phone", 390]]) {
    await preview.setViewportSize({ width, height: 1040 });
    await preview.screenshot({ path: path.join(artifacts, "preview-" + label + ".png"), fullPage: true });
  }
  await preview.getByRole("tab", { name: "Function lab" }).click();
  await preview.evaluate(() => document.fonts.ready);
  for (const [label, width] of [["desktop", 1440], ["tablet", 820], ["phone", 390]]) {
    await preview.setViewportSize({ width, height: 1040 });
    await preview.screenshot({ path: path.join(artifacts, "function-lab-" + label + ".png"), fullPage: true });
  }
  await stills.close();
  console.log("Desktop, tablet, and phone previews saved to docs/part-d.");

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
    reducedMotion: "no-preference",
    recordVideo: { dir: path.join(root, "node_modules/.cache/part-d-video"), size: { width: 1440, height: 1040 } },
  });
  const recordingStarted = performance.now();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const video = page.video();
  await page.goto("http://127.0.0.1:4173");
  await page.getByTestId("tangent-point").waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Let the first fully painted frame reach the recorder before trimming the loading period.
  await page.waitForTimeout(750);
  const leadingSeconds = (performance.now() - recordingStarted) / 1000;
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Play explanation" }).click();
  await page.waitForTimeout(6900);
  await page.getByRole("tab", { name: "Changing a curve" }).click();
  await page.getByRole("button", { name: "Play explanation" }).click();
  await page.waitForTimeout(6300);
  await page.getByRole("tab", { name: "Area", exact: true }).click();
  await page.getByRole("button", { name: "Play explanation" }).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Correct step", exact: true }).click();
  await page.getByRole("button", { name: "Check my work" }).click();
  await page.getByTestId("check-result").waitFor();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Sign mistake", exact: true }).click();
  await page.getByRole("button", { name: "Check my work" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("tab", { name: "Function lab" }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("slider", { name: "Parameter b", exact: true }).focus();
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(80);
  }
  await page.getByRole("button", { name: "Tangent", exact: true }).click();
  const handle = page.getByTestId("tangent-point");
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let index = 1; index <= 40; index++) {
      await page.mouse.move(box.x + box.width / 2 + index * 2, box.y + box.height / 2);
      await page.waitForTimeout(35);
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(1500);
  await context.close();
  const destination = path.join(artifacts, "math-visuals-demo.webm");
  if (ffmpeg) {
    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-y", "-i", await video.path(),
      "-ss", leadingSeconds.toFixed(3), "-an", "-c:v", "libvpx-vp9", "-b:v", "0",
      "-crf", "30", "-deadline", "realtime", "-cpu-used", "5", destination,
    ], { stdio: "inherit", windowsHide: true });
    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-y", "-ss", "0.2", "-i", destination,
      "-frames:v", "1", "-update", "1", path.join(artifacts, "demo-frame.png"),
    ], { stdio: "inherit", windowsHide: true });
    console.log("Loading footage trimmed; video poster saved.");
  } else {
    await video.saveAs(destination);
    console.log("Set PART_D_FFMPEG to an FFmpeg executable to trim loading footage and generate a poster.");
  }
  await video.delete();
  console.log("Part D backup video: docs/part-d/math-visuals-demo.webm (silent, captioned; demo adapters).");
} finally {
  await browser.close();
}
