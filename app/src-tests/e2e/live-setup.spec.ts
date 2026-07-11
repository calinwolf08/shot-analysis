import { expect, test, type Page } from "@playwright/test";
import { onboard as freshUser } from "./helpers";

/** Complete onboarding quickly (fresh context per test). */
async function onboard(page: Page) {
  await freshUser(page, "?e2e=replay", "LiveTester");
}

test("live setup reaches all-green from replayed pose and starts a session", async ({
  page,
}) => {
  await onboard(page);

  await page.getByTestId("go-live-practice").click();
  await page.waitForURL("**/practice/live**");
  await expect(page.getByTestId("live-setup")).toBeVisible();

  // No camera in replay mode → lighting/stability pass immediately;
  // full-body and side-view flip as the replayed fixture pose streams in.
  await expect(page.getByTestId("check-lighting")).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("check-stability")).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("check-full-body")).toHaveAttribute(
    "data-state",
    "pass",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("check-side-view")).toHaveAttribute(
    "data-state",
    "pass",
    { timeout: 20_000 },
  );

  const start = page.getByTestId("setup-start");
  await expect(start).toBeEnabled();
  await start.click();

  // 3-2-1 countdown, then the session hand-off.
  await expect(page.getByTestId("setup-countdown")).toBeVisible();
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
});
