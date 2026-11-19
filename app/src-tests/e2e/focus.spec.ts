import { expect, test, type Page } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

interface Heard {
  kind: string;
  text?: string;
}

/**
 * Live focus: the player toggles which areas the lesson coaches, from the 🎯
 * chip overlaid on the camera in the Practice tab. The choice persists and is
 * changeable mid-session.
 *
 * Settings are per user (each test signs up a fresh account, so it starts from
 * "everything"); each test still clears first, as a known starting point.
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

test("focus chip on the camera view sets focus, and it persists", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Focus");
  await startLiveLoop(page);

  await page.getByTestId("focus-chip").click();
  await clearFocus(page);
  await page.getByTestId("focus-area-set-point").click();
  await expect(page.getByTestId("focus-note")).toContainText("Focusing on 1");
  await dismissSheet(page);
  await expect(page.getByTestId("focus-chip")).toContainText("Set point");

  // Survives a reload (stored in settings).
  await page.reload();
  await startLiveLoop(page);
  await expect(page.getByTestId("focus-chip")).toContainText("Set point");
});

test("focus is changeable mid-session", async ({ page }) => {
  await onboard(page, "?e2e=replay", "Focus2");
  await startLiveLoop(page);

  await page.getByTestId("focus-chip").click();
  await clearFocus(page);
  await page.getByTestId("focus-area-release").click();
  await dismissSheet(page);
  await expect(page.getByTestId("focus-chip")).toContainText("Release");

  // Add a second area → "+1".
  await page.getByTestId("focus-chip").click();
  await page.getByTestId("focus-area-rise").click();
  await dismissSheet(page);
  await expect(page.getByTestId("focus-chip")).toContainText("+1");
});

test("focus on Rise: the feedback and voice coach only the rise", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Focus3");
  await startLiveLoop(page);
  await page.getByTestId("focus-chip").click();
  await clearFocus(page);
  await page.getByTestId("focus-area-rise").click();
  await dismissSheet(page);
  await expect(page.getByTestId("focus-chip")).toContainText("Rise");

  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  // Every item shown is a Rise item.
  const phases = await page
    .locator('[data-testid="feedback-item"] .chip-phase')
    .allTextContents();
  for (const p of phases) expect(p.trim()).toBe("Rise");

  // And the readback (what's said after "Analyzing") only coaches the rise.
  await expect
    .poll(async () => {
      const log = await page.evaluate(
        () =>
          (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
      );
      const said = log.filter((h) => h.kind === "speak").map((h) => h.text);
      const i = said.lastIndexOf("Analyzing");
      return i >= 0 ? (said[i + 1] ?? null) : null;
    })
    .toMatch(/^(Rise: [^:]+|Focus on target)$/);
});
