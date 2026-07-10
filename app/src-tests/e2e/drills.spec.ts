import { expect, test } from "@playwright/test";

// The drill catalog seeds at boot; __debug routes bypass onboarding.
test("drill catalog: list, open a drill, play surface, mark complete", async ({
  page,
}) => {
  await page.goto("/__debug/drills?e2e=replay");
  await page.waitForSelector('[data-testid="db-ready"]', {
    state: "attached",
  });

  // All 12 seeded drills are listed.
  const items = page.locator('[data-testid="debug-drill-list"] li');
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBe(12);

  // Open one drill.
  await page.getByTestId("debug-drill-guide-hand-discipline").click();
  await page.waitForURL("**/drill/**");
  await expect(page.getByTestId("drill-player")).toBeVisible();

  // Placeholder video + badge + coaching content.
  const video = page.getByTestId("drill-video");
  await expect(video).toBeVisible();
  expect(await video.getAttribute("src")).toContain("placeholder.webm");
  await expect(page.getByTestId("placeholder-badge")).toBeVisible();
  await expect(page.getByTestId("drill-coaching-points")).toBeVisible();
  await expect(page.getByTestId("drill-fixes")).toContainText("Guide hand");

  // The placeholder asset actually resolves (not a 404 fallback page).
  const res = await page.request.get("/drills/placeholder.webm");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("webm");

  // Mark complete (standalone — no plan item yet).
  await page.getByTestId("drill-complete").click();
  await expect(page.getByTestId("drill-complete")).toBeDisabled();
  await expect(page.getByTestId("drill-complete")).toContainText("Completed");
});
