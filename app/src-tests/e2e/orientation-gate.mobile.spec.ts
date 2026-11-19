import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { apiGet, onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Phase 3 — only shots from the shooting-arm side are scored and stored.
 * A right-handed player (onboarding default) must be "side-right".
 */

interface Heard {
  t: number;
  kind: string;
  text?: string;
}
const WRONG_ANGLE = "Wrong angle, shot not counted";

const spoken = async (page: Page) =>
  (
    await page.evaluate(
      () =>
        (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
    )
  ).filter((e) => e.kind === "speak");

async function storedShots(page: Page) {
  const player = await apiGet<{ id: string }>(page, "/api/players/current");
  return apiGet<{ id: string; orientation: string | null }[]>(
    page,
    `/api/shots?playerId=${player.id}&includeExcluded=true`,
  );
}

test("mixed-angle session: wrong-angle shots are announced and never stored", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Labeled shots in this fixture: side-left, behind-left ×2, behind,
  // behind-right, side-right ×2. No fake camera → no positioning gate, so
  // every motion reaches analysis and the per-shot orientation check decides.
  await onboard(page, "?e2e=replay&replayFixture=20190804_140654", "Mixed");
  await startLiveLoop(page);

  await expect(page.getByTestId("practice-wrong-angle")).toBeVisible({
    timeout: 60_000,
  });
  await page.screenshot({ path: screenPath("phase3", "wrong-angle-flash") });
  await expect
    .poll(async () => (await spoken(page)).map((s) => s.text), {
      timeout: 30_000,
    })
    .toContain(WRONG_ANGLE);

  // Let the rest of the fixture play through once, then stop practicing so
  // nothing new is recorded while we count.
  await page.waitForTimeout(15_000);
  await page.getByTestId("tab-shots").click();
  // A shot already being scored as we left may still land; let it settle,
  // then reload the list so it and the API agree.
  await page.waitForTimeout(2_000);
  await page.reload();

  const shots = await storedShots(page);
  expect(shots.length).toBeGreaterThanOrEqual(1);
  expect(shots.every((s) => s.orientation === "side-right")).toBe(true);
  const rejectedCount = (await spoken(page)).filter(
    (s) => s.text === WRONG_ANGLE,
  ).length;
  test.info().annotations.push({
    type: "gate",
    description: `stored=${shots.length} rejected=${rejectedCount}`,
  });

  // The Shots tab lists only those, labeled by time + issue (no orientation).
  await expect(
    page.locator('[data-testid^="shot-row-"]').first(),
  ).toBeVisible();
  await expect(page.locator('[data-testid^="shot-row-"]')).toHaveCount(
    shots.length,
  );
  await expect(page.getByTestId("shot-day-label").first()).toHaveText(/today/i);
  const labels = await page.getByTestId("shot-label").allTextContents();
  for (const l of labels) {
    expect(l).not.toMatch(/side|front|behind/i);
    expect(l).toMatch(/\d{1,2}:\d{2}/);
  }
  await page.screenshot({ path: screenPath("phase3", "shots-list") });
});

test("positioning gate: shots only start once side-on with the shooting arm toward the camera", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Guide arm toward the camera for 8 s (gate unarmed), then the side-right
  // fixture (one real shot, looping).
  await onboard(
    page,
    "?e2e=replay&fakecam=1&debug=live&replaySpeed=1&replayScript=wrongside:8",
    "Armed",
  );
  await startLiveLoop(page);

  await expect(page.getByTestId("readiness-cue")).toBeVisible();
  // While the wrong side faces the camera, no rep starts.
  await page.waitForTimeout(6_000);
  await expect(page.getByTestId("live-debug-log")).not.toContainText(
    "rep started",
  );

  // Once positioned (fixture is side-right), the shot is detected + stored.
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  const shots = await storedShots(page);
  expect(shots.length).toBeGreaterThanOrEqual(1);
  expect(shots.every((s) => s.orientation === "side-right")).toBe(true);
});
