import { expect, test } from "./fixtures";
import { onboard } from "./helpers";

/**
 * The Insights tab: time-window aggregates over the player's shots. A fresh
 * player has no shots, so it shows the empty state behind the window chips.
 */
test("insights tab shows window chips and an empty state before any shots", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Insighter");

  await page.getByTestId("tab-insights").click();
  await page.waitForURL("**/insights**");
  await expect(page.getByTestId("insights")).toBeVisible();

  await expect(page.getByTestId("window-today")).toBeVisible();
  await expect(page.getByTestId("window-7d")).toBeVisible();
  await expect(page.getByTestId("window-30d")).toBeVisible();
  await expect(page.getByTestId("window-all")).toBeVisible();

  await expect(page.getByTestId("empty-state")).toBeVisible();
});
