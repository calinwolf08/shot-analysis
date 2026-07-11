import { expect, test, type Page } from "@playwright/test";
import { onboard as freshUser } from "./helpers";

test.describe.configure({ timeout: 240_000 });

/** Complete onboarding quickly (fresh context per test). */
async function onboard(page: Page) {
  await freshUser(page, "?e2e=replay", "Tracker");
}

async function runAssessment(page: Page) {
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await page.getByTestId("assess-start").click();
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await page.getByTestId("assess-finish-review").click();
  await page.waitForURL("**/assess/results/**");
  // Leave via Done (no plan needed here).
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForURL(/\/\?e2e=replay$/);
}

/** One-rep standalone live session, ended at the summary. */
async function runLiveSession(page: Page) {
  await page.getByTestId("go-live-practice").click();
  await page.waitForURL("**/practice/live**");
  await expect(page.getByTestId("setup-start")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("setup-start").click();
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("rep-counter")).toHaveText(/Rep 2/, {
    timeout: 60_000,
  });
  await page.getByTestId("practice-end").click();
  await page.waitForURL("**/practice/summary/**");
  await page.getByTestId("summary-done").click();
  await page.waitForURL(/\/\?e2e=replay$/);
}

test("progress shows history, charts, and totals after two sessions", async ({
  page,
}) => {
  await onboard(page);
  await runAssessment(page);
  await runLiveSession(page);

  await page.getByTestId("tab-progress").click();
  await page.waitForURL("**/progress**");
  await expect(page.getByTestId("progress-dashboard")).toBeVisible();

  // Two completed sessions in history and on the chart.
  const links = page.locator('[data-testid="progress-history"] a');
  expect(await links.count()).toBe(2);
  await expect(page.getByTestId("progress-score-chart-point-0")).toBeVisible();
  await expect(page.getByTestId("progress-score-chart-marker-0")).toBeVisible(); // the assessment is ringed

  // Totals reflect both sessions.
  await expect(page.getByTestId("progress-totals")).toContainText("sessions");
  await expect(page.getByTestId("progress-streak")).toHaveText(/[1-9]/);

  // Metric explorer plots a trend against the benchmark band.
  await page.getByTestId("progress-metric-picker").selectOption("kneeFlexion");
  await expect(page.getByTestId("progress-metric-chart")).toBeVisible();

  // History → session detail → shot detail chain works.
  await links.first().click();
  await page.waitForURL("**/progress/session/**");
  await expect(page.getByTestId("session-detail")).toBeVisible();
  await expect(page.getByTestId("session-detail-score")).toBeVisible();
});
