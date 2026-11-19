import { expect, test } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

/**
 * The live-first loop: continuous, session-less practice. A replayed pose
 * stream produces scored shots; each is persisted rooted on the player (no
 * session, no end-of-session summary) and shows up in the Shots tab to review.
 */
test("live practice: replayed reps score and persist to the Shots tab", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Live");

  await startLiveLoop(page);

  // A scored shot surfaces as per-shot feedback (overall score + worst chips).
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("rep-feedback-score")).toBeVisible();
  // Whole-number score (rounded up), capped at 10+.
  await expect(page.getByTestId("rep-feedback-score")).toHaveText(
    /^\s*(\d|10\+)\s*$/,
  );
  // Each item: "<phase> <label>: <how it's off> by <whole score>" — no
  // degrees or limb percentages on the card.
  for (const t of await page.getByTestId("feedback-item").allTextContents()) {
    expect(t.trim()).toMatch(/^\S.*: .+ by (\d|10\+)$/);
    expect(t).not.toMatch(/°|%/);
  }

  // Feedback: at most the 3 worst issues, each labelled with its phase, in
  // shot order (Load → Rise → Set point → Release).
  const items = page.getByTestId("feedback-item");
  const n = await items.count();
  expect(n).toBeLessThanOrEqual(3);
  const order = ["Load", "Rise", "Set point", "Release"];
  const phases = await page
    .locator('[data-testid="feedback-item"] .chip-phase')
    .allTextContents();
  const ranks = phases.map((p) => order.indexOf(p.trim()));
  expect(ranks.every((r) => r >= 0)).toBe(true);
  expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);

  // Leaving is just switching tabs — the shot is already persisted (no
  // summary), and the Shots tab lists it; opening it reviews the scorecard.
  await page.getByTestId("tab-shots").click();
  const firstShot = page.locator('[data-testid^="shot-row-"]').first();
  await expect(firstShot).toBeVisible({ timeout: 10_000 });
  await firstShot.click();

  await expect(page.getByTestId("shot-review")).toBeVisible();
  await expect(page.getByTestId("review-scrubber")).toBeVisible();
  // The v3 scorecard: the four phases in order.
  await expect(page.getByTestId("scorecard-v3")).toBeVisible();
  await expect(page.getByTestId("v3-phase-load")).toBeVisible();
  await expect(page.getByTestId("v3-phase-release")).toBeVisible();
});
