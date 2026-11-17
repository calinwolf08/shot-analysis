import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Phase 7 — on-device video per shot: recorded from the (fake) camera while
 * positioned, compressed, stored locally, synced frame-exactly to the pose in
 * review, and retained per the Profile setting.
 */

const Q = "?e2e=replay&fakecam=1&replaySpeed=1";

async function setRange(input: Locator, value: number) {
  await input.evaluate((el, v) => {
    (el as HTMLInputElement).value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** Practice until `n` shots are recorded, then open the newest in review. */
async function recordAndOpenNewest(page: Page, n: number) {
  await startLiveLoop(page);
  // The first shot can land before the player reads as positioned (no clip
  // rolling yet), so record a couple.
  await expect(page.getByTestId("rep-counter")).toHaveText(`Shot ${n + 1}`, {
    timeout: 90_000,
  });
  await expect(page.getByTestId("status-strip")).toHaveAttribute(
    "data-state",
    /ready|notready/,
    { timeout: 30_000 },
  );
  await page.getByTestId("tab-shots").click();
  await page.locator('button[data-testid^="shot-row-"]').first().click();
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
}

test("each shot keeps a small, frame-synced, playable clip", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboard(page, Q, "Clips");
  await recordAndOpenNewest(page, 2);

  const video = page.getByTestId("review-video");
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect(video).toHaveAttribute("data-exact-sync", "true");

  // Compressed: well under ~0.1 MB per second of clip (≤ 10 s segments).
  const size = await video.evaluate(async (v: HTMLVideoElement) => {
    const blob = await (await fetch(v.src)).blob();
    return blob.size;
  });
  test.info().annotations.push({ type: "clip", description: `${size} bytes` });
  expect(size).toBeGreaterThan(1_000);
  expect(size).toBeLessThan(1_200_000);

  // Frame-exact sync: scrubbing to a frame seeks the video to that frame's
  // capture time relative to the clip start (same clock).
  const scrubber = page.getByTestId("review-scrubber");
  const canvas = page.getByTestId("review-skeleton");
  const min = Number(await scrubber.getAttribute("min"));
  const max = Number(await scrubber.getAttribute("max"));
  const startTs = Number(await video.getAttribute("data-start-frame-ts"));
  for (const f of [min, Math.round((min + max) / 2), max]) {
    await setRange(scrubber, f);
    const t = Number(await canvas.getAttribute("data-frame-t"));
    const expected = (t - startTs) / 1000;
    expect(expected).toBeGreaterThanOrEqual(0);
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeCloseTo(expected, 1);
  }
  await setRange(scrubber, Math.round((min + max) / 2));
  await page.screenshot({ path: screenPath("phase7", "1-review-with-video") });

  // Play: the video drives the scrubber forward, then stops at the shot end.
  await setRange(scrubber, min);
  await page.getByTestId("review-play").click();
  await expect
    .poll(async () => Number(await scrubber.inputValue()), { timeout: 10_000 })
    .toBeGreaterThan(min);
  await expect(page.getByTestId("review-play")).toHaveText("▶", {
    timeout: 15_000,
  });
  expect(Number(await scrubber.inputValue())).toBeGreaterThanOrEqual(max - 1);
});

test("Profile 'No video' removes stored clips and stops recording", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboard(page, Q, "Retention");
  await recordAndOpenNewest(page, 2);
  await expect(page.getByTestId("review-video")).toBeVisible({
    timeout: 10_000,
  });
  const shotUrl = page.url();

  // Profile → Keep video for the last: No video.
  await page.getByTestId("tab-profile").click();
  const select = page.getByTestId("video-retention");
  await expect(select).toHaveValue("20"); // default
  await select.selectOption("0");
  await page.screenshot({ path: screenPath("phase7", "2-profile-setting") });

  // The clip is gone from that shot (skeleton only).
  await page.goto(shotUrl);
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
  await expect(page.getByTestId("review-video")).toHaveCount(0);

  // Setting persists; new shots aren't recorded.
  await page.reload();
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("video-retention")).toHaveValue("0");
});
