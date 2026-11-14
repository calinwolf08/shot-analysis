import { expect, test } from "./fixtures";
import { signUp } from "./helpers";

test("fresh app onboards, persists the player, and stays onboarded", async ({
  page,
}) => {
  // Fresh profile: create an account, then the guard lands on onboarding.
  await signUp(page, "", "jordan");
  await expect(page.getByTestId("onboarding-slide-0")).toBeVisible();

  // Three intro slides.
  await page.getByTestId("onboarding-next").click();
  await expect(page.getByTestId("onboarding-slide-1")).toBeVisible();
  await page.getByTestId("onboarding-next").click();
  await expect(page.getByTestId("onboarding-slide-2")).toBeVisible();
  await page.getByTestId("onboarding-next").click();

  // Player form.
  await expect(page.getByTestId("onboarding-form")).toBeVisible();
  const next = page.getByTestId("onboarding-to-camera");
  await expect(next).toBeDisabled(); // name required
  await page.getByTestId("onboarding-name").fill("Jordan");
  await page.getByTestId("onboarding-hand-left").click();
  await page.getByTestId("onboarding-level-high-school").click();
  await next.click();

  // Camera tutorial → finish.
  await expect(page.getByTestId("onboarding-camera")).toBeVisible();
  await page.getByTestId("onboarding-finish").click();

  // Lands on the Practice tab (the live-first entry).
  await page.waitForURL("**/practice**");
  await expect(page.getByTestId("tab-practice")).toBeVisible();
  await expect(page.getByTestId("practice-live")).toBeVisible();

  // Reload → still onboarded (persisted), back on Practice.
  await page.reload();
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });
  await expect(page).not.toHaveURL(/onboarding/);
  await expect(page.getByTestId("practice-live")).toBeVisible();

  // Handedness visible in Profile.
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("profile-hand")).toHaveText("Left");
  await expect(page.getByTestId("profile-level")).toHaveText("high-school");
  await expect(page.getByTestId("placeholder-badge")).toBeVisible();
});
