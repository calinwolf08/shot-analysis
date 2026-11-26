import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Keyframe shot review (docs/keyframe-review-plan.md): dots on joints at each
 * keyframe, a box for where each should be, a callout for the selected check,
 * phase icons to jump between keyframes, and the shared Feedback filter.
 */
const KEYFRAMES = [
  ["setup", "Setup"],
  ["load", "Load"],
  ["rise", "Rise"],
  ["setPoint", "Set point"],
  ["release", "Release"],
] as const;

interface Stack {
  ids: string[];
  x: number;
  y: number;
}

async function openReview(page: Page, name = "Review") {
  await onboard(page, "?e2e=replay", name);
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("tab-shots").click();
  const firstShot = page.locator('[data-testid^="shot-row-"]').first();
  await expect(firstShot).toBeVisible({ timeout: 10_000 });
  await firstShot.click();
  await expect(page.getByTestId("shot-review")).toBeVisible();
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
}

async function stacks(page: Page): Promise<Stack[]> {
  const raw = await page
    .getByTestId("review-skeleton")
    .getAttribute("data-stacks");
  return raw ? (JSON.parse(raw) as Stack[]) : [];
}

async function tapStack(page: Page, s: Stack) {
  const box = (await page.getByTestId("review-skeleton").boundingBox())!;
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

test("phase icons jump to each keyframe; its worst check is called out", async ({
  page,
}) => {
  await openReview(page);
  const canvas = page.getByTestId("review-skeleton");
  for (const [k, name] of KEYFRAMES) {
    await page.getByTestId(`review-icon-${k}`).click();
    await expect(page.getByTestId("review-phase")).toHaveText(name);
    await expect(canvas).toHaveAttribute("data-keyframe", k);
    // The keyframe's checks are drawn as dots on joints.
    await expect
      .poll(async () => (await stacks(page)).length)
      .toBeGreaterThan(0);
    const title = page.getByTestId("review-callout-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText(
      /^([A-Z][a-z]+( [a-z]+)* too [a-z ]+ by (\d|10\+)|[A-Z][a-z ]+: (in range|not measured))$/,
    );
    // The selected check is one of this keyframe's.
    expect(await canvas.getAttribute("data-selected")).toMatch(
      new RegExp(`^${k}\\.`),
    );
  }
});

test("a joint with several checks opens a chooser; tapping a dot selects it", async ({
  page,
}) => {
  await openReview(page);
  const canvas = page.getByTestId("review-skeleton");
  await page.getByTestId("review-icon-load").click();
  // At Load the wrist carries hand height, ball close and wrist hinge.
  const wrist = (await stacks(page)).find((s) => s.ids.length > 1)!;
  expect(wrist.ids).toEqual(
    expect.arrayContaining(["load.hand_height", "load.wrist_hinge"]),
  );
  await tapStack(page, wrist);
  await expect(page.getByTestId("review-chooser")).toBeVisible();
  await page.getByTestId("review-chooser-load.wrist_hinge").click();
  await expect(page.getByTestId("review-chooser")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-selected", "load.wrist_hinge");

  // A single dot selects directly, and its target zone is drawn.
  const knee = (await stacks(page)).find((s) =>
    s.ids.includes("load.knee_bend"),
  )!;
  await tapStack(page, knee);
  await expect(canvas).toHaveAttribute("data-selected", "load.knee_bend");
  await expect(canvas).toHaveAttribute("data-zone", "box");
  const hips = (await stacks(page)).find((s) =>
    s.ids.includes("load.hips_over_knees"),
  )!;
  await tapStack(page, hips);
  await expect(canvas).toHaveAttribute("data-zone", "band");
});

test("the Feedback filter hides other checks, is remembered, and Pick checks edits it", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openReview(page, "Filter");
  const pill = page.getByTestId("review-filter");
  await expect(pill).toContainText("All feedback");
  await pill.click();
  await expect(page.getByTestId("feedback-sheet")).toBeVisible();
  await page.getByTestId("feedback-preset-legs").click();
  await page.screenshot({ path: screenPath("keyframes", "sheet-focus") });
  await expect(page.getByTestId("feedback-count")).toHaveText(
    "8 of 33 checks on",
  );
  await page.getByTestId("feedback-done").click();
  await expect(pill).toContainText("Leg drive");

  // Setup has no leg-drive checks: nothing drawn, no callout.
  await page.getByTestId("review-icon-setup").click();
  await expect.poll(async () => (await stacks(page)).length).toBe(0);
  await expect(page.getByTestId("review-callout")).toHaveCount(0);
  // Rise: only knees and hips.
  await page.getByTestId("review-icon-rise").click();
  await expect
    .poll(async () => (await stacks(page)).flatMap((s) => s.ids).sort())
    .toEqual(["rise.hips_over_knees", "rise.knee_bend"]);

  // Remembered (shared with practice).
  await page.reload();
  await expect(page.getByTestId("review-filter")).toContainText("Leg drive");

  // Pick checks: one phase of one check off → "Custom".
  await page.getByTestId("review-filter").click();
  await page.getByTestId("feedback-tab-pick").click();
  const chip = page.getByTestId("feedback-chip-rise.knee_bend");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: screenPath("keyframes", "sheet-pick") });
  await expect(page.getByTestId("feedback-count")).toHaveText(
    "7 of 33 checks on",
  );
  await page.getByTestId("feedback-tab-focus").click();
  await page.getByTestId("feedback-preset-all").click();
  await page.getByTestId("feedback-done").click();
  await expect(page.getByTestId("review-filter")).toContainText("All feedback");
});

test("the speaker says the callout's words with its keyframe", async ({
  page,
}) => {
  await openReview(page, "Hear");
  await page.getByTestId("review-icon-rise").click();
  const title = (await page.getByTestId("review-callout-title").textContent())!;
  await page.getByTestId("review-hear").click();
  await expect
    .poll(async () => {
      const log = await page.evaluate(
        () =>
          (
            window as unknown as {
              __scAudioLog?: { kind: string; text?: string }[];
            }
          ).__scAudioLog ?? [],
      );
      return log.filter((h) => h.kind === "speak").at(-1)?.text ?? "";
    })
    .toBe(
      / by /.test(title)
        ? `When the ball reaches set point: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`
        : `${title.split(":")[0]} is in range.`,
    );
  await page.screenshot({ path: screenPath("keyframes", "review-desktop") });
});
