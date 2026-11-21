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
    // "<phase> <body part> <fault> by <n>", e.g. "Load Spine forward by 3".
    expect(t.trim()).toMatch(
      /^(Load|Rise|Set point|Release)\s+[A-Z][^:]* by (\d|10\+)$/,
    );
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

test("feedback wording comes from the editable config file (card + voice)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Serve an edited wording file: every phrase becomes "ZZ <id>" and the
  // format changes — the card and the spoken readback must follow it.
  await page.route("**/config/feedback-wording.json", async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as {
      metrics: Record<string, { low: string; high: string }>;
    };
    for (const [id, m] of Object.entries(json.metrics)) {
      m.low = `ZZ ${id} low`;
      m.high = `ZZ ${id} high`;
    }
    await route.fulfill({
      json: { ...json, format: "{phrase} score {n}" },
    });
  });
  await onboard(page, "?e2e=replay", "Wording");
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  const items = await page.getByTestId("feedback-item").allTextContents();
  expect(items.length).toBeGreaterThan(0);
  for (const t of items) {
    expect(t).toMatch(/ZZ \S+ (low|high) score (\d|10\+)$/);
  }
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
      const said = log.filter((h) => h.kind === "speak").map((h) => h.text);
      const i = said.lastIndexOf("Analyzing");
      return i >= 0 ? (said[i + 1] ?? "") : "";
    })
    .toMatch(/^(Load|Rise|Set point|Release): ZZ .+ score (\d|10\+)\./);
});
