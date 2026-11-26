import { expect, test, type Page } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

interface Heard {
  kind: string;
  text?: string;
}

/**
 * The Feedback filter in live practice (docs/keyframe-review-plan.md): the
 * Feedback pill on the camera view opens the same sheet as shot review; the
 * choice is saved (shared with review) and applies to the card and the voice
 * from the next shot.
 */
async function lastReadback(page: Page): Promise<string | null> {
  const log = await page.evaluate(
    () => (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
  );
  const said = log.filter((h) => h.kind === "speak").map((h) => h.text ?? "");
  const i = said.lastIndexOf("Analyzing");
  return i >= 0 ? (said[i + 1] ?? null) : null;
}

test("the Feedback pill picks a focus area, and it persists", async ({
  page,
}) => {
  await onboard(page, "?e2e=replay", "Feedback");
  await startLiveLoop(page);
  const pill = page.getByTestId("practice-feedback");
  await expect(pill).toContainText("All feedback");

  await pill.click();
  await expect(page.getByTestId("feedback-sheet")).toBeVisible();
  await page.getByTestId("feedback-preset-set-point").click();
  await page.getByTestId("feedback-done").click();
  await expect(pill).toContainText("Set point");

  // Survives a reload (stored in settings, shared with shot review).
  await page.reload();
  await startLiveLoop(page);
  await expect(page.getByTestId("practice-feedback")).toContainText(
    "Set point",
  );

  // Pick checks: turning one check off makes it a custom set.
  await page.getByTestId("practice-feedback").click();
  await page.getByTestId("feedback-tab-pick").click();
  await page.getByTestId("feedback-chip-rise.hand_height").click();
  await page.getByTestId("feedback-done").click();
  await expect(page.getByTestId("practice-feedback")).toContainText("Custom");
});

test("Leg drive: the card and the voice only cover knees and hips", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Legs");
  await startLiveLoop(page);
  await page.getByTestId("practice-feedback").click();
  await page.getByTestId("feedback-preset-legs").click();
  await page.getByTestId("feedback-done").click();
  await expect(page.getByTestId("practice-feedback")).toContainText(
    "Leg drive",
  );

  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  for (const t of await page.getByTestId("feedback-item").allTextContents()) {
    expect(t.trim()).toMatch(
      /^(Load|Rise|Set point|Release)\s+(Knees|Hips) too /,
    );
  }
  await expect
    .poll(() => lastReadback(page))
    .toMatch(
      /^((In the load|When the ball reaches set point|At set point|At release): ((knees|hips) too [^,.]+ by (\d|10\+)(, )?)+\.( |$))+$|^Focus on target$/,
    );
});
