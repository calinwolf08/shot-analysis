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

  // No local video in CI: skeleton-only, with the file picker offered.
  await expect(page.getByTestId("ref-video-pick")).toBeVisible();
});
