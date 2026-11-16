import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Phase 2 — live pose latency on the REAL MediaPipe worker. No replay: the
 * fake camera (Chromium's test pattern) feeds the actual capture → worker →
 * landmarks path. A slow phone is imitated with `?detectDelayMs=` (extra
 * time per detection inside the worker; CDP CPU throttling doesn't reach
 * workers). The debug HUD (?debug=live) reports the median capture→landmarks latency, the
 * pose model in use, and skipped capture ticks.
 */

async function serveTuning(page: Page, latency: Record<string, unknown>) {
  await page.route("**/config/live-tuning.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ latency }),
    }),
  );
}

async function startRealLoop(page: Page, name: string, extraQuery = "") {
  await onboard(page, `?debug=live${extraQuery}`, name);
  await page.getByTestId("practice-live").click();
  await startLiveLoop(page);
  await expect(page.getByTestId("loop-preview")).toBeVisible();
}

const latencyMs = async (page: Page): Promise<number | null> => {
  const text =
    (await page.getByTestId("live-debug-latency").textContent()) ?? "";
  const m = /(\d+)ms/.exec(text);
  return m ? Number(m[1]) : null;
};

test("backpressure keeps latency bounded when detection is slow (full model)", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await serveTuning(page, { model: "full" });
  // 150 ms per detection > the 66 ms capture interval: a slow phone. Before
  // backpressure, every second added ~half a second of queued frames.
  await startRealLoop(page, "Latency", "&detectDelayMs=150");

  await expect.poll(() => latencyMs(page), { timeout: 60_000 }).not.toBeNull();
  await page.waitForTimeout(3_000);
  const early = (await latencyMs(page))!;
  await page.waitForTimeout(15_000);
  const late = (await latencyMs(page))!;
  const skipped = Number(
    await page.getByTestId("live-debug-skipped").textContent(),
  );
  test.info().annotations.push({
    type: "latency",
    description: `p50 early=${early}ms late=${late}ms skipped=${skipped}`,
  });

  // Latency ≈ one detection (150 ms + model time), flat over time — not growing.
  expect(early).toBeGreaterThanOrEqual(150);
  expect(late).toBeLessThan(600);
  expect(late).toBeLessThan(early + 200);
  // Capture ticks were skipped instead of queued.
  expect(skipped).toBeGreaterThan(50);
  await expect(page.getByTestId("live-debug-model")).toHaveText("full");
  await page.screenshot({ path: screenPath("phase2", "hud-slow-detection") });
});

test("auto policy falls back to the lite model when too slow", async ({
  page,
}) => {
  test.setTimeout(150_000);
  // Any real latency exceeds 1 ms → deterministic fallback on every machine.
  await serveTuning(page, {
    model: "auto",
    liteFallbackP50Ms: 1,
    warmupFrames: 3,
    windowFrames: 5,
  });
  await startRealLoop(page, "Fallback");

  await expect(page.getByTestId("live-debug-model")).toHaveText("lite", {
    timeout: 90_000,
  });
  await expect(page.getByTestId("live-debug-log")).toContainText(
    "pose model → lite",
  );
  // Detection keeps running on the lite model.
  await expect.poll(() => latencyMs(page), { timeout: 30_000 }).not.toBeNull();
  await page.screenshot({ path: screenPath("phase2", "hud-lite-fallback") });
});

test("auto policy stays on the full model when fast enough", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await serveTuning(page, {
    model: "auto",
    liteFallbackP50Ms: 60_000,
    warmupFrames: 3,
    windowFrames: 5,
  });
  await startRealLoop(page, "Stayfull");
  await expect.poll(() => latencyMs(page), { timeout: 60_000 }).not.toBeNull();
  await page.waitForTimeout(5_000);
  await expect(page.getByTestId("live-debug-model")).toHaveText("full");
});

test("replayed latency shows in the HUD (simulated 200 ms)", async ({
  page,
}) => {
  await onboard(
    page,
    "?e2e=replay&fakecam=1&debug=live&replayLatencyMs=200",
    "Replaylag",
  );
  await page.getByTestId("practice-live").click();
  await startLiveLoop(page);
  await expect
    .poll(() => latencyMs(page), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(195);
  expect((await latencyMs(page))!).toBeLessThan(400);
  await expect(page.getByTestId("live-debug-model")).toHaveText("replay");
});
