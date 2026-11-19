import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Part B, Phase 13 — the Curry viewer draws what each metric measures (angle
 * arc, offset, height bar…) when a cell is clicked, and compares one of MY
 * shots side-by-side with a Curry shot on a phase-aligned clock.
 */

async function setRange(input: Locator, value: number) {
  await input.evaluate((el, v) => {
    (el as HTMLInputElement).value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function openViewer(page: Page) {
  await page.getByTestId("tab-profile").click();
  await page.getByTestId("debug-tools-link").click();
  await page.getByTestId("debug-link-reference").click();
  await expect(page.getByTestId("ref-table")).toBeVisible({ timeout: 30_000 });
}

test("clicking a metric cell seeks and draws its geometry", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await onboard(page, "?e2e=replay", "Geometry");
  await openViewer(page);
  const canvas = page.getByTestId("ref-skeleton");
  const scrubber = page.getByTestId("ref-scrubber");

  const families: [string, number, string][] = [
    ["load.knee_depth", 2, "angle"],
    ["setPoint.spine_angle", 2, "lean"],
    ["load.hip_over_knee", 2, "offset"],
    ["setPoint.wrist_vs_head", 2, "height"],
    ["release.elbow_path", 2, "path"],
  ];
  for (const [id, shot, family] of families) {
    const cell = page.getByTestId(`cell-${id}-${shot}`);
    await cell.click();
    await expect(page.getByTestId(`ref-shot-${shot + 1}`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Seeks to where it was measured…
    const at = await page.getByTestId("sel-frame-0").textContent();
    const f = Number(at!.replace(/\D+/g, ""));
    await expect(scrubber).toHaveValue(String(f));
    await expect(canvas).toHaveAttribute("data-frame", String(f));
    // …and draws the measured geometry there.
    await expect(canvas).toHaveAttribute(
      "data-geometry",
      new RegExp(`(^|,)${family}(,|$)`),
    );
    await expect(page.getByTestId("mk-sel-0")).toBeVisible();
    await page.getByTestId("ref-stage").screenshot({
      path: screenPath("phase13", `geometry-${family}`),
    });
  }

  // A two-frame metric (a change): each frame is a seek button.
  await page.getByTestId("cell-rise.spine_change-0").click();
  const second = page.getByTestId("sel-frame-1");
  await expect(second).toBeVisible();
  const f2 = Number((await second.textContent())!.replace(/\D+/g, ""));
  await second.click();
  await expect(canvas).toHaveAttribute("data-frame", String(f2));
  await expect(canvas).toHaveAttribute("data-geometry", /lean/);

  // Timing metrics have no body geometry — markers on the scrubber instead.
  await page.getByTestId("cell-rise.t_end-1").click();
  await expect(canvas).toHaveAttribute("data-geometry", "timing");
  await expect(page.getByTestId("mk-sel-1")).toBeVisible();
});

test("compare: my replayed shot vs Curry, phase-aligned", async ({ page }) => {
  test.setTimeout(150_000);
  await onboard(page, "?e2e=replay", "Comparer");
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-counter")).toHaveText(/Shot [2-9]/, {
    timeout: 60_000,
  });

  await openViewer(page);
  await page.getByTestId("mode-compare").click();
  await expect(page.getByTestId("compare")).toBeVisible();
  const pick = page.getByTestId("cmp-pick");
  await expect(pick.locator("option")).not.toHaveCount(1, { timeout: 10_000 });
  const first = await pick.locator("option").nth(1).getAttribute("value");
  await pick.selectOption(first!);
  await expect(page.getByTestId("cmp-mine-skeleton")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("cmp-error")).toHaveCount(0);

  // At every phase boundary both stages sit on that boundary of their own
  // shot (each stage's own phase clock ≈ the shared one) and show the same
  // phase label.
  const scrubber = page.getByTestId("cmp-scrubber");
  const refPhase = page.getByTestId("cmp-ref-phase");
  const minePhase = page.getByTestId("cmp-mine-phase");
  for (const [u, label] of [
    [1, "Load · at Load starts"],
    [2, "Rise · at Lowest point"],
    [3, "Release · at Set point"],
    [4, "After · at Arm extended"],
  ] as const) {
    await setRange(scrubber, u);
    await expect(refPhase).toContainText(label);
    await expect(minePhase).toContainText(label);
    for (const el of [refPhase, minePhase]) {
      const own = Number(await el.getAttribute("data-u"));
      expect(Math.abs(own - u)).toBeLessThan(0.5);
    }
  }
  await setRange(scrubber, 3);
  await page.getByTestId("compare").screenshot({
    path: screenPath("phase13", "compare-set-point"),
  });

  // My values sit next to the band in the table.
  await expect(
    page.getByTestId("ref-table").locator("thead th").last(),
  ).toHaveText("Mine");
  await expect(page.getByTestId("mine-setPoint.elbow_angle")).toBeVisible();

  // Play runs the shared clock to the end; both stages advance.
  await setRange(scrubber, 0);
  const before = await page
    .getByTestId("cmp-mine-skeleton")
    .getAttribute("data-frame");
  await page.getByTestId("cmp-play").click();
  await expect
    .poll(async () => Number(await scrubber.inputValue()), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(4.9);
  await expect(page.getByTestId("cmp-mine-skeleton")).not.toHaveAttribute(
    "data-frame",
    before!,
  );
  await expect(page.getByTestId("cmp-play")).toHaveText("▶");
});
