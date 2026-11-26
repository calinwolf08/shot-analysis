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
  // Each item: "<keyframe> <part> too <direction> by <whole score>" — no
  // degrees or limb percentages on the card.
  for (const t of await page.getByTestId("feedback-item").allTextContents()) {
    // e.g. "Rise Knees too bent by 5".
    expect(t.trim()).toMatch(
      /^(Setup|Load|Rise|Set point|Release)\s+[A-Z][^:]* too [^:]+ by (\d|10\+)$/,
    );
    expect(t).not.toMatch(/°|%/);
  }

  // Feedback: at most the 3 worst checks, each labelled with its keyframe, in
  // shot order (Setup → Load → Rise → Set point → Release).
  const items = page.getByTestId("feedback-item");
  const n = await items.count();
  expect(n).toBeLessThanOrEqual(3);
  const order = ["Setup", "Load", "Rise", "Set point", "Release"];
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
  // The keyframe review: a phase icon per keyframe and the checks drawn.
  await expect(page.getByTestId("review-icon-setup")).toBeVisible();
  await expect(page.getByTestId("review-icon-release")).toBeVisible();
  await expect(page.getByTestId("review-callout")).toBeVisible();
});

test("the voice says the card's words, with each keyframe's lead-in", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Wording");
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  // Card chip text minus its keyframe label: "Knees too bent by 5".
  const texts = (
    await page
      .locator('[data-testid="feedback-item"]')
      .evaluateAll((els) =>
        els.map((el) =>
          (el.textContent ?? "")
            .replace(el.querySelector(".chip-phase")?.textContent ?? "", "")
            .trim(),
        ),
      )
  ).filter((t) => t.length > 0);
  await expect
    .poll(async () => {
      const log = await page.evaluate(
        () =>
          (
            window as unknown as {
              __scAudioLog?: { kind: string; text?: string }[];
            }
          ).__scAudioLog ?? [],
      );
      const spoken = log.filter((h) => h.kind === "speak").map((h) => h.text);
      const i = spoken.lastIndexOf("Analyzing");
      return i >= 0 ? (spoken[i + 1] ?? "") : "";
    })
    .toMatch(
      /^(At setup|In the load|When the ball reaches set point|At set point|At release|On target)/,
    );
  const log = await page.evaluate(
    () =>
      (
        window as unknown as {
          __scAudioLog?: { kind: string; text?: string }[];
        }
      ).__scAudioLog ?? [],
  );
  const spoken = log.filter((h) => h.kind === "speak").map((h) => h.text ?? "");
  const readback = spoken[spoken.lastIndexOf("Analyzing") + 1] ?? "";
  for (const t of texts) {
    expect(readback).toContain(t.charAt(0).toLowerCase() + t.slice(1));
  }
});
