import { expect, test } from "@playwright/test";

test("replay analysis backend produces the expected shot count in-browser", async ({
  page,
}) => {
  await page.goto("/__debug/analyze?e2e=replay");
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });

  await page.getByTestId("debug-analyze-run").click();
  await expect(page.getByTestId("debug-analyze-result")).toHaveText(
    "shots: 3",
    { timeout: 60_000 },
  );
});
