import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { onboard, screenPath } from "./helpers";

/**
 * Phase 5 — the Practice tab IS the live loop (SwingCoach-style): the camera
 * opens on arrival, a one-time "Tap to start" unlocks audio, feedback/mute/pause
 * float over the preview, and switching tabs stops / restarts the camera.
 */

interface Heard {
  kind: string;
  text?: string;
}
const heard = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
  );

const Q = "?e2e=replay&fakecam=1&replaySpeed=1";

test("camera opens on the tab; tap to start; tab switch stops and resumes it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboard(page, Q, "Tabbed");

  // Arriving on Practice: the camera preview is already live — no extra page,
  // no "Start live practice" button — with the one-time tap overlay on top.
  const video = page.getByTestId("loop-preview");
  await expect(video).toBeVisible({ timeout: 30_000 });
  const start = page.getByTestId("practice-start");
  await expect(start).toBeVisible();
  await expect(page.getByTestId("tab-shots")).toBeVisible(); // tab bar stays
  await expect(page.getByTestId("practice-pause")).toBeDisabled();
  await page.screenshot({ path: screenPath("phase5", "1-tap-to-start") });
  // Nothing is spoken before the tap (mobile browsers would block it anyway).
  expect((await heard(page)).filter((e) => e.kind === "speak")).toEqual([]);

  await start.click();
  await expect(start).toHaveCount(0);
  expect((await heard(page)).some((e) => e.kind === "unlock")).toBe(true);
  await expect(page.getByTestId("practice-pause")).toBeEnabled();

  // Focus chip is overlaid ON the camera view.
  const pv = (await page.getByTestId("pose-indicator").boundingBox())!;
  const chip = (await page.getByTestId("practice-feedback").boundingBox())!;
  expect(chip.y).toBeGreaterThanOrEqual(pv.y);
  expect(chip.y + chip.height).toBeLessThanOrEqual(pv.y + pv.height);

  // A shot comes in: strip + feedback card are on screen without scrolling.
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  const viewport = page.viewportSize()!;
  const tabBar = (await page.locator("nav.tab-bar").boundingBox())!;
  for (const id of ["status-strip", "rep-feedback"]) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(
      box.y + box.height,
      `${id} hidden behind the tab bar`,
    ).toBeLessThanOrEqual(tabBar.y + 1);
    expect(box.y).toBeLessThan(viewport.height);
  }
  await expect(page.getByTestId("status-strip")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 30_000 },
  );
  await page.screenshot({ path: screenPath("phase5", "2-running-feedback") });
  const counterBefore = await page.getByTestId("rep-counter").textContent();

  // Switch to Shots: the camera is released.
  await video.evaluate((v: HTMLVideoElement) => {
    (window as unknown as { __practiceStream?: MediaStream }).__practiceStream =
      v.srcObject as MediaStream;
  });
  await page.getByTestId("tab-shots").click();
  await page.waitForURL("**/shots**");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { __practiceStream?: MediaStream }
        ).__practiceStream
          ?.getTracks()
          .every((t) => t.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(
    page.locator('button[data-testid^="shot-row-"]').first(),
  ).toBeVisible();

  // Back to Practice: camera reopens, no tap needed again, counter continues.
  const unlocksBefore = (await heard(page)).filter(
    (e) => e.kind === "unlock",
  ).length;
  await page.getByTestId("tab-practice").click();
  await expect(page.getByTestId("loop-preview")).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() =>
      page
        .getByTestId("loop-preview")
        .evaluate(
          (v: HTMLVideoElement) =>
            (v.srcObject as MediaStream | null)?.getVideoTracks()[0]
              ?.readyState ?? "none",
        ),
    )
    .toBe("live");
  await expect(page.getByTestId("practice-start")).toHaveCount(0);
  await expect(page.getByTestId("practice-pause")).toBeEnabled();
  expect((await heard(page)).filter((e) => e.kind === "unlock").length).toBe(
    unlocksBefore,
  );
  // Today's shots carried over: the counter didn't reset to "Shot 1".
  await expect(page.getByTestId("rep-counter")).not.toHaveText("Shot 1");
  expect(counterBefore).not.toBe("Shot 1");
  await page.screenshot({ path: screenPath("phase5", "3-back-on-practice") });
});

test("old /practice/live links land on the Practice tab (query kept)", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Redirect");
  await page.goto("/practice/live?e2e=replay&debug=live");
  await page.waitForURL(/\/practice\?e2e=replay&debug=live$/);
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("tab-practice")).toHaveAttribute(
    "aria-current",
    "page",
  );
});
