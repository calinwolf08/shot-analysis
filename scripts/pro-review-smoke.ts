#!/usr/bin/env npx tsx
/**
 * Smoke test for the pro reference review page (/pros): a temporary library
 * holding one Curry clip; open an attempt, label a key frame, adjust and
 * confirm the camera angle, flag a metric, approve — then check labels.json.
 *
 *   npm run test:pro-review     (builds the bundles first)
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chromium } from "playwright";

// A random port: never a stale server from an earlier run.
const PORT = 3400 + Math.floor(Math.random() * 500);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "pro-review-"));
const clipDir = path.join(root, "curry", "practice-01");
fs.mkdirSync(clipDir, { recursive: true });
for (const f of ["poses.json", "labels.json"]) {
  fs.copyFileSync(
    path.join("test-data/stephen-curry-1", f),
    path.join(clipDir, f),
  );
}
fs.writeFileSync(
  path.join(root, "curry", "player.json"),
  JSON.stringify({ name: "Stephen Curry", shootingHand: "right" }),
);

const server = spawn("npx", ["tsx", "server.ts", String(PORT)], {
  env: { ...process.env, PROS_DIR: root },
  stdio: "ignore",
  // Own process group, so the whole npx → tsx → node chain is stopped.
  detached: true,
});
const fail = (msg: string): never => {
  throw new Error(msg);
};

let stage = "starting";
const log = (m: string) => {
  stage = m;
  console.log(`[smoke] ${m}`);
};
// Never hang silently: report the last step reached.
const watchdog = setTimeout(() => {
  console.error(`pro-review smoke: FAILED — timed out after "${stage}"`);
  try {
    process.kill(-server.pid!, "SIGKILL");
  } catch {
    /* gone */
  }
  process.exit(1);
}, 120_000);
async function main(): Promise<void> {
  // Wait for the server to list the temporary library.
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/api/pros/library`, {
        signal: AbortSignal.timeout(2000),
      });
      const lib = (await r.json()) as { players: { id: string }[] };
      ready = lib.players.some((p) => p.id === "curry");
    } catch {
      /* not up yet */
    }
    if (!ready) await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) fail("server didn't come up with the test library");
  log("server up");
  // A pre-installed Chromium (e.g. CI images) when the package's own browser
  // download isn't there; set PW_CHROMIUM to override.
  const pre = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch(
    fs.existsSync(pre) ? { executablePath: pre } : {},
  );
  const page = await browser.newPage({
    viewport: { width: 1500, height: 950 },
  });
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Failed requests are reported below with their URL.
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
      errors.push(`${r.status()} ${r.url()}`);
  });
  log("browser up");
  await page.goto(`http://localhost:${PORT}/pros`);
  await page.locator(".attempt").first().waitFor();
  if ((await page.locator(".attempt").count()) !== 7)
    fail("expected 7 attempts");

  log("library loaded");
  // Open shot 2.
  await page.locator('.attempt[data-attempt="1"]').click();
  await page.getByText("Shot 2", { exact: false }).first().waitFor();

  // Wait for the clip's poses (the attempt opens at its window).
  await page.waitForFunction(() =>
    /^frame \d+$/.test(document.getElementById("frameNo")!.textContent ?? ""),
  );
  // Key frames: label "Set point" at the current frame + 3.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const frameText = (await page.locator("#frameNo").textContent()) ?? "";
  const frame = Number(frameText.replace(/\D+/g, ""));
  log(`at ${frameText}`);
  await page.locator('button[data-set="set_point"]').click();

  log("key frame set");
  // Camera: estimate shown; set 20° and confirm.
  await page.locator('[data-tab="camera"]').click();
  const est = await page.locator("#tabBody table b").first().textContent();
  if (!est || !/°/.test(est)) fail("no camera estimate");
  await page.locator("#camAngle").fill("20");
  await page.locator("#camAngle").dispatchEvent("change");
  await page.locator("#camConfirm").click();

  log("camera confirmed");
  // Metrics: phases, a score chip, a flag; picking draws a zone.
  await page.locator('[data-tab="metrics"]').click();
  await page.locator(".metric").first().waitFor();
  const phases = await page.locator(".phase-h").allTextContents();
  if (!phases.slice(0, 4).join(",").includes("Load")) fail(`phases: ${phases}`);
  page.once("dialog", (d) => void d.accept("knee hidden by ball"));
  await page.locator('button[data-flag="load.knee_depth"]').click();
  await page.locator('[data-metric="load.knee_depth"] .badge.b-off').waitFor();
  await page.locator('[data-metric="setPoint.hip_over_knee"] .text').click();
  await page.screenshot({
    path: path.join(os.tmpdir(), "pro-review-smoke.png"),
  });

  log("metrics ok");
  // Decision: approve with the keyboard.
  await page.keyboard.press("a");
  await page.waitForFunction(() =>
    document.getElementById("saveState")!.textContent!.startsWith("Saved"),
  );
  await browser.close();

  const saved = JSON.parse(
    fs.readFileSync(path.join(clipDir, "labels.json"), "utf8"),
  );
  const s = saved.shots[1];
  if (saved.version !== 2) fail("labels not v2");
  if (s.keyframes.set_point !== frame)
    fail(`set_point ${s.keyframes.set_point} ≠ ${frame}`);
  if (
    s.camera?.angle !== 20 ||
    !s.camera.confirmed ||
    s.camera.source !== "manual"
  )
    fail(`camera ${JSON.stringify(s.camera)}`);
  if (s.metricFlags["load.knee_depth"] !== "knee hidden by ball")
    fail("flag not saved");
  if (s.status !== "approved") fail(`status ${s.status}`);
  if (saved.shots[0].status !== "unreviewed") fail("other attempts changed");
  if (errors.length) fail(`page errors: ${errors.join("; ")}`);
  console.log("pro-review smoke: OK");
}

main()
  .catch((e) => {
    console.error("pro-review smoke: FAILED —", e.message);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      process.kill(-server.pid!, "SIGKILL");
    } catch {
      /* already gone */
    }
    fs.rmSync(root, { recursive: true, force: true });
    clearTimeout(watchdog);
  });
