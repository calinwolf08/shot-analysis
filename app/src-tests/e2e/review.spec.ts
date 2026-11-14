import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import { onboard, startLiveLoop } from "./helpers";

/** Set a range input and fire `input` so Svelte's bound value updates. */
async function setRange(input: Locator, value: number) {
  await input.evaluate((el, v) => {
    (el as HTMLInputElement).value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/**
 * Shot-review redesign: the pose fills the frame, off-target joints are marked,
 * and the overlaid metrics are phase-aware — scrubbing changes the phase, and
 * clicking a metric seeks to its phase. Pose comes from the replayed shot.
 */
async function openReview(page: Page) {
  await onboard(page, "?e2e=replay", "Review");
  await page.getByTestId("practice-live").click();
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("practice-done").click();
  await page.waitForURL("**/practice**");
  await page.getByTestId("tab-shots").click();
  const firstShot = page.locator('[data-testid^="shot-row-"]').first();
  await expect(firstShot).toBeVisible({ timeout: 10_000 });
  await firstShot.click();
  await expect(page.getByTestId("shot-review")).toBeVisible();
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
}

test("review overlay is phase-aware as the scrubber moves", async ({
  page,
}) => {
  await openReview(page);

  const scrubber = page.getByTestId("review-scrubber");
  const min = Number(await scrubber.getAttribute("min"));
  const max = Number(await scrubber.getAttribute("max"));

  // Seek to the start: an early-phase label + the on-stage phase metric panel.
  await setRange(scrubber, min);
  await expect(page.getByTestId("review-phase-metrics")).toBeVisible();
  const earlyPhase = await page.getByTestId("review-phase").textContent();

  // Seek to the end: the phase label must change (phase-aware overlay).
  await setRange(scrubber, max);
  await expect(page.getByTestId("review-phase")).not.toHaveText(
    earlyPhase ?? "",
  );
});

test("clicking a metric seeks the scrubber to its phase", async ({ page }) => {
  await openReview(page);

  const scrubber = page.getByTestId("review-scrubber");
  const max = Number(await scrubber.getAttribute("max"));

  // Move to the end, then click an (earlier-phase) metric row.
  await setRange(scrubber, max);
  const before = Number(await scrubber.inputValue());

  const metric = page.locator('[data-testid^="sc-metric-"]').first();
  await metric.scrollIntoViewIfNeeded();
  await metric.click();

  // The scrubber jumped back to the metric's phase start.
  await expect
    .poll(async () => Number(await scrubber.inputValue()))
    .toBeLessThan(before);
});
