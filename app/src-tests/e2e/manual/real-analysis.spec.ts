import { test } from "@playwright/test";

/**
 * @manual-device — the real MediaPipe path (WASM + pose model + WebGL)
 * cannot run meaningfully headless in CI. Run on a device/desktop browser
 * with DEVICE_TEST=1 against a real recorded video; see
 * app/docs/device-testing.md.
 */
test("@manual-device real MediaPipe video analysis", async () => {
  test.skip(
    !process.env.DEVICE_TEST,
    "device-only: set DEVICE_TEST=1 and follow docs/device-testing.md",
  );
  // Manual flow: upload a real video through /assess and verify shots are
  // detected with plausible metrics. Automated assertions intentionally
  // omitted — this is a guided manual checklist item.
});
