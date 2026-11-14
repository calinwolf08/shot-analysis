import { expect, test, type Page } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

/**
 * Live focus: the player toggles which areas the lesson coaches. Picker is on
 * the Practice tab and in the live loop header (same sheet), the choice
 * persists, and it's changeable mid-session.
 *
 * Settings are device-global (like voice feedback), so each test first resets
 * the selection to "everything" for a known starting point.
 */
async function clearFocus(page: Page) {
  const clear = page.getByTestId("focus-clear");
  if (await clear.isEnabled()) await clear.click();
  await expect(page.getByTestId("focus-note")).toContainText("everything");
}

function dismissSheet(page: Page) {
  // The sheet covers the backdrop's center; click its exposed top edge.
  return page
    .getByTestId("sheet-backdrop")
    .click({ position: { x: 10, y: 10 } });
}

test("focus picker on the Practice tab persists the selection", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Focus");

  await page.getByTestId("focus-row").click();
  await clearFocus(page);
  await page.getByTestId("focus-area-set-point").click();
  await expect(page.getByTestId("focus-note")).toContainText("Focusing on 1");
  await dismissSheet(page);
  await expect(page.getByTestId("focus-value")).toContainText("Set point");

  // Survives a reload (stored in settings).
  await page.reload();
  await page.getByTestId("tab-practice").waitFor();
  await expect(page.getByTestId("focus-value")).toContainText("Set point");
});

test("focus chip in the live loop reflects and changes focus", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Focus2");

  // Pick a single focus on the Practice tab first.
  await page.getByTestId("focus-row").click();
  await clearFocus(page);
  await page.getByTestId("focus-area-release").click();
  await dismissSheet(page);
  await expect(page.getByTestId("focus-value")).toHaveText(/Release/);

  // Enter the loop — the header chip reflects it.
  await page.getByTestId("practice-live").click();
  await startLiveLoop(page);
  await expect(page.getByTestId("focus-chip")).toContainText("Release");

  // Change it mid-session: add a second area → "+1".
  await page.getByTestId("focus-chip").click();
  await page.getByTestId("focus-area-follow-through").click();
  await dismissSheet(page);
  await expect(page.getByTestId("focus-chip")).toContainText("+1");
});
