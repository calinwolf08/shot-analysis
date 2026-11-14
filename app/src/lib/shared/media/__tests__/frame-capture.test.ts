import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLiveFrameCapture,
  startFrameCapture,
  type FrameData,
} from "../frame-capture";

// The capture loop's only DOM/GPU dependency is downsampleToImageData
// (canvas drawImage/getImageData), which can't run against a plain mock in
// the node unit env. Stub it so we can test the loop's timing, gating, frame
// indexing, and teardown deterministically.
vi.mock("../downsample", () => ({
  downsampleToImageData: (
    _source: unknown,
    _w: number,
    _h: number,
    _maxEdge: number,
  ): ImageData =>
    ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }) as ImageData,
}));

/** Minimal mutable stand-in for the HTMLVideoElement fields we read. */
interface MockVideo {
  videoWidth: number;
  videoHeight: number;
  readyState: number;
}

function makeVideo(overrides: Partial<MockVideo> = {}): HTMLVideoElement {
  const video: MockVideo = {
    videoWidth: 640,
    videoHeight: 480,
    readyState: 4, // HAVE_ENOUGH_DATA
    ...overrides,
  };
  return video as unknown as HTMLVideoElement;
}

describe("startFrameCapture", () => {
  let capturedFrames: FrameData[];

  beforeEach(() => {
    vi.useFakeTimers();
    capturedFrames = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures frames at the configured FPS", () => {
    const handle = startFrameCapture(
      makeVideo(),
      (frame) => capturedFrames.push(frame),
      { fps: 10 },
    );

    expect(handle.running).toBe(true);

    // First frame is captured immediately; ~5 more over 500ms at 10fps.
    vi.advanceTimersByTime(500);
    expect(capturedFrames.length).toBeGreaterThanOrEqual(5);

    handle.stop();
    expect(handle.running).toBe(false);
  });

  it("skips capture when video is not ready", () => {
    const handle = startFrameCapture(
      makeVideo({ readyState: 1 }), // HAVE_METADATA, not enough data
      (frame) => capturedFrames.push(frame),
    );

    vi.advanceTimersByTime(200);
    expect(capturedFrames.length).toBe(0);

    handle.stop();
  });

  it("skips capture when video has no dimensions", () => {
    const handle = startFrameCapture(
      makeVideo({ videoWidth: 0, videoHeight: 0 }),
      (frame) => capturedFrames.push(frame),
    );

    vi.advanceTimersByTime(200);
    expect(capturedFrames.length).toBe(0);

    handle.stop();
  });

  it("increments frame index and advances timestamps", () => {
    const handle = startFrameCapture(
      makeVideo(),
      (frame) => capturedFrames.push(frame),
      { fps: 30 },
    );

    vi.advanceTimersByTime(100);
    handle.stop();

    expect(capturedFrames.length).toBeGreaterThan(0);
    capturedFrames.forEach((frame, i) => expect(frame.frameIndex).toBe(i));
    for (let i = 1; i < capturedFrames.length; i++) {
      expect(capturedFrames[i]!.timestamp).toBeGreaterThanOrEqual(
        capturedFrames[i - 1]!.timestamp,
      );
    }
  });

  it("stops capturing when stop() is called", () => {
    const handle = startFrameCapture(makeVideo(), (frame) =>
      capturedFrames.push(frame),
    );

    vi.advanceTimersByTime(100);
    const countBeforeStop = capturedFrames.length;

    handle.stop();
    vi.advanceTimersByTime(100);

    expect(capturedFrames.length).toBe(countBeforeStop);
  });
});

describe("createLiveFrameCapture", () => {
  afterEach(() => vi.useRealTimers());

  it("returns null when the session has no pushFrame (replay self-drives)", () => {
    const handle = createLiveFrameCapture(makeVideo(), {});
    expect(handle).toBeNull();
  });

  it("pumps frames into session.pushFrame when present", () => {
    vi.useFakeTimers();
    const frames: FrameData[] = [];
    const session = { pushFrame: (frame: FrameData) => frames.push(frame) };

    const handle = createLiveFrameCapture(makeVideo(), session);
    expect(handle).not.toBeNull();
    expect(handle!.running).toBe(true);

    vi.advanceTimersByTime(100);
    handle!.stop();

    expect(frames.length).toBeGreaterThan(0);
  });
});
