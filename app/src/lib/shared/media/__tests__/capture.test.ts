import { describe, expect, it } from "vitest";
import {
  CameraPermissionError,
  createBrowserCaptureService,
  createFakeCaptureService,
} from "../capture";

describe("createFakeCaptureService", () => {
  it("hands out a stream and records lifecycle calls", async () => {
    const capture = createFakeCaptureService();
    expect(capture.isAvailable()).toBe(true);

    const handle = await capture.start({ video: true });
    expect(handle.stream).toBeTruthy();
    expect(capture.starts).toHaveLength(1);

    handle.stop();
    expect(capture.stopped).toBe(1);
  });

  it("can simulate an unavailable or failing camera", async () => {
    expect(createFakeCaptureService({ available: false }).isAvailable()).toBe(
      false,
    );
    const failing = createFakeCaptureService({
      failWith: new CameraPermissionError(),
    });
    await expect(failing.start()).rejects.toThrow(CameraPermissionError);
  });
});

describe("createBrowserCaptureService", () => {
  it("reports unavailable and rejects without getUserMedia (node)", async () => {
    const capture = createBrowserCaptureService();
    expect(capture.isAvailable()).toBe(false);
    await expect(capture.start()).rejects.toThrow(CameraPermissionError);
  });
});
