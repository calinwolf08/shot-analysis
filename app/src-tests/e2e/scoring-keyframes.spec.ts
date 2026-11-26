import { expect, test } from "./fixtures";
import { onboard, screenPath } from "./helpers";

/**
 * Keyframe scoring (docs/keyframe-review-plan.md), reached through the debug
 * tools: Profile → Debug tools → Replay scoring, then load a recorded shot.
 */
const LEAD_INS = [
  "At setup:",
  "In the load:",
  "When the ball reaches set point:",
  "At set point:",
  "At release:",
];

test("replayed shot: keyframe scorecard in shot order, 0–10+ scale, readback in the card's words", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Scorer");
  await page.getByTestId("tab-profile").click();
  await page.getByTestId("debug-tools-link").click();
  await page.getByTestId("debug-link-replay").click();

  await page
    .locator('input[type="file"]')
    .setInputFiles("src-tests/fixtures/poses/20201212_134104.json");
  const card = page.getByTestId("scorecard-keyframes");
  await expect(card).toBeVisible({ timeout: 30_000 });

  // Keyframes in shot order, each with its score chip.
  const ids = await card
    .locator('[data-testid^="kf-phase-"]:not([data-testid*="score"])')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(ids).toEqual([
    "kf-phase-setup",
    "kf-phase-load",
    "kf-phase-rise",
    "kf-phase-setPoint",
    "kf-phase-release",
  ]);
  const overall = (await page.getByTestId("kf-overall").textContent())!.trim();
  expect(
    overall === "10+" || (Number(overall) >= 0 && Number(overall) < 10),
  ).toBe(true);

  // Rows in the card's words: "<part> too <direction> by N" or in range.
  await expect(page.getByTestId("kf-row-rise.knee_bend")).toContainText(
    /Knees too (bent|straight) by (\d|10\+)|Knee bend: (in range|not measured)/,
  );
  const rows = await card
    .locator('[data-testid^="kf-row-"]')
    .evaluateAll((els) => els.map((e) => e.textContent ?? ""));
  expect(rows).toHaveLength(33);
  for (const t of rows) expect(t).not.toMatch(/°|%|length/);

  // Spoken feedback: keyframe lead-ins in shot order, at most 3 checks.
  // (Absent when nothing is off: "On target — nothing to call out.")
  const readback = page.getByTestId("replay-readback");
  const spoken =
    (await readback.count()) > 0 ? ((await readback.textContent()) ?? "") : "";
  const named = LEAD_INS.filter((p) => spoken.includes(p));
  const positions = named.map((p) => spoken.indexOf(p));
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect((spoken.match(/ by (\d|10\+)/g) ?? []).length).toBeLessThanOrEqual(3);
  await page.screenshot({
    path: screenPath("keyframes", "replay-keyframe-scorecard"),
    fullPage: true,
  });
});
