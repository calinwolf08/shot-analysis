import { describe, expect, it } from "vitest";
import { parseFromWorker, parseToWorker } from "../worker/worker-protocol";

const opts = { shootingHand: "right" as const, profile: "pro-form" };
const assets = {
  wasmBasePath: "/mediapipe/wasm",
  modelPath: "/mediapipe/pose_landmarker_full.task",
};

describe("worker protocol", () => {
  it("round-trips init/frames/finalize/cancel through structured clone shape", () => {
    const init = parseToWorker({
      type: "init",
      opts,
      mode: "video",
      fps: 30,
      assets,
    });
    expect(init.type).toBe("init");

    const frames = parseToWorker({
      type: "frames",
      frames: [
        {
          data: new Uint8ClampedArray([1, 2, 3, 4]),
          width: 1,
          height: 1,
          frameIndex: 0,
          timestamp: 0,
        },
      ],
    });
    expect(frames.type).toBe("frames");

    expect(parseToWorker({ type: "finalize" }).type).toBe("finalize");
    expect(parseToWorker({ type: "cancel" }).type).toBe("cancel");
  });

  it("rejects malformed to-worker messages", () => {
    expect(() => parseToWorker({ type: "init", opts })).toThrow();
    expect(() => parseToWorker({ type: "frames", frames: [] })).toThrow();
    expect(() =>
      parseToWorker({
        type: "frames",
        frames: [
          {
            data: "not-bytes",
            width: 1,
            height: 1,
            frameIndex: 0,
            timestamp: 0,
          },
        ],
      }),
    ).toThrow();
    expect(() => parseToWorker({ type: "nope" })).toThrow();
  });

  it("round-trips from-worker messages", () => {
    expect(parseFromWorker({ type: "ready" }).type).toBe("ready");
    expect(
      parseFromWorker({
        type: "progress",
        progress: { framesProcessed: 10, shotsDetected: 1, phase: "detecting" },
      }).type,
    ).toBe("progress");
    expect(
      parseFromWorker({
        type: "landmarks",
        frame: {
          frameIndex: 3,
          timestamp: 100,
          poseConfidence: 0.9,
          landmarks: [
            { x: 0.1, y: 0.2, z: 0.3, visibility: 0.9, confidence: 0.9 },
          ],
        },
      }).type,
    ).toBe("landmarks");
    expect(
      parseFromWorker({
        type: "result",
        result: {
          shots: [],
          videoMetadata: { fps: 30, totalFrames: 0, duration: 0 },
          config: {},
        },
      }).type,
    ).toBe("result");
    expect(parseFromWorker({ type: "error", message: "boom" }).type).toBe(
      "error",
    );
  });

  it("rejects malformed from-worker messages", () => {
    expect(() => parseFromWorker({ type: "progress" })).toThrow();
    expect(() =>
      parseFromWorker({ type: "result", result: { shots: "x" } }),
    ).toThrow();
    expect(() => parseFromWorker(null)).toThrow();
  });
});
