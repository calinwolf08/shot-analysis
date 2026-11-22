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
  await startLiveLoop(page);
  // Reset focus to "everything" so the overlay isn't filtered to a
  // selection (a fresh account starts there anyway; settings are per user).
  await page.getByTestId("focus-chip").click();
  const clear = page.getByTestId("focus-clear");
  if (await clear.isEnabled()) await clear.click();
  await page
    .getByTestId("sheet-backdrop")
    .click({ position: { x: 10, y: 10 } });
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 30_000,
  });
  // Leaving the Practice tab stops the camera + loop.
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
  const metrics = page.locator(
    'section[data-testid^="v3-phase-"] [data-testid^="v3-row-"] button',
  );
  // Two metrics from opposite ends of the scorecard are in different phases,
  // so clicking each seeks to a different frame — proving the seek works
  // without depending on scorecard order or seek direction.
  const first = metrics.first();
  const last = metrics.last();

  await first.scrollIntoViewIfNeeded();
  await first.click();
  const atFirst = Number(await scrubber.inputValue());

  await last.scrollIntoViewIfNeeded();
  await last.click();
  const atLast = Number(await scrubber.inputValue());

  expect(atFirst).not.toBe(atLast);
});

test("clicking a metric draws that metric (head pitch) in its own phase", async ({
  page,
}) => {
  await openReview(page);
  await page.getByTestId("v3-row-load.head_pitch").locator("button").click();
  await expect(page.getByTestId("review-phase")).toHaveText("Load");
  await expect(page.getByTestId("review-skeleton")).toHaveAttribute(
    "data-geometry",
    "pitch",
  );
});

test("a picked metric shows its target zone; a timing metric its window on the scrubber", async ({
  page,
}) => {
  await openReview(page);
  const skeleton = page.getByTestId("review-skeleton");
  await page.getByTestId("v3-row-load.knee_depth").locator("button").click();
  await expect(skeleton).toHaveAttribute("data-zone", "rect");
  await page.getByTestId("v3-row-load.spine_angle").locator("button").click();
  await expect(skeleton).toHaveAttribute("data-zone", "wedge");

  await page
    .getByTestId("v3-row-rise.t_ball_vs_knee_bottom")
    .locator("button")
    .click();
  await expect(page.getByTestId("review-timing-band")).toBeVisible();
  await expect(page.getByTestId("review-timing-legend")).toBeVisible();
  // Seeks to when the second event actually happened.
  const actual = page.getByTestId("review-timing-actual");
  const box = (await actual.boundingBox())!;
  const track = (await page.getByTestId("review-scrubber").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(track.x - 10);

  // Scrubbing away clears the pick (and its band).
  const scrubber = page.getByTestId("review-scrubber");
  await setRange(scrubber, Number(await scrubber.getAttribute("min")));
  await expect(page.getByTestId("review-timing-band")).toHaveCount(0);
});
