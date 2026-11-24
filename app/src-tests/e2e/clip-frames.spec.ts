import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

/**
 * Review decodes a shot clip once into frames (review/clip-frames.ts)
 * because phone recordings can have almost no keyframes — an Android Firefox
 * clip had 2 in 9.5 s, and seeking it per scrub step never caught up. The
 * fixture has ONE keyframe in 6 s (ffmpeg testsrc2, -g 1000).
 */
const FIXTURE = "src-tests/fixtures/video/few-keyframes.webm";

test("a clip with one keyframe decodes into every requested frame", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const bundle = buildSync({
    entryPoints: ["src/lib/features/live-practice/review/clip-frames.ts"],
    bundle: true,
    format: "iife",
    globalName: "ClipFrames",
    write: false,
  }).outputFiles[0]!.text;
  await page.route("http://clip-frames.test/**", (r) => {
    const url = r.request().url();
    if (url.endsWith(".webm"))
      return r.fulfill({
        body: readFileSync(FIXTURE),
        contentType: "video/webm",
      });
    if (url.endsWith(".js"))
      return r.fulfill({ body: bundle, contentType: "text/javascript" });
    return r.fulfill({
      contentType: "text/html",
      body: '<!doctype html><video id="v" src="clip.webm" muted playsinline preload="auto"></video><script src="cf.js"></script>',
    });
  });
  await page.goto("http://clip-frames.test/");
  const r = await page.evaluate(async () => {
    const v = document.getElementById("v") as HTMLVideoElement;
    await new Promise((res) =>
      v.readyState >= 1
        ? res(null)
        : v.addEventListener("loadedmetadata", res, { once: true }),
    );
    const times = Array.from({ length: 40 }, (_, i) => 0.2 + i * 0.14);
    const cf = (
      window as unknown as {
        ClipFrames: typeof import("../../src/lib/features/live-practice/review/clip-frames");
      }
    ).ClipFrames;
    let progress = 0;
    const frames = await cf.extractClipFrames(v, times, {
      onProgress: (d) => (progress = d),
    });
    const sample = (i: number) =>
      frames[i]!.canvas.getContext("2d")!.getImageData(0, 0, 120, 160).data;
    let distinct = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = sample(i - 1);
      const b = sample(i);
      let d = 0;
      for (let k = 0; k < a.length; k += 16) d += Math.abs(a[k]! - b[k]!);
      if (d > 0) distinct++;
    }
    return {
      got: frames.filter((f) => f).length,
      maxErr: Math.max(...frames.map((f, i) => Math.abs(f!.time - times[i]!))),
      distinct,
      progress,
      paused: v.paused,
      nearest: cf.nearestFrame([null, frames[1]!, null], 2)?.time ?? null,
    };
  });
  expect(r.got).toBe(40);
  expect(r.progress).toBe(40);
  // Within ~2 frames of each target (30 fps).
  expect(r.maxErr).toBeLessThan(0.07);
  // Every frame is a different picture (testsrc2 animates).
  expect(r.distinct).toBe(39);
  expect(r.paused).toBe(true);
  expect(r.nearest).not.toBeNull();
});
