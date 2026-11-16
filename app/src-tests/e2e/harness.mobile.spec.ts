import { expect, test } from "./fixtures";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Phase 0 harness smoke: `?e2e=replay&fakecam=1` opens a real (fake-device)
 * camera stream next to the replayed pose stream, the audio probe is
 * installed, and the replayed frames carry capture timestamps.
 */
test("fake camera + replay poses + audio probe boot together", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay&fakecam=1&debug=live", "Harness");
  await page.getByTestId("practice-live").click();
  await startLiveLoop(page);

  const video = page.getByTestId("loop-preview");
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((v: HTMLVideoElement) => {
        const s = v.srcObject as MediaStream | null;
        return s?.getVideoTracks()[0]?.readyState ?? "none";
      }),
    )
    .toBe("live");

  // The in-loop positioning gate is active (camera present).
  await expect(page.getByTestId("readiness")).toBeVisible();
  // Replayed poses are drawn.
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId("live-pose-overlay").getAttribute("data-frame"),
      ),
    )
    .toBeGreaterThan(0);

  expect(
    await page.evaluate(() =>
      Array.isArray(
        (window as unknown as { __scAudioLog?: unknown }).__scAudioLog,
      ),
    ),
  ).toBe(true);
  await page.screenshot({
    path: screenPath("phase0", "fakecam-loop"),
  });
});
