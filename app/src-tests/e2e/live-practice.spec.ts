import { expect, test, type Page } from "@playwright/test";
import { onboard as freshUser } from "./helpers";

test.describe.configure({ timeout: 240_000 });

/** Complete onboarding quickly (fresh context per test). */
async function onboard(page: Page) {
  await freshUser(page, "?e2e=replay", "Looper");
}

/** Assessment → results → training plan. */
async function buildPlan(page: Page) {
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await page.getByTestId("assess-fixture-20190103_180930").click();
  await page.getByTestId("assess-start").click();
  await expect(page.getByTestId("assess-review")).toBeVisible({
    timeout: 90_000,
  });
  await page.getByTestId("assess-finish-review").click();
  await page.waitForURL("**/assess/results/**");
  await page.getByTestId("results-build-plan").click();
  await page.waitForURL("**/plan/**");
}

/** Complete the day-0 drill so the focused live item becomes "today". */
async function completeFirstDrill(page: Page) {
  await page.goto("/?e2e=replay");
  await page.getByTestId("today-card-go").click();
  await page.waitForURL(/\/drill\/.*planItem=/);
  await page.getByTestId("drill-complete").click();
  await expect(page.getByTestId("drill-complete")).toContainText("Completed");
}

test("plan live session: 3 replayed reps → feedback → summary → plan item done", async ({
  page,
}) => {
  await onboard(page);
  await buildPlan(page);
  await completeFirstDrill(page);

  // The Today card now points at the focused live-practice item.
  await page.goto("/?e2e=replay");
  await expect(page.getByTestId("today-card-title")).toContainText(
    "Focused live practice",
  );
  await page.getByTestId("today-card-go").click();
  await page.waitForURL(/\/practice\/live.*planItem=/);

  // Setup: replay-driven checks go green; focus header shows the metric.
  await expect(page.getByTestId("setup-focus")).toBeVisible();
  await expect(page.getByTestId("setup-start")).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId("setup-start").click();

  // Countdown → loop (generous: parallel workers starve wall-clock timers).
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("loop-focus")).toBeVisible();

  // The in-frame indicator reflects the replayed pose stream (full body
  // visible in the fixture) — not just the coordinator phase.
  await expect(page.getByTestId("pose-indicator")).toHaveAttribute(
    "data-state",
    "full",
    { timeout: 30_000 },
  );
  // The tracking overlay is consuming frames.
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByTestId("live-pose-overlay")
            .getAttribute("data-frame"),
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  // Rep 1: a feedback card with a numeric score and a cue.
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  const scoreText = await page.getByTestId("rep-feedback-score").textContent();
  expect(Number(scoreText)).toBeGreaterThan(0);

  // Two more replayed reps (feedback cards auto-dismiss in between).
  await expect(page.getByTestId("rep-counter")).toHaveText(/Rep 4/, {
    timeout: 120_000,
  });

  // The rep drawer lists all three reps.
  await page.getByTestId("rep-drawer-toggle").click();
  await expect(page.getByTestId("rep-row-3")).toBeVisible();

  // End → summary.
  await page.getByTestId("practice-end").click();
  await page.waitForURL("**/practice/summary/**");
  await expect(page.getByTestId("practice-summary")).toBeVisible();
  await expect(page.getByTestId("summary-rep-count")).toContainText("3 reps");
  await expect(page.getByTestId("summary-score")).toBeVisible();
  expect(
    await page.locator('[data-testid^="summary-rep-chart-bar-"]').count(),
  ).toBe(3);

  // Persists across reload.
  const summaryUrl = page.url();
  await page.reload();
  await page.waitForSelector('[data-testid="db-ready"]', {
    state: "attached",
  });
  await expect(page.getByTestId("summary-rep-count")).toContainText("3 reps");

  // Done marks the plan item complete.
  await page.getByTestId("summary-done").click();
  await page.waitForURL(/\/\?e2e=replay$/);
  await page.getByTestId("today-card-plan").click();
  await page.waitForURL("**/plan/**");
  await expect(page.getByTestId("plan-day-2")).toContainText("Done");

  // And the summary page itself survives a fresh visit.
  await page.goto(summaryUrl);
  await expect(page.getByTestId("summary-rep-count")).toContainText("3 reps");
});
