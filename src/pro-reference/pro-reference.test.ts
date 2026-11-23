import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, describe, expect, it } from "vitest";
import {
  KEYFRAMES,
  angleLimit,
  autoFlags,
  keyframeChecks,
  limitClass,
  measureAttempt,
  metricRows,
  newAttempt,
  playerOutliers,
  statusCounts,
  upgradeLabels,
  withinAngleLimit,
  type PoseFile,
} from "./index";
import {
  clipFile,
  createClip,
  listLibrary,
  readLabels,
  safeId,
  writeLabels,
  writePlayer,
} from "./library";
import type { LiveTargetsV3 } from "../metrics/v3";

const curryDir = path.resolve(__dirname, "../../test-data/stephen-curry-1");
const poses = JSON.parse(
  fs.readFileSync(path.join(curryDir, "poses.json"), "utf8"),
) as PoseFile;
const v1 = JSON.parse(
  fs.readFileSync(path.join(curryDir, "labels.json"), "utf8"),
);
const targets = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../app/static/reference/live-targets-v3.json"),
    "utf8",
  ),
) as LiveTargetsV3;

describe("labels v2", () => {
  it("reads v1 labels: key frames moved under `keyframes`, unreviewed", () => {
    const l = upgradeLabels(v1);
    expect(l.version).toBe(2);
    expect(l.shots).toHaveLength(v1.shots.length);
    const s = l.shots[0]!;
    expect(s.status).toBe("unreviewed");
    expect(s.camera).toBeNull();
    expect(s.keyframes.set_point).toBe(v1.shots[0].set_point);
    expect(s.cameraOrientation).toBe(v1.shots[0].cameraOrientation);
    expect(Object.keys(s.keyframes).every((k) => !k.startsWith("shot"))).toBe(
      true,
    );
  });

  it("round-trips v2 and keeps decisions, camera and flags", () => {
    const l = upgradeLabels({
      version: 2,
      shots: [
        {
          ...newAttempt(50, 80),
          keyframes: { set_point: 70 },
          status: "excluded",
          excludeReason: "blocked by defender",
          camera: {
            autoAngle: 31,
            angle: 28,
            source: "manual",
            confirmed: true,
            standingOpen: false,
          },
          metricFlags: { "release.elbow_path": "elbow hidden" },
        },
        { ...newAttempt(10, 30), status: "bogus" },
      ],
    });
    // Sorted by start frame, renumbered.
    expect(l.shots.map((s) => [s.shotNumber, s.startFrame])).toEqual([
      [1, 10],
      [2, 50],
    ]);
    expect(l.shots[0]!.status).toBe("unreviewed");
    const b = l.shots[1]!;
    expect(b.status).toBe("excluded");
    expect(b.camera).toMatchObject({
      angle: 28,
      source: "manual",
      confirmed: true,
    });
    expect(b.metricFlags).toEqual({ "release.elbow_path": "elbow hidden" });
    expect(upgradeLabels(l)).toEqual(l);
  });

  it("counts statuses", () => {
    expect(
      statusCounts([
        { status: "approved" },
        { status: "approved" },
        { status: "flagged" },
      ]),
    ).toEqual({ unreviewed: 0, approved: 2, flagged: 1, excluded: 0 });
  });

  it("lists key frames in shot order", () => {
    expect(KEYFRAMES[0]!.key).toBe("legs_start_bending");
    expect(KEYFRAMES.map((k) => k.key)).toContain("release");
  });
});

describe("angle limits", () => {
  it("in-plane 25°, arm 15°, guide hand never", () => {
    expect(limitClass("load.knee_depth")).toBe("inPlane");
    expect(limitClass("setPoint.elbow_angle")).toBe("arm");
    expect(limitClass("rise.t_start")).toBe("timing");
    expect(limitClass("release.guide_hand_dx")).toBe("never");
    expect(angleLimit("load.knee_depth")).toBe(25);
    expect(withinAngleLimit("setPoint.elbow_angle", 20)).toBe(false);
    expect(withinAngleLimit("release.guide_hand_dy", 0)).toBe(true);
    expect(withinAngleLimit("release.guide_hand_dy", 1)).toBe(false);
    expect(angleLimit("load.knee_depth", { "load.knee_depth": 10 })).toBe(10);
  });
});

describe("measuring an attempt", () => {
  const shot = upgradeLabels(v1).shots[1]!;
  const m = measureAttempt(poses, shot, { shootingHand: "right" });

  it("estimates the camera angle and applies it (Curry ≈ 35–43° off side-on)", () => {
    expect(m.autoCamera!.angle).toBeGreaterThan(30);
    expect(m.autoCamera!.angle).toBeLessThan(48);
    expect(m.angle).toBe(m.autoCamera!.angle);
    expect(m.usedLabels).toBe(true);
    expect(m.primary.metrics["load.knee_depth"]!.value).not.toBe(
      m.uncorrected.metrics["load.knee_depth"]!.value,
    );
  });

  it("a confirmed camera angle wins over the estimate", () => {
    const fixed = measureAttempt(
      poses,
      {
        ...shot,
        camera: {
          autoAngle: 40,
          angle: 0,
          source: "manual",
          confirmed: true,
          standingOpen: false,
        },
      },
      { shootingHand: "right" },
    );
    expect(fixed.angle).toBe(0);
    expect(fixed.primary.metrics["load.knee_depth"]!.value).toBeCloseTo(
      fixed.uncorrected.metrics["load.knee_depth"]!.value,
      9,
    );
  });

  it("with true limb lengths, knee / elbow angles are measured in 3D", () => {
    const seg = measureAttempt(poses, shot, {
      shootingHand: "right",
      segmentLengths: { thigh: 0.9, shin: 0.9, upperArm: 0.6, forearm: 0.5 },
    });
    expect(seg.planar).not.toBeNull();
    expect(m.planar).toBeNull();
    // Only knee / elbow-based metrics can change.
    expect(seg.primary.metrics["load.ball_drop"]!.value).toBeCloseTo(
      seg.planar!.metrics["load.ball_drop"]!.value,
      9,
    );
  });

  it("compares labelled key frames with detection", () => {
    const checks = keyframeChecks(shot, m.app);
    const sp = checks.find((c) => c.key === "set_point")!;
    expect(sp.label).toBe(shot.keyframes.set_point);
    expect(sp.detected).not.toBeNull();
    expect(sp.diff).toBe(sp.detected! - sp.label!);
    // Release has no v3 event: nothing to compare.
    expect(checks.find((c) => c.key === "release")!.status).toBe("unlabelled");
  });

  it("rows: every target metric, with scores, limits and flags", () => {
    const flagged = {
      ...shot,
      metricFlags: { "load.knee_depth": "knee hidden" },
    };
    const rows = metricRows(m, flagged, targets);
    expect(rows).toHaveLength(Object.keys(targets.metrics).length);
    const knee = rows.find((r) => r.id === "load.knee_depth")!;
    expect(knee.flag).toBe("knee hidden");
    expect(knee.angleLimit).toBe(25);
    expect(knee.overAngleLimit).toBe(true); // Curry's clip is ~40° off
    expect(
      rows.find((r) => r.id === "release.guide_hand_dx")!.overAngleLimit,
    ).toBe(true);
    const flags = autoFlags(m, rows, keyframeChecks(shot, m.app));
    expect(flags.map((f) => f.kind)).toContain("over-angle-limit");
  });
});

describe("outliers within a player", () => {
  it("flags a value far from the player's other shots", () => {
    const v = {
      a: { x: 10, y: 1 },
      b: { x: 11, y: 1 },
      c: { x: 10.5, y: 1 },
      d: { x: 9.5, y: 1 },
      e: { x: 30, y: 1 },
    };
    const o = playerOutliers(v);
    expect([...o.e!]).toEqual(["x"]);
    expect(o.a!.size).toBe(0);
    // Too few values: nothing flagged.
    expect(playerOutliers({ a: { x: 1 }, b: { x: 100 } }).b!.size).toBe(0);
  });
});

describe("library on disk", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pro-lib-"));
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("creates players and clips, lists them with status counts", async () => {
    await writePlayer(root, "curry", {
      name: "Stephen Curry",
      shootingHand: "right",
    });
    await createClip(root, "curry", "clip-01");
    fs.mkdirSync(path.join(root, "_example"));
    fs.writeFileSync(path.join(root, "curry", "clip-01", "poses.json"), "{}");
    fs.writeFileSync(path.join(root, "curry", "clip-01", "game.mp4"), "");
    await writeLabels(root, "curry", "clip-01", {
      shots: [
        {
          ...newAttempt(1, 9),
          status: "approved",
          camera: {
            autoAngle: 12,
            angle: 10,
            source: "manual",
            confirmed: true,
            standingOpen: false,
          },
        },
        newAttempt(20, 30),
      ],
    });
    const lib = await listLibrary(root);
    expect(lib.map((p) => p.id)).toEqual(["curry"]);
    const p = lib[0]!;
    expect(p.name).toBe("Stephen Curry");
    expect(p.counts).toEqual({
      unreviewed: 1,
      approved: 1,
      flagged: 0,
      excluded: 0,
    });
    const c = p.clips[0]!;
    expect(c).toMatchObject({ id: "clip-01", poses: true, video: "game.mp4" });
    expect(c.attempts[0]).toMatchObject({ angle: 10, confirmed: true });
    expect((await readLabels(root, "curry", "clip-01")).version).toBe(2);
  });

  it("rejects unsafe ids and file names", async () => {
    expect(safeId("Steph Curry!")).toBe("steph-curry");
    await expect(writePlayer(root, "../x", {})).rejects.toThrow();
    expect(() =>
      clipFile(root, "curry", "clip-01", "../player.json"),
    ).toThrow();
    expect(() => clipFile(root, "curry", "clip-01", "notes.txt")).toThrow();
    expect(clipFile(root, "curry", "clip-01", "poses.json")).toContain(
      "clip-01",
    );
  });
});
