import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { apiGet, onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Part B, Phase 14 — live scoring runs on the v3 metrics, and shots saved
 * before v3 are re-analyzed from their stored pose track the first time
 * they're read (then saved, so it happens once).
 */

interface ShotJson {
  id: string;
  analysis: { v3Metrics?: { schemaVersion: number } } & Record<string, unknown>;
}

/** PATCH an app API route as the signed-in user. */
function apiPatch(page: Page, path: string, body: unknown): Promise<void> {
  return page.evaluate(
    async ({ p, b }) => {
      const token = localStorage.getItem("shotcoach.bearer_token");
      const res = await fetch(p, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(b),
      });
      if (!res.ok) throw new Error(`${p} → HTTP ${res.status}`);
    },
    { p: path, b: body },
  );
}

test("a pre-v3 shot is re-analyzed on read, saved, and shows the v3 scorecard + Insights", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await onboard(page, "?e2e=replay", "Migrator");
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });

  await page.getByTestId("tab-shots").click();
  const row = page.locator('button[data-testid^="shot-row-"]').first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const id = (await row.getAttribute("data-testid"))!.replace("shot-row-", "");

  // Live stored v3 with the shot.
  const live = await apiGet<ShotJson>(page, `/api/shots/${id}`);
  expect(live.analysis.v3Metrics?.schemaVersion).toBe(4);

  // Turn it into a shot saved before v3 (metrics schema 1).
  const { v3Metrics: _drop, ...v1 } = live.analysis;
  await apiPatch(page, `/api/shots/${id}`, { analysis: v1 });
  const old = await apiGet<ShotJson>(page, `/api/shots/${id}`);
  expect(old.analysis.v3Metrics).toBeUndefined();

  // Reading the Shots list re-analyzes it: the row names a phase-labelled
  // issue (or "On target"), never "Re-analysis unavailable".
  await page.reload();
  await expect(page.getByTestId(`shot-row-${id}`)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(`shot-row-${id}`)).not.toContainText(
    "Re-analysis unavailable",
  );
  await expect(
    page.getByTestId(`shot-row-${id}`).getByTestId("shot-label"),
  ).toContainText(/(Load|Rise|Set point|Release): |On target/);
  // …and saves the result (current metrics schema on the server).
  await expect
    .poll(
      async () =>
        (await apiGet<ShotJson>(page, `/api/shots/${id}`)).analysis.v3Metrics
          ?.schemaVersion ?? null,
    )
    .toBe(4);

  // Review shows the v3 scorecard, phases in order.
  await page.getByTestId(`shot-row-${id}`).click();
  await expect(page.getByTestId("scorecard-v3")).toBeVisible();
  const phases = await page
    .locator('[data-testid^="v3-phase-"]:not([data-testid*="score"])')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(phases).toEqual([
    "v3-phase-load",
    "v3-phase-rise",
    "v3-phase-setPoint",
    "v3-phase-release",
  ]);
  // The current phase's worst issue is drawn on the pose.
  const scrubber = page.getByTestId("review-scrubber");
  await expect(page.getByTestId("review-phase")).toBeVisible();
  await page.screenshot({ path: screenPath("phase14", "1-review-v3") });

  // Clicking a metric seeks to where it was measured.
  const firstRow = page
    .locator('[data-testid^="v3-row-"] button:not(:disabled)')
    .first();
  const before = await scrubber.inputValue();
  await page
    .locator('[data-testid^="v3-row-release."] button:not(:disabled)')
    .first()
    .click();
  await expect(scrubber).not.toHaveValue(before);
  await expect(page.getByTestId("review-phase")).toHaveText(
    /Set point|Release/,
  );
  await firstRow.click();
  await expect(page.getByTestId("review-phase")).toHaveText(/Load|Rise/);

  // Insights ranks recurring issues by their v3 ids, named by phase.
  await page.getByTestId("tab-insights").click();
  await page.getByTestId("window-all").click();
  await expect(page.getByTestId("insights-issues")).toBeVisible();
  const issues = page.locator('[data-testid^="issue-"]');
  if ((await issues.count()) > 0) {
    const ids = await issues.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid")!.replace("issue-", "")),
    );
    for (const i of ids) {
      expect(i).toMatch(/^(load|rise|setPoint|release)\./);
    }
    await expect(issues.first()).toContainText(
      /(Load|Rise|Set point|Release):/,
    );
  }
  await page.screenshot({ path: screenPath("phase14", "2-insights-v3") });
});
