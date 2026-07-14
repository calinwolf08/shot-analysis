/**
 * Live-lesson validation from a recorded video (no webcam). Plays a test
 * clip as the "camera" via the file-backed capture service
 * (`?liveVideo=…`), so the REAL pipeline runs end to end:
 *   file decode → frame-capture → MediaPipe worker → coordinator.
 *
 * Requirements to actually run (else it auto-skips, keeping CI green):
 *   1. A browser that can decode the clip's codec. The test videos are
 *      H.264 mp4; the headless Chromium in some CI/dev containers ships
 *      WITHOUT H.264, so this skips there. Runs on a normal Chrome.
 *   2. At least one video in `test-data/videos/`.
 *
 * What it proves (robust to detector tuning): the video's real pose is
 * tracked (setup readiness passes) and landmark frames stream through the
 * live loop (the pose overlay advances). Shot-detection *timing* is the
 * thing you're tuning, so a rep is observed/logged but not hard-asserted.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { onboard } from "../helpers";

test.describe.configure({ timeout: 240_000 });

const VIDEO_DIR = fileURLToPath(
  new URL("../../../../../test-data/videos", import.meta.url),
);
const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

/** Smallest available clip → fastest headless run. */
function pickVideo(): string | null {
  if (!existsSync(VIDEO_DIR)) return null;
  const files = readdirSync(VIDEO_DIR)
    .filter((f) => VIDEO_RE.test(f))
    .map((f) => ({ f, size: statSync(join(VIDEO_DIR, f)).size }))
    .sort((a, b) => a.size - b.size);
  return files[0]?.f ?? null;
}

async function canDecodeH264(page: Page): Promise<boolean> {
  await page.goto("/auth/sign-in?e2e=device");
  return page.evaluate(
    () =>
      document
        .createElement("video")
        .canPlayType('video/mp4; codecs="avc1.42E01E"') !== "",
  );
}

const video = pickVideo();

test("live lesson tracks pose and streams from a recorded video", async ({
  page,
}) => {
  if (!video) {
    test.skip(true, "no test video in test-data/videos/");
    return;
  }
  // H.264 is only needed for mp4 clips; webm (VP8) is fine everywhere.
  if (/\.mp4$/i.test(video) && !(await canDecodeH264(page))) {
    test.skip(true, "browser lacks H.264 — run on a Chrome with mp4 support");
    return;
  }

  // Serve the clip at a stable in-app URL the file-capture service loads.
  const bytes = readFileSync(join(VIDEO_DIR, video));
  await page.route("**/__livevideo", (route) =>
    route.fulfill({ contentType: "video/mp4", body: bytes }),
  );

  await onboard(page, "?e2e=device", "LiveVid");

  const query = "?e2e=device&debug=live&liveVideo=/__livevideo";
  await page.goto(`/practice/live${query}`);

  // Real pose from the video drives the setup checks to ready.
  await expect(page.getByTestId("setup-start")).toBeEnabled({
    timeout: 120_000,
  });
  await page.getByTestId("setup-start").click();

  // Into the loop, with the real worker streaming landmark frames.
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });

  // Primary proof: the live pose overlay advances → real vision frames are
  // flowing from the decoded video through the worker into the loop.
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByTestId("live-pose-overlay")
            .getAttribute("data-frame"),
        ),
      { timeout: 120_000, message: "pose overlay never advanced" },
    )
    .toBeGreaterThan(5);

  await expect(page.getByTestId("pose-indicator")).toHaveAttribute(
    "data-state",
    /full|partial/,
    { timeout: 30_000 },
  );

  // Observe shot detection (not hard-asserted — this is the timing you tune).
  const gotRep = await page
    .getByTestId("rep-feedback")
    .isVisible({ timeout: 60_000 })
    .catch(() => false);
  console.log(`live-video ${video}: rep detected = ${gotRep}`);
});
