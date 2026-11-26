import { expect, test } from "./fixtures";
import { onboard, startLiveLoop } from "./helpers";

/**
 * Settings are per user (server migration 007): one account's feedback filter or voice
 * choice never changes another's. And Profile → "Voice feedback" off makes
 * practice start muted.
 */

test("the feedback filter is per user", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Alice");
  await startLiveLoop(page);
  await page.getByTestId("practice-feedback").click();
  await page.getByTestId("feedback-preset-legs").click();
  await page.getByTestId("feedback-done").click();
  await expect(page.getByTestId("practice-feedback")).toContainText(
    "Leg drive",
  );

  // Another account (its own browser) starts from "All feedback"…
  const context = await browser.newContext();
  const other = await context.newPage();
  await onboard(other, "?e2e=replay", "Bob");
  await startLiveLoop(other);
  await expect(other.getByTestId("practice-feedback")).toContainText(
    "All feedback",
  );
  await other.getByTestId("practice-feedback").click();
  await other.getByTestId("feedback-preset-release").click();
  await other.getByTestId("feedback-done").click();
  await expect(other.getByTestId("practice-feedback")).toContainText("Release");
  await context.close();

  // …and Bob's choice didn't change Alice's.
  await page.reload();
  await startLiveLoop(page);
  await expect(page.getByTestId("practice-feedback")).toContainText(
    "Leg drive",
  );
});

test("voice feedback off in Profile: practice starts muted and says nothing", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Quiet");
  await page.getByTestId("tab-profile").click();
  const toggle = page.getByTestId("voice-toggle");
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();

  await page.getByTestId("tab-practice").click();
  await startLiveLoop(page);
  await expect(page.getByTestId("practice-mute")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A shot is still scored and shown — just not spoken.
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  const spoken = await page.evaluate(() =>
    (
      (window as unknown as { __scAudioLog?: { kind: string }[] })
        .__scAudioLog ?? []
    ).filter((h) => h.kind === "speak"),
  );
  expect(spoken).toEqual([]);

  // The setting stuck (stored for this user).
  await page.getByTestId("tab-profile").click();
  await expect(page.getByTestId("voice-toggle")).not.toBeChecked();
});
