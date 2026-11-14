/**
 * Tier C — the camera/MediaPipe path can't run headlessly (no webcam, and the
 * replay backend bypasses MediaPipe by design), so a full browser test can't
 * reach it. This asserts the layer it depends on instead: the WASM runtime and
 * pose model are actually SERVED. The "start camera tracking" 404 (missing
 * static/mediapipe/wasm) would have failed this instantly.
 */
import { test, expect } from "./fixtures";

const ASSETS = [
  "/mediapipe/wasm/vision_wasm_internal.js",
  "/mediapipe/wasm/vision_wasm_internal.wasm",
  "/mediapipe/wasm/vision_wasm_nosimd_internal.js",
  "/mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
  "/mediapipe/pose_landmarker_full.task",
];

for (const path of ASSETS) {
  test(`serves MediaPipe asset ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status(), `${path} must be served (200)`).toBe(200);
    const len = Number(res.headers()["content-length"] ?? "0");
    expect(len, `${path} must be non-empty`).toBeGreaterThan(0);
  });
}
