/**
 * Full-pipeline golden harness: runs REAL video files through the real
 * MediaPipe worker (video decode → pose detection → shot detection →
 * metrics/scoring) and asserts the detected shot count against a recorded
 * baseline. This is the automated counterpart to the replay tests, which
 * stub MediaPipe — it exercises the actual "vision" stage end to end.
 *
 * Activation: drop clips into `src-tests/fixtures/videos/` (see the README
 * there). With no video, every case skips and CI stays green. First run
 * for a video (or `UPDATE_BASELINE=1`) records `<name>.expected.json`;
 * later runs assert against it.
 *
 * `?e2e=device` keeps the DB/test hooks on while leaving the real worker
 * in place (only `?e2e=replay` swaps in the deterministic backend).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

const VIDEO_DIR = fileURLToPath(
  new URL("../../fixtures/videos", import.meta.url),
);
const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i;

const videos = existsSync(VIDEO_DIR)
  ? readdirSync(VIDEO_DIR).filter((f) => VIDEO_RE.test(f))
  : [];

async function onboard(page: Page) {
  await page.goto("/?e2e=device");
  await page.waitForURL("**/onboarding**");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("RealAnalysis");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL(/\/\?e2e=device$/);
}

test.describe("real MediaPipe video analysis (golden)", () => {
  // Keep a visible skipped marker when the folder is empty, so running this
  // file alone reports "skipped" rather than "no tests found".
  if (videos.length === 0) {
    test.skip("no golden videos present", () => {});
  }

  for (const video of videos) {
    test(`analyzes ${video}`, async ({ page }) => {
      await onboard(page);

      await page.getByTestId("start-assessment").click();
      await page.waitForURL("**/assess**");
      await page
        .getByTestId("assess-file-input")
        .setInputFiles(join(VIDEO_DIR, video));
      await page.getByTestId("assess-start").click();

      await expect(page.getByTestId("assess-review")).toBeVisible({
        timeout: 210_000,
      });
      const detected = await page
        .locator('[data-testid^="review-shot-"]')
        .count();
      expect(detected).toBeGreaterThan(0);

      // Every detected shot carries a numeric form score through to results.
      await page.getByTestId("assess-finish-review").click();
      await page.waitForURL("**/assess/results/**");
      const band = await page
        .getByTestId("results-overall")
        .getAttribute("data-band");
      expect(band).not.toBe("none");

      // Golden baseline: record on first run / UPDATE_BASELINE, else assert.
      const baselinePath = join(VIDEO_DIR, `${video}.expected.json`);
      if (process.env.UPDATE_BASELINE || !existsSync(baselinePath)) {
        writeFileSync(
          baselinePath,
          JSON.stringify({ shots: detected }, null, 2) + "\n",
        );
        console.log(`recorded baseline for ${video}: ${detected} shots`);
      } else {
        const expected = JSON.parse(readFileSync(baselinePath, "utf8")) as {
          shots: number;
        };
        expect(detected, `shot count drift for ${video}`).toBe(expected.shots);
      }
    });
  }
});
