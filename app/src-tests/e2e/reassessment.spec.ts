import { expect, test, type Page } from "@playwright/test";
import { onboard as freshUser } from "./helpers";

test.describe.configure({ timeout: 240_000 });

/** Complete onboarding quickly (fresh context per test). */
async function onboard(page: Page) {
  await freshUser(page, "?e2e=replay", "Retester");
}

async function runFixtureAssessment(page: Page) {
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await page.getByTestId("assess-start").click();
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await page.getByTestId("assess-finish-review").click();
  await page.waitForURL("**/assess/results/**");
}

test("reassessment item → deltas → adapted plan supersedes the old one", async ({
  page,
}) => {
  await onboard(page);

  // Assessment #1 → first plan.
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await runFixtureAssessment(page);
  expect(await page.getByTestId("delta-strip").count()).toBe(0); // no prior
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
  const plan1Url = page.url();

  // Launch the plan's terminal reassessment item (always startable).
  const reassessButton = page
    .getByTestId("plan-day-13")
    .getByRole("button", { name: "Re-assess" });
  await expect(reassessButton).toBeEnabled();
  await reassessButton.click();
  await page.waitForURL(/\/assess.*planItem=/);

  // Assessment #2 through the wizard, tagged with the plan item.
  await runFixtureAssessment(page);

  // Delta strip appears (same fixture → deltas of 0, still rendered).
  await expect(page.getByTestId("delta-strip")).toBeVisible();
  await expect(page.getByTestId("delta-overall")).toBeVisible();
  expect(
    await page.locator('[data-testid^="delta-focus-"]').count(),
  ).toBeGreaterThan(0);

  // CTA reads "next" and builds the adapted plan.
  await expect(page.getByTestId("results-build-plan")).toContainText(
    "next training plan",
  );
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
  const plan2Url = page.url();
  expect(plan2Url).not.toBe(plan1Url);
  await expect(page.getByTestId("plan-overview")).toBeVisible();
  await expect(page.getByTestId("plan-day-13")).toContainText("Re-assessment");

  // The Home Today card now serves the new plan.
  await page.goto("/?e2e=replay");
  await expect(page.getByTestId("today-card")).toBeVisible();
  await page.getByTestId("today-card-plan").click();
  await page.waitForURL("**/plan/**");
  expect(new URL(page.url()).pathname).toBe(new URL(plan2Url).pathname);
});
