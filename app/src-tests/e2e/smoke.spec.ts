import { expect, test } from "@playwright/test";

test("app loads with ShotCoach visible and no console errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ShotCoach" }).first(),
  ).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
