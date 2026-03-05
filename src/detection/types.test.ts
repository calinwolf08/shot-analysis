/**
 * Type tests for shot detection and phase identification types.
 * These tests verify the type contracts and helper function behavior.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import {
  ShotPhase,
  SHOT_PHASES,
  TOTAL_SHOT_PHASES,
  type PhaseRange,
  type ShotBoundary,
  type ShotPhases,
  type Shot,
  type FrameLabel,
  type ShotDetectionResult,
  createEmptyPhaseRange,
  createEmptyShot,
  createNoShotFrameLabel,
  hasPhase,
  getPhaseDuration,
  getShotDuration,
} from "./types";

describe("ShotPhase enum", () => {
  describe("has all 6 required phases", () => {
    it("has Gather phase", () => {
      expect(ShotPhase.Gather).toBe("gather");
    });

    it("has Load phase", () => {
      expect(ShotPhase.Load).toBe("load");
    });

    it("has Rise phase", () => {
      expect(ShotPhase.Rise).toBe("rise");
    });

    it("has SetPoint phase", () => {
      expect(ShotPhase.SetPoint).toBe("setPoint");
    });

    it("has Release phase", () => {
      expect(ShotPhase.Release).toBe("release");
    });

    it("has FollowThrough phase", () => {
      expect(ShotPhase.FollowThrough).toBe("followThrough");
    });
  });

  describe("SHOT_PHASES constant", () => {
    it("contains all 6 phases", () => {
      expect(SHOT_PHASES).toHaveLength(6);
    });

    it("contains all expected values", () => {
      expect(SHOT_PHASES).toContain(ShotPhase.Gather);
      expect(SHOT_PHASES).toContain(ShotPhase.Load);
      expect(SHOT_PHASES).toContain(ShotPhase.Rise);
      expect(SHOT_PHASES).toContain(ShotPhase.SetPoint);
      expect(SHOT_PHASES).toContain(ShotPhase.Release);
      expect(SHOT_PHASES).toContain(ShotPhase.FollowThrough);
    });

    it("is readonly", () => {
      expectTypeOf(SHOT_PHASES).toEqualTypeOf<readonly ShotPhase[]>();
    });
  });

  describe("TOTAL_SHOT_PHASES constant", () => {
    it("equals 6", () => {
      expect(TOTAL_SHOT_PHASES).toBe(6);
    });

    it("matches SHOT_PHASES length", () => {
      expect(TOTAL_SHOT_PHASES).toBe(SHOT_PHASES.length);
    });
  });
});

describe("PhaseRange type", () => {
  describe("structure", () => {
    it("has required properties with correct types", () => {
      const range: PhaseRange = {
        startFrame: 10,
        endFrame: 25,
      };

      expect(typeof range.startFrame).toBe("number");
      expect(typeof range.endFrame).toBe("number");
    });

    it("enforces readonly properties at type level", () => {
      expectTypeOf<PhaseRange["startFrame"]>().toEqualTypeOf<number>();
      expectTypeOf<PhaseRange["endFrame"]>().toEqualTypeOf<number>();
    });
  });

  describe("valid phase range data", () => {
    it("accepts same start and end frame for single-frame phase", () => {
      const range: PhaseRange = {
        startFrame: 50,
        endFrame: 50,
      };

      expect(range.startFrame).toBe(range.endFrame);
    });

    it("accepts zero-based frame indices", () => {
      const range: PhaseRange = {
        startFrame: 0,
        endFrame: 10,
      };

      expect(range.startFrame).toBe(0);
    });
  });
});

describe("ShotBoundary type", () => {
  describe("structure", () => {
    it("has required properties with correct types", () => {
      const boundary: ShotBoundary = {
        frameIndex: 30,
        fromPhase: ShotPhase.Load,
        toPhase: ShotPhase.Rise,
        confidence: 0.95,
      };

      expect(typeof boundary.frameIndex).toBe("number");
      expect(typeof boundary.fromPhase).toBe("string");
      expect(typeof boundary.toPhase).toBe("string");
      expect(typeof boundary.confidence).toBe("number");
    });

    it("enforces readonly properties at type level", () => {
      expectTypeOf<ShotBoundary["frameIndex"]>().toEqualTypeOf<number>();
      expectTypeOf<ShotBoundary["fromPhase"]>().toEqualTypeOf<ShotPhase>();
      expectTypeOf<ShotBoundary["toPhase"]>().toEqualTypeOf<ShotPhase>();
      expectTypeOf<ShotBoundary["confidence"]>().toEqualTypeOf<number>();
    });
  });

  describe("valid boundary data", () => {
    it("accepts transitions between adjacent phases", () => {
      const boundary: ShotBoundary = {
        frameIndex: 100,
        fromPhase: ShotPhase.SetPoint,
        toPhase: ShotPhase.Release,
        confidence: 0.88,
      };

      expect(boundary.fromPhase).toBe(ShotPhase.SetPoint);
      expect(boundary.toPhase).toBe(ShotPhase.Release);
    });

    it("accepts confidence values in 0-1 range", () => {
      const lowConfidence: ShotBoundary = {
        frameIndex: 50,
        fromPhase: ShotPhase.Gather,
        toPhase: ShotPhase.Load,
        confidence: 0.0,
      };

      const highConfidence: ShotBoundary = {
        frameIndex: 60,
        fromPhase: ShotPhase.Load,
        toPhase: ShotPhase.Rise,
        confidence: 1.0,
      };

      expect(lowConfidence.confidence).toBe(0.0);
      expect(highConfidence.confidence).toBe(1.0);
    });
  });
});

describe("ShotPhases type", () => {
  describe("structure", () => {
    it("allows all phases to be optional", () => {
      const emptyPhases: ShotPhases = {};

      expect(Object.keys(emptyPhases)).toHaveLength(0);
    });

    it("accepts partial phases for partial shots", () => {
      const partialPhases: ShotPhases = {
        [ShotPhase.Rise]: { startFrame: 0, endFrame: 10 },
        [ShotPhase.SetPoint]: { startFrame: 11, endFrame: 20 },
        [ShotPhase.Release]: { startFrame: 21, endFrame: 25 },
      };

      expect(partialPhases[ShotPhase.Gather]).toBeUndefined();
      expect(partialPhases[ShotPhase.Load]).toBeUndefined();
      expect(partialPhases[ShotPhase.Rise]).toBeDefined();
    });

    it("accepts all phases for complete shots", () => {
      const fullPhases: ShotPhases = {
        [ShotPhase.Gather]: { startFrame: 0, endFrame: 10 },
        [ShotPhase.Load]: { startFrame: 11, endFrame: 25 },
        [ShotPhase.Rise]: { startFrame: 26, endFrame: 40 },
        [ShotPhase.SetPoint]: { startFrame: 41, endFrame: 50 },
        [ShotPhase.Release]: { startFrame: 51, endFrame: 55 },
        [ShotPhase.FollowThrough]: { startFrame: 56, endFrame: 70 },
      };

      expect(fullPhases[ShotPhase.Gather]).toBeDefined();
      expect(fullPhases[ShotPhase.FollowThrough]).toBeDefined();
    });
  });
});

describe("Shot type", () => {
  describe("structure", () => {
    it("has required properties with correct types", () => {
      const shot: Shot = {
        shotIndex: 0,
        frameRange: { start: 10, end: 80 },
        phases: {},
      };

      expect(typeof shot.shotIndex).toBe("number");
      expect(typeof shot.frameRange.start).toBe("number");
      expect(typeof shot.frameRange.end).toBe("number");
      expect(typeof shot.phases).toBe("object");
    });

    it("allows optional boundaries", () => {
      const shotWithoutBoundaries: Shot = {
        shotIndex: 0,
        frameRange: { start: 0, end: 50 },
        phases: {},
      };

      const shotWithBoundaries: Shot = {
        shotIndex: 0,
        frameRange: { start: 0, end: 50 },
        phases: {},
        boundaries: [
          {
            frameIndex: 20,
            fromPhase: ShotPhase.Load,
            toPhase: ShotPhase.Rise,
            confidence: 0.9,
          },
        ],
      };

      expect(shotWithoutBoundaries.boundaries).toBeUndefined();
      expect(shotWithBoundaries.boundaries).toHaveLength(1);
    });

    it("allows optional confidence", () => {
      const shotWithoutConfidence: Shot = {
        shotIndex: 0,
        frameRange: { start: 0, end: 50 },
        phases: {},
      };

      const shotWithConfidence: Shot = {
        shotIndex: 0,
        frameRange: { start: 0, end: 50 },
        phases: {},
        confidence: 0.92,
      };

      expect(shotWithoutConfidence.confidence).toBeUndefined();
      expect(shotWithConfidence.confidence).toBe(0.92);
    });
  });

  describe("valid shot data", () => {
    it("accepts zero-based shot index", () => {
      const shot: Shot = {
        shotIndex: 0,
        frameRange: { start: 0, end: 100 },
        phases: {},
      };

      expect(shot.shotIndex).toBe(0);
    });

    it("accepts multi-shot index", () => {
      const shot: Shot = {
        shotIndex: 5,
        frameRange: { start: 500, end: 600 },
        phases: {},
      };

      expect(shot.shotIndex).toBe(5);
    });

    it("accepts complete shot with all phases", () => {
      const shot: Shot = {
        shotIndex: 0,
        frameRange: { start: 10, end: 80 },
        phases: {
          [ShotPhase.Gather]: { startFrame: 10, endFrame: 20 },
          [ShotPhase.Load]: { startFrame: 21, endFrame: 35 },
          [ShotPhase.Rise]: { startFrame: 36, endFrame: 50 },
          [ShotPhase.SetPoint]: { startFrame: 51, endFrame: 60 },
          [ShotPhase.Release]: { startFrame: 61, endFrame: 65 },
          [ShotPhase.FollowThrough]: { startFrame: 66, endFrame: 80 },
        },
        confidence: 0.95,
      };

      expect(Object.keys(shot.phases)).toHaveLength(6);
    });
  });
});

describe("FrameLabel type", () => {
  describe("structure", () => {
    it("has required properties with correct types", () => {
      const label: FrameLabel = {
        frameIndex: 50,
        phase: ShotPhase.Rise,
        shotIndex: 0,
        confidence: 0.9,
      };

      expect(typeof label.frameIndex).toBe("number");
      expect(typeof label.phase).toBe("string");
      expect(typeof label.shotIndex).toBe("number");
      expect(typeof label.confidence).toBe("number");
    });

    it("allows null phase for non-shot frames", () => {
      const noShotLabel: FrameLabel = {
        frameIndex: 100,
        phase: null,
        shotIndex: null,
        confidence: 1.0,
      };

      expect(noShotLabel.phase).toBeNull();
      expect(noShotLabel.shotIndex).toBeNull();
    });

    it("enforces type level constraints", () => {
      expectTypeOf<FrameLabel["frameIndex"]>().toEqualTypeOf<number>();
      expectTypeOf<FrameLabel["phase"]>().toEqualTypeOf<ShotPhase | null>();
      expectTypeOf<FrameLabel["shotIndex"]>().toEqualTypeOf<number | null>();
      expectTypeOf<FrameLabel["confidence"]>().toEqualTypeOf<number>();
    });
  });

  describe("valid frame label data", () => {
    it("accepts shot frame with valid phase", () => {
      const label: FrameLabel = {
        frameIndex: 30,
        phase: ShotPhase.Load,
        shotIndex: 0,
        confidence: 0.88,
      };

      expect(label.phase).toBe(ShotPhase.Load);
    });

    it("accepts non-shot frame with null values", () => {
      const label: FrameLabel = {
        frameIndex: 200,
        phase: null,
        shotIndex: null,
        confidence: 0.95,
      };

      expect(label.phase).toBeNull();
    });
  });
});

describe("ShotDetectionResult type", () => {
  describe("structure", () => {
    it("has required properties with correct types", () => {
      const result: ShotDetectionResult = {
        shots: [],
        frameLabels: [],
        totalFrames: 0,
      };

      expect(Array.isArray(result.shots)).toBe(true);
      expect(Array.isArray(result.frameLabels)).toBe(true);
      expect(typeof result.totalFrames).toBe("number");
    });

    it("enforces readonly arrays at type level", () => {
      expectTypeOf<ShotDetectionResult["shots"]>().toEqualTypeOf<
        readonly Shot[]
      >();
      expectTypeOf<ShotDetectionResult["frameLabels"]>().toEqualTypeOf<
        readonly FrameLabel[]
      >();
      expectTypeOf<ShotDetectionResult["totalFrames"]>().toEqualTypeOf<
        number
      >();
    });
  });

  describe("valid result data", () => {
    it("accepts empty result for no shots detected", () => {
      const result: ShotDetectionResult = {
        shots: [],
        frameLabels: [
          { frameIndex: 0, phase: null, shotIndex: null, confidence: 1.0 },
        ],
        totalFrames: 1,
      };

      expect(result.shots).toHaveLength(0);
    });

    it("accepts result with multiple shots", () => {
      const result: ShotDetectionResult = {
        shots: [
          {
            shotIndex: 0,
            frameRange: { start: 10, end: 50 },
            phases: {},
          },
          {
            shotIndex: 1,
            frameRange: { start: 100, end: 150 },
            phases: {},
          },
        ],
        frameLabels: [],
        totalFrames: 200,
      };

      expect(result.shots).toHaveLength(2);
    });
  });
});

describe("createEmptyPhaseRange", () => {
  it("returns a PhaseRange with zero values", () => {
    const range = createEmptyPhaseRange();

    expect(range.startFrame).toBe(0);
    expect(range.endFrame).toBe(0);
  });

  it("returns a valid PhaseRange type", () => {
    const range = createEmptyPhaseRange();
    expectTypeOf(range).toEqualTypeOf<PhaseRange>();
  });
});

describe("createEmptyShot", () => {
  it("returns a Shot with default values", () => {
    const shot = createEmptyShot();

    expect(shot.shotIndex).toBe(0);
    expect(shot.frameRange.start).toBe(0);
    expect(shot.frameRange.end).toBe(0);
    expect(Object.keys(shot.phases)).toHaveLength(0);
  });

  it("accepts custom shot index", () => {
    const shot = createEmptyShot(5);

    expect(shot.shotIndex).toBe(5);
  });

  it("returns a valid Shot type", () => {
    const shot = createEmptyShot();
    expectTypeOf(shot).toEqualTypeOf<Shot>();
  });
});

describe("createNoShotFrameLabel", () => {
  it("returns a FrameLabel with null phase and shotIndex", () => {
    const label = createNoShotFrameLabel(100);

    expect(label.frameIndex).toBe(100);
    expect(label.phase).toBeNull();
    expect(label.shotIndex).toBeNull();
    expect(label.confidence).toBe(1.0);
  });

  it("returns a valid FrameLabel type", () => {
    const label = createNoShotFrameLabel(0);
    expectTypeOf(label).toEqualTypeOf<FrameLabel>();
  });
});

describe("hasPhase", () => {
  const phases: ShotPhases = {
    [ShotPhase.Rise]: { startFrame: 0, endFrame: 10 },
    [ShotPhase.SetPoint]: { startFrame: 11, endFrame: 20 },
    [ShotPhase.Release]: { startFrame: 21, endFrame: 25 },
  };

  it("returns true for present phases", () => {
    expect(hasPhase(phases, ShotPhase.Rise)).toBe(true);
    expect(hasPhase(phases, ShotPhase.SetPoint)).toBe(true);
    expect(hasPhase(phases, ShotPhase.Release)).toBe(true);
  });

  it("returns false for missing phases", () => {
    expect(hasPhase(phases, ShotPhase.Gather)).toBe(false);
    expect(hasPhase(phases, ShotPhase.Load)).toBe(false);
    expect(hasPhase(phases, ShotPhase.FollowThrough)).toBe(false);
  });

  it("returns false for empty phases object", () => {
    const emptyPhases: ShotPhases = {};
    expect(hasPhase(emptyPhases, ShotPhase.Rise)).toBe(false);
  });
});

describe("getPhaseDuration", () => {
  const phases: ShotPhases = {
    [ShotPhase.Rise]: { startFrame: 10, endFrame: 20 },
    [ShotPhase.SetPoint]: { startFrame: 21, endFrame: 21 },
    [ShotPhase.Release]: { startFrame: 22, endFrame: 30 },
  };

  it("returns correct duration for multi-frame phase", () => {
    // 20 - 10 + 1 = 11 frames
    expect(getPhaseDuration(phases, ShotPhase.Rise)).toBe(11);
  });

  it("returns 1 for single-frame phase", () => {
    // 21 - 21 + 1 = 1 frame
    expect(getPhaseDuration(phases, ShotPhase.SetPoint)).toBe(1);
  });

  it("returns 0 for missing phase", () => {
    expect(getPhaseDuration(phases, ShotPhase.Gather)).toBe(0);
  });

  it("returns correct duration for release phase", () => {
    // 30 - 22 + 1 = 9 frames
    expect(getPhaseDuration(phases, ShotPhase.Release)).toBe(9);
  });
});

describe("getShotDuration", () => {
  it("returns correct duration for shot", () => {
    const shot: Shot = {
      shotIndex: 0,
      frameRange: { start: 10, end: 80 },
      phases: {},
    };

    // 80 - 10 + 1 = 71 frames
    expect(getShotDuration(shot)).toBe(71);
  });

  it("returns 1 for single-frame shot", () => {
    const shot: Shot = {
      shotIndex: 0,
      frameRange: { start: 50, end: 50 },
      phases: {},
    };

    expect(getShotDuration(shot)).toBe(1);
  });

  it("returns correct duration for zero-based shot", () => {
    const shot: Shot = {
      shotIndex: 0,
      frameRange: { start: 0, end: 100 },
      phases: {},
    };

    // 100 - 0 + 1 = 101 frames
    expect(getShotDuration(shot)).toBe(101);
  });
});

describe("edge cases", () => {
  describe("partial shots (missing phases)", () => {
    it("handles video starting mid-shot (no gather)", () => {
      const partialShot: Shot = {
        shotIndex: 0,
        frameRange: { start: 0, end: 50 },
        phases: {
          [ShotPhase.Rise]: { startFrame: 0, endFrame: 15 },
          [ShotPhase.SetPoint]: { startFrame: 16, endFrame: 25 },
          [ShotPhase.Release]: { startFrame: 26, endFrame: 30 },
          [ShotPhase.FollowThrough]: { startFrame: 31, endFrame: 50 },
        },
      };

      expect(partialShot.phases[ShotPhase.Gather]).toBeUndefined();
      expect(partialShot.phases[ShotPhase.Load]).toBeUndefined();
      expect(partialShot.phases[ShotPhase.Rise]).toBeDefined();
    });

    it("handles video ending mid-shot (no follow through)", () => {
      const partialShot: Shot = {
        shotIndex: 0,
        frameRange: { start: 10, end: 55 },
        phases: {
          [ShotPhase.Gather]: { startFrame: 10, endFrame: 20 },
          [ShotPhase.Load]: { startFrame: 21, endFrame: 35 },
          [ShotPhase.Rise]: { startFrame: 36, endFrame: 45 },
          [ShotPhase.SetPoint]: { startFrame: 46, endFrame: 50 },
          [ShotPhase.Release]: { startFrame: 51, endFrame: 55 },
        },
      };

      expect(partialShot.phases[ShotPhase.FollowThrough]).toBeUndefined();
    });
  });

  describe("phase boundary overlap during detection", () => {
    it("boundaries can reference adjacent phases", () => {
      const boundaries: ShotBoundary[] = [
        {
          frameIndex: 20,
          fromPhase: ShotPhase.Gather,
          toPhase: ShotPhase.Load,
          confidence: 0.85,
        },
        {
          frameIndex: 35,
          fromPhase: ShotPhase.Load,
          toPhase: ShotPhase.Rise,
          confidence: 0.92,
        },
      ];

      expect(boundaries[0]!.toPhase).toBe(boundaries[1]!.fromPhase);
    });
  });

  describe("multiple shots in video", () => {
    it("handles multiple sequential shots", () => {
      const result: ShotDetectionResult = {
        shots: [
          {
            shotIndex: 0,
            frameRange: { start: 10, end: 80 },
            phases: {
              [ShotPhase.Release]: { startFrame: 60, endFrame: 65 },
            },
          },
          {
            shotIndex: 1,
            frameRange: { start: 120, end: 190 },
            phases: {
              [ShotPhase.Release]: { startFrame: 170, endFrame: 175 },
            },
          },
        ],
        frameLabels: [],
        totalFrames: 250,
      };

      expect(result.shots).toHaveLength(2);
      expect(result.shots[0]!.shotIndex).toBe(0);
      expect(result.shots[1]!.shotIndex).toBe(1);
    });
  });
});
