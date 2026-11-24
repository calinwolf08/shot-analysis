import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

/**
 * `?debug=capture`: the practice screen records the last ~20 s (pose frames
 * + the loop's decisions) and exports it as JSON for diagnosis.
 */
test("debug=capture exports the last ~20 s of poses and loop decisions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboard(page, "?e2e=replay&debug=capture", "Capture");
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId("live-capture-panel")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("live-capture-download").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^shotcoach-capture-.+\.json$/);
  // Kept as an artifact: `CAPTURE=test-results/live-capture.json npm run
  // replay:capture` replays it through the coordinator + scoring.
  await download.saveAs("test-results/live-capture.json");
  const file = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(file.version).toBe(1);
  expect(file.poses.frames.length).toBeGreaterThan(30);
  expect(file.poses.fps).toBeGreaterThan(0);
  const kinds = new Set(file.events.map((e: { kind: string }) => e.kind));
  for (const k of ["state", "rep.started", "rep.analyzing", "pipeline.result"])
    expect(kinds, k).toContain(k);
  expect(file.samples.length).toBeGreaterThan(5);
  expect(file.meta.shootingHand).toBe("right");
  expect(file.meta.coordinatorState).toBeTruthy();
});

test("no capture panel without the flag", async ({ page }) => {
  await onboard(page, "?e2e=replay", "NoCapture");
  await startLiveLoop(page);
  await expect(page.getByTestId("live-capture-panel")).toHaveCount(0);
});
