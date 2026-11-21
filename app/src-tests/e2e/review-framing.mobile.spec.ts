import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { apiGet, apiPost, onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Phase 6 — shot review framing: the pose keeps the camera's proportions
 * (uniform scale — no stretch/"rotation") and ONE fixed zoom fits the whole
 * movement, so the highest and lowest points are just visible.
 */

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

async function setRange(input: Locator, value: number) {
  await input.evaluate((el, v) => {
    (el as HTMLInputElement).value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function recordShotAndOpenReview(page: Page, name: string) {
  // Replay fixture: portrait 1080×1920 source, one side-on shot.
  await onboard(page, "?e2e=replay&replaySpeed=1", name);
  await startLiveLoop(page);
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId("tab-shots").click();
  const row = page.locator('button[data-testid^="shot-row-"]').first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
}

/** Scrubs every frame; returns each frame's projected joint box + framing. */
async function scrubAll(page: Page) {
  const scrubber = page.getByTestId("review-scrubber");
  const canvas = page.getByTestId("review-skeleton");
  const min = Number(await scrubber.getAttribute("min"));
  const max = Number(await scrubber.getAttribute("max"));
  const boxes: Box[] = [];
  const framings = new Set<string>();
  for (let f = min; f <= max; f++) {
    await setRange(scrubber, f);
    await expect(page.getByTestId("review-scrubber")).toHaveValue(String(f));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const box = await canvas.getAttribute("data-frame-box");
    if (box) boxes.push(JSON.parse(box) as Box);
    framings.add((await canvas.getAttribute("data-framing")) ?? "");
  }
  return { boxes, framings, min, max };
}

test("review pose: true proportions, one fixed zoom fitting the whole shot", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await recordShotAndOpenReview(page, "Framing");

  const stage = (await page.getByTestId("review-stage").boundingBox())!;
  const framing = JSON.parse(
    (await page.getByTestId("review-skeleton").getAttribute("data-framing"))!,
  ) as { aspect: number };
  // The real source size was stored with the shot: portrait 9:16, exactly.
  expect(framing.aspect).toBeCloseTo(1080 / 1920, 6);
  await expect(page.getByTestId("review-approx-framing")).toHaveCount(0);

  const { boxes, framings, min } = await scrubAll(page);
  expect(boxes.length).toBeGreaterThan(10);
  // One transform for the whole shot (no per-frame recentering/zoom).
  expect(framings.size).toBe(1);
  // Every frame's joints are inside the stage…
  for (const b of boxes) {
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.bottom).toBeLessThanOrEqual(stage.height);
    expect(b.right).toBeLessThanOrEqual(stage.width);
  }
  // …and the extremes of the movement are JUST inside (fills the window):
  // on the limiting axis, highest/lowest (or leftmost/rightmost) within 8%.
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.right));
  const vFill = top / stage.height < 0.08 && 1 - bottom / stage.height < 0.08;
  const hFill = left / stage.width < 0.08 && 1 - right / stage.width < 0.08;
  expect(
    vFill || hFill,
    JSON.stringify({ top, bottom, left, right, stage }),
  ).toBe(true);

  // Screenshots at three moments of the shot for review.
  const scrubber = page.getByTestId("review-scrubber");
  const max = Number(await scrubber.getAttribute("max"));
  for (const [name, f] of [
    ["1-start", min],
    ["2-mid", Math.round((min + max) / 2)],
    ["3-end", max],
  ] as const) {
    await setRange(scrubber, f);
    await page.screenshot({ path: screenPath("phase6", name) });
  }
});

test("an older shot saved without its size is framed undistorted and marked approximate", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await recordShotAndOpenReview(page, "Legacy");
  const shotId = page.url().split("/shots/")[1]!.split("?")[0]!;

  // Re-save a copy of the shot the way older builds did: poses without size.
  const shot = await apiGet<{ playerId: string; analysis: unknown }>(
    page,
    `/api/shots/${shotId}`,
  );
  const poses = await apiGet<{ fps: number; frames: unknown[] }>(
    page,
    `/api/shots/${shotId}/poses`,
  );
  const legacy = await apiPost<{ id: string }>(page, "/api/shots", {
    playerId: shot.playerId,
    analysis: shot.analysis,
    reviewPoses: { fps: poses.fps, frames: poses.frames },
  });
  await page.goto(`/shots/${legacy.id}?e2e=replay`);
  await expect(page.getByTestId("review-skeleton")).toBeVisible();
  await expect(page.getByTestId("review-approx-framing")).toBeVisible();
  const framing = JSON.parse(
    (await page.getByTestId("review-skeleton").getAttribute("data-framing"))!,
  ) as { aspect: number };
  // Estimated from the skeleton: portrait, snapped to a camera ratio.
  expect(framing.aspect).toBeLessThan(1);
  await page.screenshot({ path: screenPath("phase6", "4-legacy-approx") });
});

test("review on a phone: pose, phase issues and scrubber all fit above the tab bar", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await recordShotAndOpenReview(page, "Layout");
  await page.evaluate(() => window.scrollTo(0, 0));
  const tabTop = (await page.locator("nav.tab-bar").boundingBox())!.y;
  const stage = (await page.getByTestId("review-stage").boundingBox())!;
  const scrub = (await page.getByTestId("review-scrubber").boundingBox())!;
  expect(stage.height).toBeGreaterThan(250);
  expect(scrub.y + scrub.height).toBeLessThanOrEqual(tabTop);
  // Phase label is written as-is (not title-cased).
  await expect(page.getByTestId("review-phase")).toHaveCSS(
    "text-transform",
    "none",
  );
  const chips = page.locator(".po-chip");
  if ((await chips.count()) > 0) {
    const last = (await chips.last().boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(tabTop);
    expect(await chips.first().textContent()).toMatch(
      /^[A-Z][^:]* by (\d|10\+)$/,
    );
  }
  await page.screenshot({ path: screenPath("ux", "review-phone-layout") });
});
