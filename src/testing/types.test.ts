/**
 * Unit tests for testing/types.ts
 */

import { describe, it, expect } from "vitest";
import {
  orientationSchema,
  testLandmarkSchema,
  frameSchema,
  poseDataSchema,
  labeledShotSchema,
  labelDataSchema,
  isPoseData,
  isLabelData,
} from "./types";

describe("orientationSchema", () => {
  it("accepts valid orientations", () => {
    expect(orientationSchema.safeParse("front").success).toBe(true);
    expect(orientationSchema.safeParse("side-left").success).toBe(true);
    expect(orientationSchema.safeParse("side-right").success).toBe(true);
    expect(orientationSchema.safeParse("front-left").success).toBe(true);
    expect(orientationSchema.safeParse("front-right").success).toBe(true);
  });

  it("rejects invalid orientations", () => {
    expect(orientationSchema.safeParse("back").success).toBe(false);
    expect(orientationSchema.safeParse("top").success).toBe(false);
    expect(orientationSchema.safeParse("").success).toBe(false);
    expect(orientationSchema.safeParse(123).success).toBe(false);
  });
});

describe("testLandmarkSchema", () => {
  it("accepts valid landmark", () => {
    const landmark = { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 };
    const result = testLandmarkSchema.safeParse(landmark);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(landmark);
    }
  });

  it("accepts edge case values", () => {
    const landmark = { x: 0, y: 1, z: -0.5, visibility: 0 };
    expect(testLandmarkSchema.safeParse(landmark).success).toBe(true);
  });

  it("rejects visibility > 1", () => {
    const landmark = { x: 0.5, y: 0.5, z: 0.1, visibility: 1.5 };
    expect(testLandmarkSchema.safeParse(landmark).success).toBe(false);
  });

  it("rejects visibility < 0", () => {
    const landmark = { x: 0.5, y: 0.5, z: 0.1, visibility: -0.1 };
    expect(testLandmarkSchema.safeParse(landmark).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(testLandmarkSchema.safeParse({ x: 0.5, y: 0.5 }).success).toBe(
      false,
    );
    expect(testLandmarkSchema.safeParse({}).success).toBe(false);
  });
});

describe("frameSchema", () => {
  const validLandmark = { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 };

  it("accepts valid frame", () => {
    const frame = {
      frameIndex: 0,
      timestamp: 0.0,
      poseConfidence: 0.95,
      landmarks: [validLandmark],
    };
    const result = frameSchema.safeParse(frame);
    expect(result.success).toBe(true);
  });

  it("rejects negative frameIndex", () => {
    const frame = {
      frameIndex: -1,
      timestamp: 0.0,
      poseConfidence: 0.95,
      landmarks: [],
    };
    expect(frameSchema.safeParse(frame).success).toBe(false);
  });

  it("rejects non-integer frameIndex", () => {
    const frame = {
      frameIndex: 1.5,
      timestamp: 0.0,
      poseConfidence: 0.95,
      landmarks: [],
    };
    expect(frameSchema.safeParse(frame).success).toBe(false);
  });

  it("rejects poseConfidence > 1", () => {
    const frame = {
      frameIndex: 0,
      timestamp: 0.0,
      poseConfidence: 1.5,
      landmarks: [],
    };
    expect(frameSchema.safeParse(frame).success).toBe(false);
  });
});

describe("poseDataSchema", () => {
  const validFrame = {
    frameIndex: 0,
    timestamp: 0.0,
    poseConfidence: 0.95,
    landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }],
  };

  it("accepts valid pose data", () => {
    const poseData = {
      video: "test-video.mp4",
      fps: 30,
      totalFrames: 100,
      width: 1920,
      height: 1080,
      extractedAt: "2024-01-01T00:00:00Z",
      frames: [validFrame],
    };
    const result = poseDataSchema.safeParse(poseData);
    expect(result.success).toBe(true);
  });

  it("accepts empty frames array", () => {
    const poseData = {
      video: "test-video.mp4",
      fps: 30,
      totalFrames: 0,
      width: 1920,
      height: 1080,
      extractedAt: "2024-01-01T00:00:00Z",
      frames: [],
    };
    expect(poseDataSchema.safeParse(poseData).success).toBe(true);
  });

  it("rejects empty video name", () => {
    const poseData = {
      video: "",
      fps: 30,
      totalFrames: 100,
      width: 1920,
      height: 1080,
      extractedAt: "2024-01-01T00:00:00Z",
      frames: [],
    };
    expect(poseDataSchema.safeParse(poseData).success).toBe(false);
  });

  it("rejects non-positive fps", () => {
    const poseData = {
      video: "test.mp4",
      fps: 0,
      totalFrames: 100,
      width: 1920,
      height: 1080,
      extractedAt: "2024-01-01T00:00:00Z",
      frames: [],
    };
    expect(poseDataSchema.safeParse(poseData).success).toBe(false);
  });

  it("rejects negative width", () => {
    const poseData = {
      video: "test.mp4",
      fps: 30,
      totalFrames: 100,
      width: -1920,
      height: 1080,
      extractedAt: "2024-01-01T00:00:00Z",
      frames: [],
    };
    expect(poseDataSchema.safeParse(poseData).success).toBe(false);
  });
});

describe("labeledShotSchema", () => {
  it("accepts valid labeled shot with cameraOrientation", () => {
    const shot = {
      shotNumber: 1,
      startFrame: 10,
      endFrame: 50,
      cameraOrientation: "front",
    };
    const result = labeledShotSchema.safeParse(shot);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(shot);
    }
  });

  it("rejects non-positive shotNumber", () => {
    expect(
      labeledShotSchema.safeParse({
        shotNumber: 0,
        startFrame: 10,
        endFrame: 50,
        cameraOrientation: "front",
      }).success,
    ).toBe(false);
    expect(
      labeledShotSchema.safeParse({
        shotNumber: -1,
        startFrame: 10,
        endFrame: 50,
        cameraOrientation: "front",
      }).success,
    ).toBe(false);
  });

  it("rejects negative frame indices", () => {
    expect(
      labeledShotSchema.safeParse({
        shotNumber: 1,
        startFrame: -1,
        endFrame: 50,
        cameraOrientation: "front",
      }).success,
    ).toBe(false);
  });
});

describe("labelDataSchema", () => {
  it("accepts valid label data with per-shot orientation", () => {
    const labelData = {
      video: "test-video.mp4",
      labeledBy: "tester",
      labeledAt: "2024-01-01T00:00:00Z",
      shots: [
        {
          shotNumber: 1,
          startFrame: 10,
          endFrame: 50,
          cameraOrientation: "front",
        },
      ],
    };
    const result = labelDataSchema.safeParse(labelData);
    expect(result.success).toBe(true);
  });

  it("accepts empty shots array", () => {
    const labelData = {
      video: "test-video.mp4",
      labeledBy: "tester",
      labeledAt: "2024-01-01T00:00:00Z",
      shots: [],
    };
    expect(labelDataSchema.safeParse(labelData).success).toBe(true);
  });

  it("rejects invalid shot orientation", () => {
    const labelData = {
      video: "test-video.mp4",
      labeledBy: "tester",
      labeledAt: "2024-01-01T00:00:00Z",
      shots: [
        {
          shotNumber: 1,
          startFrame: 10,
          endFrame: 50,
          cameraOrientation: "invalid",
        },
      ],
    };
    expect(labelDataSchema.safeParse(labelData).success).toBe(false);
  });
});

describe("isPoseData", () => {
  it("returns true for valid pose data", () => {
    const poseData = {
      video: "test.mp4",
      fps: 30,
      totalFrames: 100,
      width: 1920,
      height: 1080,
      extractedAt: "2024-01-01T00:00:00Z",
      frames: [],
    };
    expect(isPoseData(poseData)).toBe(true);
  });

  it("returns false for invalid data", () => {
    expect(isPoseData({})).toBe(false);
    expect(isPoseData(null)).toBe(false);
    expect(isPoseData(undefined)).toBe(false);
    expect(isPoseData("string")).toBe(false);
  });
});

describe("isLabelData", () => {
  it("returns true for valid label data", () => {
    const labelData = {
      video: "test.mp4",
      labeledBy: "tester",
      labeledAt: "2024-01-01T00:00:00Z",
      orientation: "front",
      shots: [],
    };
    expect(isLabelData(labelData)).toBe(true);
  });

  it("returns false for invalid data", () => {
    expect(isLabelData({})).toBe(false);
    expect(isLabelData(null)).toBe(false);
    expect(isLabelData(undefined)).toBe(false);
  });
});
