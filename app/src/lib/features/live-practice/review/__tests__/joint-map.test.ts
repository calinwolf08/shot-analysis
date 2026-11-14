import { describe, expect, it } from "vitest";
import {
  LM,
  PHASE_KEYFRAME,
  alignReferenceToPlayer,
  landmarksForMetric,
  similarityFromAnchors,
  type Pt,
} from "../joint-map";

describe("landmarksForMetric", () => {
  it("resolves shooting-arm joints by hand", () => {
    expect(landmarksForMetric("setPoint.elbow_flare", "right")).toEqual([
      LM.R_ELBOW,
    ]);
    expect(landmarksForMetric("setPoint.elbow_flare", "left")).toEqual([
      LM.L_ELBOW,
    ]);
    expect(
      landmarksForMetric("followThrough.wrist_snap_angle", "right"),
    ).toEqual([LM.R_WRIST]);
    expect(landmarksForMetric("load.ball_low_height", "right")).toEqual([
      LM.R_WRIST,
    ]);
  });

  it("puts the guide-hand metric on the OFF hand", () => {
    expect(landmarksForMetric("release.guide_hand_duration", "right")).toEqual([
      LM.L_WRIST,
    ]);
    expect(landmarksForMetric("release.guide_hand_duration", "left")).toEqual([
      LM.R_WRIST,
    ]);
  });

  it("marks bilateral joints on both sides", () => {
    expect(landmarksForMetric("setPoint.shoulders", "right")).toEqual([
      LM.L_SHOULDER,
      LM.R_SHOULDER,
    ]);
    expect(landmarksForMetric("rise.knees_end", "right")).toEqual([
      LM.L_KNEE,
      LM.R_KNEE,
    ]);
    expect(landmarksForMetric("gather.hips", "right")).toEqual([
      LM.L_HIP,
      LM.R_HIP,
    ]);
    expect(landmarksForMetric("gather.head", "right")).toEqual([LM.NOSE]);
  });

  it("returns no joint for sequencing/timing metrics", () => {
    expect(landmarksForMetric("seq.set_point__legs_extend", "right")).toEqual(
      [],
    );
  });

  it("maps every phase to a reference keyframe", () => {
    for (const phase of [
      "gather",
      "load",
      "rise",
      "setPoint",
      "release",
      "followThrough",
    ]) {
      expect(PHASE_KEYFRAME[phase]).toBeTruthy();
    }
  });
});

describe("similarityFromAnchors", () => {
  it("is identity when anchors coincide", () => {
    const t = similarityFromAnchors(
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    );
    expect(t).not.toBeNull();
    const p = t!({ x: 0.3, y: 0.7 });
    expect(p.x).toBeCloseTo(0.3, 6);
    expect(p.y).toBeCloseTo(0.7, 6);
  });

  it("maps the anchor pair onto the target pair (handles the y-flip)", () => {
    // reference: hip(0,0) shoulder(0,1) [y-up]; player: hip(0,1) shoulder(0,0) [y-down]
    const t = similarityFromAnchors(
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    )!;
    const sho = t({ x: 0, y: 1 });
    expect(sho.x).toBeCloseTo(0, 6);
    expect(sho.y).toBeCloseTo(0, 6);
  });

  it("returns null on degenerate reference anchors", () => {
    expect(
      similarityFromAnchors(
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ),
    ).toBeNull();
  });
});

describe("alignReferenceToPlayer", () => {
  it("places the reference hip midpoint on the player hip midpoint", () => {
    const ref: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
    const pl: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
    ref[LM.L_HIP] = { x: -0.1, y: 0 };
    ref[LM.R_HIP] = { x: 0.1, y: 0 };
    ref[LM.L_SHOULDER] = { x: -0.1, y: 0.5 };
    ref[LM.R_SHOULDER] = { x: 0.1, y: 0.5 };
    pl[LM.L_HIP] = { x: 0.4, y: 0.8 };
    pl[LM.R_HIP] = { x: 0.6, y: 0.8 };
    pl[LM.L_SHOULDER] = { x: 0.4, y: 0.4 };
    pl[LM.R_SHOULDER] = { x: 0.6, y: 0.4 };
    const t = alignReferenceToPlayer(ref, pl)!;
    expect(t).not.toBeNull();
    const hipMid = t({ x: 0, y: 0 }); // reference hip midpoint
    expect(hipMid.x).toBeCloseTo(0.5, 6);
    expect(hipMid.y).toBeCloseTo(0.8, 6);
  });

  it("returns null when an anchor landmark is missing", () => {
    const ref: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
    const pl: Pt[] = Array.from({ length: 10 }, () => ({ x: 0, y: 0 })); // too short
    expect(alignReferenceToPlayer(ref, pl)).toBeNull();
  });
});
