import { expect, test } from "./fixtures";
import { onboard, screenPath } from "./helpers";

/**
 * Part B, Phase 9 — debug tools index + Curry model viewer, reached the way a
 * person would: Profile → "Debug tools" → "Curry model viewer". (The Profile
 * link and these pages are absent from production builds — enforced by
 * scripts/check-debug-stripped.mjs.)
 */
test("Profile → Debug tools → Curry viewer: table, cell seek, shot tabs", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Auditor");

  await page.getByTestId("tab-profile").click();
  await page.getByTestId("debug-tools-link").click();
  await expect(page.getByTestId("debug-index")).toBeVisible();
  for (const tool of [
    "reference",
    "replay",
    "scorecard",
    "analyze",
    "drills",
  ]) {
    await expect(page.getByTestId(`debug-link-${tool}`)).toBeVisible();
  }
  await page.screenshot({ path: screenPath("phase9", "1-debug-index") });

  await page.getByTestId("debug-link-reference").click();
  await expect(page.getByTestId("reference-viewer")).toBeVisible();
  const table = page.getByTestId("ref-table");
  await expect(table).toBeVisible({ timeout: 30_000 });

  // 7 shot columns + metric/mean/band/SD.
  await expect(table.locator("thead th")).toHaveCount(7 + 4);
  // Default view: the new v3 catalog. Today's v2 targets are one tap away.
  await expect(page.getByTestId("catalog-v3")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("ref-row-setPoint.elbow_angle")).toBeVisible();
  await page.screenshot({
    path: screenPath("phase11", "v3-catalog"),
    fullPage: true,
  });
  await page.getByTestId("catalog-v2").click();
  // The set-point elbow angle row shows a value for every shot.
  const row = page.getByTestId("ref-row-setPoint.elbow_angle");
  await expect(row.locator("button.cell")).toHaveCount(7);
  await expect(row.locator("button.cell.missing")).toHaveCount(0);

  // Clicking a cell selects that shot and seeks to where it was measured.
  await page.getByTestId("cell-setPoint.elbow_angle-3").click();
  await expect(page.getByTestId("ref-shot-4")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const sel = page.getByTestId("ref-selected");
  await expect(sel).toContainText("Elbow angle");
  await expect(sel).toContainText("Shot 4");
  const frameText = (await sel.textContent()) ?? "";
  const measuredAt = Number(/at frame (\d+)/.exec(frameText)?.[1]);
  await expect(page.getByTestId("ref-scrubber")).toHaveValue(
    String(measuredAt),
  );
  await expect(page.getByTestId("ref-skeleton")).toHaveAttribute(
    "data-frame",
    String(measuredAt),
  );
  await page.screenshot({
    path: screenPath("phase9", "2-viewer-cell-selected"),
    fullPage: true,
  });

  // Shot tabs move the scrubber to that shot's labeled start.
  await page.getByTestId("ref-shot-1").click();
  await expect(page.getByTestId("ref-frame")).toContainText("frame 35");

  // Phase 10: v3 events vs the human labels for the selected shot.
  const events = page.getByTestId("ref-events");
  await expect(events.locator("tbody tr")).toHaveCount(8);
  await expect(page.getByTestId("mk-det-setPoint")).toBeVisible();
  await expect(page.getByTestId("mk-lab-setPoint")).toBeVisible();
  // Hiding labels leaves only the detected markers.
  await page.getByTestId("ref-show-labels").uncheck();
  await expect(page.getByTestId("mk-lab-setPoint")).toHaveCount(0);
  await expect(page.getByTestId("mk-det-setPoint")).toBeVisible();
  await page.getByTestId("ref-show-labels").check();
  // Clicking an event row seeks to its detected frame.
  const detected = Number(
    await page.getByTestId("ev-setPoint").locator("td").nth(1).textContent(),
  );
  await page.getByTestId("ev-setPoint").click();
  await expect(page.getByTestId("ref-scrubber")).toHaveValue(
    String(Math.round(detected)),
  );
  await page.screenshot({
    path: screenPath("phase10", "events-vs-labels"),
    fullPage: false,
  });

  // No local video in CI: skeleton-only, with the file picker offered.
  await expect(page.getByTestId("ref-video-pick")).toBeVisible();
});
