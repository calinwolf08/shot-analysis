/**
 * Full-frame-rate re-detection, end to end with REAL MediaPipe: a recorded
 * shooting clip plays as the "camera" (`?liveVideo=`), live tracking runs in
 * the worker, each rep's clip is recorded, decoded again at full rate and
 * re-detected on the second (offline) detector, and the shot is scored from
 * those frames. The `?debug=capture` file is downloaded and checked.
 *
 *   LIVE_VIDEO=/path/to/side-on-shot.webm npx playwright test \
 *     src-tests/e2e/manual/full-rate.spec.ts --project chromium --trace off
 *
 * Skips without LIVE_VIDEO (no real footage is committed). Optional
 * DETECT_DELAY_MS imitates a slow phone's live detection (only the live
 * worker's frames are slowed — the offline detector gets the same delay).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { onboard, startLiveLoop } from "../helpers";

const VIDEO = process.env.LIVE_VIDEO;
const DELAY = Number(process.env.DETECT_DELAY_MS ?? 0) || 0;

test.describe.configure({ timeout: 300_000 });

test("shots are scored from frames re-detected at full rate", async ({
  page,
}) => {
  test.skip(!VIDEO || !existsSync(VIDEO), "set LIVE_VIDEO to a shot clip");
  const bytes = readFileSync(VIDEO!);
  await page.route(
    (u) => u.pathname === "/__livevideo",
    (route) => route.fulfill({ contentType: "video/webm", body: bytes }),
  );
  await onboard(page, "?e2e=device", "FullRate");
  await page.goto(
    `/practice?e2e=device&debug=capture&liveVideo=/__livevideo${DELAY ? `&detectDelayMs=${DELAY}` : ""}`,
  );
  page.on("console", (m) => {
    if (
      m.type() === "error" ||
      m.type() === "warning" ||
      /\[live\]/.test(m.text())
    )
      console.log(`[browser ${m.type()}] ${m.text()}`);
  });
  await page.getByTestId("practice-loop").waitFor({ timeout: 150_000 });
  await startLiveLoop(page);

  // Let the looping clip play through its shot a few times.
  const events: { kind: string; data?: Record<string, unknown> }[] = [];
  const deadline = Date.now() + 200_000;
  let file: {
    events: typeof events;
    meta: Record<string, unknown>;
  } | null = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(15_000);
    const dl = page.waitForEvent("download");
    await page.getByTestId("live-capture-download").click();
    const d = await dl;
    const path = await d.path();
    file = JSON.parse(readFileSync(path!, "utf8"));
    events.push(
      ...file!.events.filter(
        (e) => !events.some((x) => JSON.stringify(x) === JSON.stringify(e)),
      ),
    );
    if (events.some((e) => e.kind === "rep.result" || e.kind === "refine"))
      if (events.filter((e) => e.kind === "refine").length >= 2) break;
  }
  if (file)
    writeFileSync("test-results/full-rate-capture.json", JSON.stringify(file));
  const refines = events.filter((e) => e.kind === "refine");
  const results = events.filter((e) => e.kind === "rep.result");
  const pipeline = events.filter((e) => e.kind === "pipeline.result");
  console.log(
    JSON.stringify(
      {
        timing: file?.meta.timing,
        poseStats: file?.meta.poseStats,
        refines: refines.map((e) => e.data),
        results: results.map((e) => e.data),
        scored: pipeline.map((e) => e.data),
        other: events
          .filter((e) => e.kind.startsWith("rep.") && e.kind !== "rep.result")
          .map((e) => `${e.kind} ${JSON.stringify(e.data)}`),
      },
      null,
      1,
    ),
  );
  expect(refines.length).toBeGreaterThan(0);
  expect(refines.some((e) => e.data?.ok === true)).toBe(true);
  expect(results.some((e) => e.data?.fullRate === true)).toBe(true);
});
