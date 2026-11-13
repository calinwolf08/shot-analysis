import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

/**
 * The live-practice setup + angle gate. Lighting/stability auto-pass in replay
 * (no camera); full-body flips as the replayed pose streams in. The "shooting
 * arm toward camera" check requires the exact side-on orientation for the
 * player's hand — the replay fixture isn't it, so the gate holds Start until the
 * user overrides, then the loop begins.
 */
test("live setup: the angle gate holds Start until the side check passes", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "LiveTester");

  await page.getByTestId("practice-live").click();
  await page.waitForURL("**/practice/live**");
  await expect(page.getByTestId("live-setup")).toBeVisible();

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

  // The angle gate (side-view) does not pass for an off-side fixture, so Start
  // stays disabled until it's satisfied or overridden.
  await expect(page.getByTestId("check-side-view")).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page.getByTestId("setup-start")).toBeDisabled();

  await page.getByTestId("override-side-view").click();
  await expect(page.getByTestId("setup-start")).toBeEnabled();
  await page.getByTestId("setup-start").click();

  await expect(page.getByTestId("setup-countdown")).toBeVisible();
  await expect(page.getByTestId("practice-loop")).toBeVisible({
    timeout: 30_000,
  });
});
