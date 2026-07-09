import { expect, test, type Page } from "@playwright/test";

/** Complete onboarding quickly (fresh context per test). */
async function onboard(page: Page) {
  await page.goto("/?e2e=replay");
  await page.waitForURL("**/onboarding**");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("Testy");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL(/\/\?e2e=replay$/);
}

test("assessment wizard: fixture → analyze → review → results, persisted", async ({
  page,
}) => {
  await onboard(page);

  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");

  // Pick the 3-shot fixture (replay mode picker).
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await expect(page.getByTestId("assess-input-list")).toContainText("3 shots");
  await page.getByTestId("assess-start").click();

  // Review shows the 3 detected shots.
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId("review-shot-0")).toBeVisible();
  await expect(page.getByTestId("review-shot-2")).toBeVisible();

  await page.getByTestId("assess-finish-review").click();

  // Results route with a numeric overall score.
  await page.waitForURL("**/assess/results/**");
  const ring = page.getByTestId("results-overall");
  await expect(ring).toBeVisible();
  const band = await ring.getAttribute("data-band");
  expect(band).not.toBe("none");

  // Exactly 3 top-issue cards, ordered by diagnosis rank.
  await expect(page.getByTestId("top-issue-0")).toBeVisible();
  await expect(page.getByTestId("top-issue-2")).toBeVisible();
  expect(await page.locator('[data-testid^="top-issue-"]').count()).toBe(3);

  // Persisted: reload the results page, score still renders from the DB.
  await page.reload();
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });
  await expect(page.getByTestId("results-overall")).toBeVisible();
  const band2 = await page
    .getByTestId("results-overall")
    .getAttribute("data-band");
  expect(band2).toBe(band);

  // Shot detail: skeleton overlay + metric table, then back to results.
  await page.getByTestId("shot-card-0").click();
  await page.waitForURL("**/progress/shot/**");
  await expect(page.getByTestId("skeleton-overlay")).toBeVisible();
  await expect(page.getByTestId("shot-metric-table")).toBeVisible();
  const frame = await page
    .getByTestId("skeleton-overlay")
    .getAttribute("data-frame");
  expect(Number(frame)).toBeGreaterThanOrEqual(0);

  await page.getByTestId("shot-detail-back").click();
  await page.waitForURL("**/assess/results/**");
  await expect(page.getByTestId("results-overall")).toBeVisible();
});
