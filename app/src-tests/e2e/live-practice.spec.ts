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

  // Leaving is just switching tabs — the shot is already persisted (no
  // summary), and the Shots tab lists it; opening it reviews the scorecard.
  await page.getByTestId("tab-shots").click();
  const firstShot = page.locator('[data-testid^="shot-row-"]').first();
  await expect(firstShot).toBeVisible({ timeout: 10_000 });
  await firstShot.click();

  await expect(page.getByTestId("shot-review")).toBeVisible();
  await expect(page.getByTestId("review-scrubber")).toBeVisible();
  await expect(page.getByTestId("scorecard")).toBeVisible();
});
