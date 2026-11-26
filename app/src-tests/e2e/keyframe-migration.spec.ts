import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { apiGet, onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Keyframe checks (docs/keyframe-review-plan.md): live stores them with each
 * shot, and shots saved before them are re-analyzed from their stored pose
 * track the first time they're read (then saved, so it happens once).
 */

interface ShotJson {
  id: string;
  analysis: {
    keyframes?: { schemaVersion: number };
    v3Metrics?: { schemaVersion: number };
  } & Record<string, unknown>;
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

test("an older shot gets its keyframe checks on read, saved, and shows them in review + Insights", async ({
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

  // Live stored the keyframe checks with the shot.
  const live = await apiGet<ShotJson>(page, `/api/shots/${id}`);
  expect(live.analysis.keyframes?.schemaVersion).toBe(4);

  // Turn it into a shot saved before the keyframe checks (and before v3).
  const { keyframes: _k, v3Metrics: _v3, ...old } = live.analysis;
  await apiPatch(page, `/api/shots/${id}`, { analysis: old });
  expect(
    (await apiGet<ShotJson>(page, `/api/shots/${id}`)).analysis.keyframes,
  ).toBeUndefined();

  // Reading the Shots list re-analyzes it: the row names a keyframe-labelled
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
  ).toContainText(
    /(Setup|Load|Rise|Set point|Release): .+ too .+ by |On target/,
  );
  // …and saves the result.
  await expect
    .poll(
      async () =>
        (await apiGet<ShotJson>(page, `/api/shots/${id}`)).analysis.keyframes
          ?.schemaVersion ?? null,
    )
    .toBe(4);

  // Review draws the checks at each keyframe.
  await page.getByTestId(`shot-row-${id}`).click();
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
  await page.getByTestId("review-icon-release").click();
  await expect(page.getByTestId("review-phase")).toHaveText("Release");
  await expect(page.getByTestId("review-callout")).toBeVisible();
  await page.screenshot({ path: screenPath("keyframes", "migrated-review") });

  // Insights ranks recurring issues by their check ids, named by keyframe.
  await page.getByTestId("tab-insights").click();
  await page.getByTestId("window-all").click();
  await expect(page.getByTestId("insights-issues")).toBeVisible();
  const issues = page.locator('[data-testid^="issue-"]');
  if ((await issues.count()) > 0) {
    const ids = await issues.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid")!.replace("issue-", "")),
    );
    for (const i of ids) {
      expect(i).toMatch(/^(setup|load|rise|setPoint|release)\./);
    }
    await expect(issues.first()).toContainText(
      /(Setup|Load|Rise|Set point|Release):/,
    );
  }
  await page.screenshot({ path: screenPath("keyframes", "insights") });
});
