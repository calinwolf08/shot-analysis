import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Positioning gate + spoken cue pacing, driven like a real session: a fresh
 * player onboards, taps "Start live practice", and the camera (Chromium's fake
 * device) opens. The replayed pose stream is scripted (`replayScript`) to stand
 * the player in specific stances; `window.__scAudioLog` records what they'd
 * hear. Right-handed (the onboarding default) ⇒ shooting arm nearest the
 * camera = "side-right".
 */

interface Heard {
  t: number;
  kind: string;
  text?: string;
}

const STEP_BACK = "Step back so your whole body is in frame";
const SIDE_ON = "Turn side-on, shooting arm toward the camera";
const TURN_AROUND = "Turn around, shooting arm toward the camera";
const READY = "Ready. Take your shot.";

async function heard(page: Page): Promise<Heard[]> {
  return page.evaluate(
    () => (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
  );
}

async function spoken(page: Page): Promise<Heard[]> {
  return (await heard(page)).filter((e) => e.kind === "speak");
}

async function startWithScript(page: Page, script: string, name: string) {
  // replaySpeed=1 keeps the fixture (after the script) at real time.
  const q = `?e2e=replay&fakecam=1&debug=live&replaySpeed=1&replayScript=${script}`;
  await onboard(page, q, name);
  await startLiveLoop(page);
  await expect(page.getByTestId("loop-preview")).toBeVisible();
  await expect(page.getByTestId("readiness")).toBeVisible();
}

test("facing the camera → turn side-on → Ready; no 'step back' loop", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startWithScript(page, "facing:5,side:10", "Facing");

  // Facing the camera: whole body is visible, so the cue is to turn — never
  // "step back" (the reported alternation).
  await expect(page.getByTestId("readiness-cue")).toHaveText(SIDE_ON, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("rd-body")).toHaveText("ok");
  await page.screenshot({
    path: screenPath("phase1", "1-facing-cue"),
  });

  // Turns side-on (shooting arm toward camera, far side occluded).
  await expect(page.getByTestId("readiness-ready")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("rd-side")).toContainText("side-right");
  await page.screenshot({
    path: screenPath("phase1", "2-ready"),
  });

  await expect
    .poll(async () => (await spoken(page)).map((s) => s.text), {
      timeout: 10_000,
    })
    .toContain(READY);

  const lines = await spoken(page);
  const texts = lines.map((l) => l.text);
  expect(texts).not.toContain(STEP_BACK);
  // The turn cue was spoken once (5 s facing < the 10 s repeat limit), then Ready.
  expect(texts.filter((t) => t === SIDE_ON)).toHaveLength(1);
  expect(texts.filter((t) => t === READY)).toHaveLength(1);
  expect(texts.indexOf(SIDE_ON)).toBeLessThan(texts.indexOf(READY));
  // "Ready" came with the ready earcon.
  expect((await heard(page)).some((e) => e.kind === "earcon")).toBe(true);
});

test("cue pacing: holds, cooldown and repeat limit (defaults)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startWithScript(page, "facing:25", "Pacing");
  await page.waitForTimeout(23_000);

  const cues = (await spoken(page)).filter((s) => s.text !== READY);
  expect(cues.length).toBeGreaterThanOrEqual(2);
  expect(cues.every((c) => c.text === SIDE_ON)).toBe(true);
  for (let i = 1; i < cues.length; i++) {
    // Same cue: at most every 10 s (small slack for timer jitter).
    expect(cues[i]!.t - cues[i - 1]!.t).toBeGreaterThan(9_800);
  }
});

test("wrong side toward the camera → 'turn around', not 'step back'", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await startWithScript(page, "wrongside:8", "Wrongside");
  await expect(page.getByTestId("readiness-cue")).toHaveText(TURN_AROUND, {
    timeout: 10_000,
  });
  await expect
    .poll(async () => (await spoken(page)).map((s) => s.text), {
      timeout: 10_000,
    })
    .toContain(TURN_AROUND);
  expect((await spoken(page)).map((s) => s.text)).not.toContain(STEP_BACK);
});

test("tuning file changes the pacing without a rebuild", async ({ page }) => {
  test.setTimeout(60_000);
  // Same request the app makes on boot; the test serves an edited file.
  await page.route("**/config/live-tuning.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cues: { holdMs: 300, cooldownMs: 1000, repeatSameMs: 2000 },
      }),
    }),
  );
  await startWithScript(page, "facing:20", "Tuned");
  await page.waitForTimeout(9_000);

  const cues = (await spoken(page)).filter((s) => s.text === SIDE_ON);
  // ~every 2 s instead of every 10 s.
  expect(cues.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < cues.length; i++) {
    const gap = cues[i]!.t - cues[i - 1]!.t;
    expect(gap).toBeGreaterThan(1_900);
    expect(gap).toBeLessThan(3_500);
  }
});
