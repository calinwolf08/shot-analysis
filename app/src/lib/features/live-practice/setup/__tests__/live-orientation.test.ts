import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectOrientation } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";
import { landmarkFramesToPoseData } from "$lib/features/analysis/replay/replay-pipeline";
import { standingLandmarks } from "$lib/features/analysis/replay/positioning-script";
import {
  classifyFrameOrientation,
  detectLiveOrientation,
  isNearSideBodyVisible,
  nearSideOf,
  torsoSeparation,
} from "../live-orientation";

const FIXTURES = join(__dirname, "../../../../../../src-tests/fixtures/poses");

function fixtureFrames(id: string): LandmarkFrame[] {
  const raw = JSON.parse(
    readFileSync(join(FIXTURES, `${id}.json`), "utf8"),
  ) as {
    frames: LandmarkFrame[];
  };
  return raw.frames;
}

/**
 * Human-labeled shot windows (test-data/<id>/labels.json) for the committed
 * fixtures. "side-left" = the player's LEFT side is nearest the camera.
 */
const LABELED: { id: string; start: number; end: number; label: string }[] = [
  { id: "20201212_134104", start: 75, end: 112, label: "side-right" },
  { id: "20190103_180930", start: 84, end: 111, label: "side-right" },
  { id: "20190103_180930", start: 245, end: 270, label: "front" },
  { id: "20190804_140654", start: 616, end: 654, label: "side-right" },
  { id: "20190804_140654", start: 745, end: 782, label: "side-right" },
];

const frame = (
  landmarks: LandmarkFrame["landmarks"],
  ts = 0,
): LandmarkFrame => ({
  frameIndex: ts,
  timestamp: ts,
  poseConfidence: 0.9,
  landmarks,
});

const OPTS = { nearSideMinVis: 0.5, headMinVis: 0.5 };

describe("near side", () => {
  it("maps orientation names to the side nearest the camera", () => {
    expect(nearSideOf("side-left")).toBe("left");
    expect(nearSideOf("side-right")).toBe("right");
  });
});

describe("isNearSideBodyVisible", () => {
  it("passes side-on with the far side occluded", () => {
    const f = frame(standingLandmarks("side", "right"));
    expect(isNearSideBodyVisible(f, "right", OPTS)).toBe(true);
  });
  it("auto judges the side actually nearest (wrong side still 'in frame')", () => {
    const f = frame(standingLandmarks("side", "left"));
    expect(isNearSideBodyVisible(f, "auto", OPTS)).toBe(true);
    expect(isNearSideBodyVisible(f, "right", OPTS)).toBe(false);
  });
  it("fails when judged on the occluded side", () => {
    const f = frame(standingLandmarks("side", "right"));
    expect(isNearSideBodyVisible(f, "left", OPTS)).toBe(false);
  });
  it("fails when the feet are below the frame", () => {
    const f = frame(standingLandmarks("side", "right", 0.2));
    expect(isNearSideBodyVisible(f, "right", OPTS)).toBe(false);
  });
  it("fails with no pose", () => {
    expect(isNearSideBodyVisible(frame(null), "right", OPTS)).toBe(false);
  });
});

describe("classifyFrameOrientation", () => {
  it("reads synthetic stances", () => {
    expect(
      classifyFrameOrientation(
        frame(standingLandmarks("facing", "right")),
        0.5,
      ),
    ).toBe("front");
    expect(
      classifyFrameOrientation(frame(standingLandmarks("side", "right")), 0.5),
    ).toBe("side-right");
    expect(
      classifyFrameOrientation(frame(standingLandmarks("side", "left")), 0.5),
    ).toBe("side-left");
  });

  it("is distance-independent (same stance, half the size)", () => {
    const small = standingLandmarks("facing", "right").map((l) => ({
      ...l,
      x: 0.5 + (l.x - 0.5) / 2,
      y: 0.5 + (l.y - 0.5) / 2,
    }));
    expect(torsoSeparation(frame(small))).toBeCloseTo(
      torsoSeparation(frame(standingLandmarks("facing", "right")))!,
      5,
    );
  });
});

describe("detectLiveOrientation on labeled fixture shots", () => {
  for (const s of LABELED) {
    it(`${s.id} [${s.start}-${s.end}] reads as ${s.label}`, () => {
      const frames = fixtureFrames(s.id).slice(s.start, s.end + 1);
      const r = detectLiveOrientation(frames, { maxSideSeparation: 0.5 });
      expect(r.orientation).toBe(s.label);
    });
  }

  it("never confuses which side faces the camera on side-on shots", () => {
    // Includes a shot labeled side-left that is actually fairly angled
    // (separation ≈ 0.59): it may read as "front", but never the wrong side.
    const sides = [
      ...LABELED.filter((l) => l.label.startsWith("side")),
      { id: "20190804_140654", start: 17, end: 50, label: "side-left" },
    ];
    for (const s of sides) {
      const frames = fixtureFrames(s.id).slice(s.start, s.end + 1);
      const wrong = s.label === "side-left" ? "side-right" : "side-left";
      const r = detectLiveOrientation(frames, {
        maxSideSeparation: 0.5,
        required: wrong,
      });
      expect(r.requiredAgreement).toBeLessThan(0.1);
    }
  });

  it("improves on the library detector for side-on with occlusion", () => {
    // The synthetic side stance mirrors real side-on output (far side at low
    // visibility); the library detector can't classify it.
    const frames = Array.from({ length: 30 }, (_, i) =>
      frame(standingLandmarks("side", "right"), i * 33),
    );
    expect(detectOrientation(landmarkFramesToPoseData(frames, 30))).toBe(
      "unknown",
    );
    expect(
      detectLiveOrientation(frames, { maxSideSeparation: 0.5 }).orientation,
    ).toBe("side-right");
  });
});
