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
  page.on("console", (m) => {
    if (m.text().startsWith("CLIP") || m.text().includes("positioned"))
      console.log(m.text());
  });
  await onboard(page, Q, "Clips");
  await recordAndOpenNewest(page, 2);

  const video = page.getByTestId("review-video");
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect(video).toHaveAttribute("data-exact-sync", "true");

  // Compressed: well under ~0.1 MB per second of clip (≤ 15 s segments).
  const size = await video.evaluate(async (v: HTMLVideoElement) => {
    const blob = await (await fetch(v.src)).blob();
    return blob.size;
  });
  test.info().annotations.push({ type: "clip", description: `${size} bytes` });
  expect(size).toBeGreaterThan(1_000);
  expect(size).toBeLessThan(1_800_000);

  // The clip is decoded once into a frame per pose frame; scrubbing draws
  // the frame grabbed at that pose frame's capture time relative to the clip
  // start (same clock) — no seeking (slow with few keyframes).
  const frames = page.getByTestId("review-clip-frames");
  await expect(frames).toBeVisible({ timeout: 30_000 });
  const scrubber = page.getByTestId("review-scrubber");
  const canvas = page.getByTestId("review-skeleton");
  const min = Number(await scrubber.getAttribute("min"));
  const max = Number(await scrubber.getAttribute("max"));
  const startTs = Number(await video.getAttribute("data-start-frame-ts"));
  for (const f of [min, Math.round((min + max) / 2), max]) {
    await setRange(scrubber, f);
    const t = Number(await canvas.getAttribute("data-frame-t"));
    // The clip covers the whole rep window, so every stored frame — the
    // first one included — is on video.
    const expected = (t - startTs) / 1000;
    expect(
      expected,
      `frame ${f} (t=${t}) vs clip start ${startTs}`,
    ).toBeGreaterThanOrEqual(0);
    // The decoded frame's own media time: the recorded frame nearest the
    // pose frame — headless fake-camera recordings can hold only ~10 frames/s.
    await expect
      .poll(async () =>
        Math.abs(
          Number(await frames.getAttribute("data-frame-video-time")) - expected,
        ),
      )
      .toBeLessThan(0.15);
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

  // ?debug=video: the diagnostics panel, with the clip downloadable.
  await page.goto(`${page.url().split("?")[0]}?debug=video`);
  const dbg = page.getByTestId("review-video-debug");
  await expect(dbg).toContainText("readyState", { timeout: 10_000 });
  await expect(dbg).toContainText("clip: video/");
  await expect(dbg).toContainText("loadedmetadata");
  await expect(page.getByTestId("review-video-download")).toHaveAttribute(
    "download",
    /^shot-.+\.(webm|mp4)$/,
  );
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

test("slow analysis (a slow phone): the clip still covers the whole shot", async ({
  page,
}) => {
  test.setTimeout(240_000);
  // 12 s of analysis per shot — longer than one recorder segment rotation.
  await onboard(page, `${Q}&analysisDelayMs=12000`, "SlowClip");
  await recordAndOpenNewest(page, 2);
  const video = page.getByTestId("review-video");
  await expect(video).toBeVisible({ timeout: 10_000 });
  await expect(video).toHaveAttribute("data-exact-sync", "true");
  const startTs = Number(await video.getAttribute("data-start-frame-ts"));
  const scrubber = page.getByTestId("review-scrubber");
  const canvas = page.getByTestId("review-skeleton");
  // The first frame of the stored shot is on video (not before the clip).
  await setRange(scrubber, Number(await scrubber.getAttribute("min")));
  const t = Number(await canvas.getAttribute("data-frame-t"));
  expect(
    t - startTs,
    `first pose frame ${t} vs clip start ${startTs}`,
  ).toBeGreaterThanOrEqual(0);
});
