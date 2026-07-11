import { expect, test } from "@playwright/test";

test("app boots with no console errors (fresh profile → sign-in)", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });

  // A fresh (signed-out) profile is redirected to sign-in.
  await page.waitForURL("**/auth/sign-in");
  await expect(page.getByTestId("auth-sign-in")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
