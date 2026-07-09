import { expect, test } from "@playwright/test";

test("app boots with no console errors (fresh profile → onboarding)", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });

  // A fresh profile is redirected into onboarding.
  await page.waitForURL("**/onboarding");
  await expect(page.getByTestId("onboarding-slide-0")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
