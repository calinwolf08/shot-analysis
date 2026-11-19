import { expect, test } from "./fixtures";
import { onboard, screenPath } from "./helpers";

/**
 * Part B, Phase 12 — the new (v3) scoring, reached through the debug tools:
 * Profile → Debug tools → Replay scoring, then load a recorded shot.
 */
const PHASES = ["Load", "Rise", "Set point", "Release"];

test("replayed shot: phase-ordered v3 scorecard, 0–10+ scale, 3 phase-named cues", async ({
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
  const card = page.getByTestId("scorecard-v3");
  await expect(card).toBeVisible({ timeout: 30_000 });

  // Phases in shot order, each with its score chip.
  const ids = await card
    .locator('[data-testid^="v3-phase-"]:not([data-testid*="score"])')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(ids).toEqual([
    "v3-phase-load",
    "v3-phase-rise",
    "v3-phase-setPoint",
    "v3-phase-release",
  ]);
  await expect(page.getByTestId("v3-legend")).toContainText("on target");
  const overall = (await page.getByTestId("v3-overall").textContent())!.trim();
  expect(
    overall === "10+" || (Number(overall) >= 0 && Number(overall) < 10),
  ).toBe(true);

  // Plain-language rows with targets.
  await expect(page.getByTestId("v3-row-load.knee_depth")).toContainText(
    "Knee bend:",
  );
  await expect(page.getByTestId("v3-row-load.knee_depth")).toContainText(
    "target",
  );

  // Spoken feedback: at most 3 cues, each group named by its phase, in order.
  const spoken =
    (await page.getByTestId("replay-readback-v3").textContent()) ?? "";
  const named = PHASES.filter((p) => spoken.includes(`${p}:`));
  expect(named.length).toBeGreaterThan(0);
  const positions = named.map((p) => spoken.indexOf(`${p}:`));
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  const cues = spoken
    .replace(/^🔊 “|”$/g, "")
    .split(/[.]\s*/)
    .filter((c) => c.trim() && !PHASES.includes(c.trim()));
  expect(cues.length).toBeLessThanOrEqual(3);
  await page.screenshot({
    path: screenPath("phase12", "replay-v3-scorecard"),
    fullPage: true,
  });
});
