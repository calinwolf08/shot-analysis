/**
 * How much do shot detection and the keyframe checks change when pose frames arrive
 * at 10 or 15 fps instead of 30? Subsamples every recorded pose track
 * (test-data/ + the app fixtures), runs the same detection + keyframe checks, and
 * matches shots by time.
 *
 *   FPS_REPORT=1 npx vitest run src/lib/features/live-practice/debug/__tests__/fps-compare.test.ts
 *
 * Writes test-results/fps-compare.md.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import type { KeyframeTargets, PoseData } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";
import {
  landmarkFramesToPoseData,
  poseDataToLandmarkFrames,
  runReplayAnalysis,
} from "$lib/features/analysis/replay/replay-pipeline";
import {
  POSE_PAD_AFTER,
  POSE_PAD_BEFORE,
  keyframesForPoses,
  scoreShotKeyframes,
} from "$lib/features/scoring/keyframes";
import type { ReviewPoseFrame, ShotReviewPoses } from "$lib/shared/db/repos";

const ROOT = join(process.cwd(), "..", "test-data");
const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets-keyframes.json"),
    "utf8",
  ),
) as KeyframeTargets;

interface ShotOut {
  /** Mid time of the shot (ms). */
  t: number;
  overall: number | null;
  metrics: Record<string, { value: number; reliable: boolean; unit: string }>;
}

/** Detection + keyframe checks for a frame stream, with `fps` passed to the detector. */
function analyse(
  frames: LandmarkFrame[],
  fps: number,
  hand: "left" | "right",
): ShotOut[] {
  const pose = landmarkFramesToPoseData(frames, fps, {
    width: 1080,
    height: 1920,
  });
  const res = runReplayAnalysis(
    frames,
    { shootingHand: hand, profile: "pro-form" },
    { fps },
  );
  const review: ReviewPoseFrame[] = [];
  for (const f of pose.frames) {
    if (!f.landmarks || f.landmarks.length === 0) continue;
    review.push({
      frameIndex: review.length,
      t: f.timestamp * 1000,
      landmarks: f.landmarks.map((l) => ({
        x: l.x,
        y: l.y,
        visibility: l.visibility,
      })),
    });
  }
  return res.shots.map((a) => {
    const poses: ShotReviewPoses = {
      fps,
      width: 1080,
      height: 1920,
      frames: review.slice(
        Math.max(0, a.frameRange.start - POSE_PAD_BEFORE),
        a.frameRange.end + POSE_PAD_AFTER + 1,
      ),
    };
    const kf = keyframesForPoses(poses, hand);
    const card = scoreShotKeyframes(kf, targets);
    const t0 = review[a.frameRange.start]?.t ?? 0;
    const t1 = review[a.frameRange.end]?.t ?? t0;
    const metrics: ShotOut["metrics"] = {};
    for (const [id, m] of Object.entries(kf.checks))
      if (typeof m.value === "number" && isFinite(m.value))
        metrics[id] = { value: m.value, reliable: m.reliable, unit: m.unit };
    return { t: (t0 + t1) / 2, overall: card.overall, metrics };
  });
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const p90 = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]!;
};

describe.skipIf(!process.env.FPS_REPORT)("10/15 vs 30 fps", () => {
  it("report", () => {
    const tracks: { id: string; pose: PoseData; hand: "left" | "right" }[] = [];
    for (const id of readdirSync(ROOT).sort()) {
      const p = join(ROOT, id, "poses.json");
      if (!existsSync(p)) continue;
      tracks.push({
        id,
        pose: JSON.parse(readFileSync(p, "utf8")),
        hand: "right",
      });
    }
    const variants = [
      { name: "10 fps (live today: detector told 30)", step: 3, told: 30 },
      { name: "10 fps (detector told 10)", step: 3, told: 10 },
      { name: "15 fps (detector told 15)", step: 2, told: 15 },
    ];
    const lines: string[] = ["# Pose frame rate: 10/15 fps vs 30 fps", ""];
    const rows: string[] = [];
    const perMetric = new Map<
      string,
      { unit: string; diffs: Map<string, number[]> }
    >();
    const overallDiff = new Map<string, number[]>();
    const counts = new Map<
      string,
      { base: number; found: number; extra: number }
    >();

    for (const tr of tracks) {
      const frames = poseDataToLandmarkFrames(tr.pose);
      const base = analyse(frames, 30, tr.hand);
      const row = [tr.id, String(base.length)];
      for (const v of variants) {
        const sub = frames.filter((_, i) => i % v.step === 0);
        const shots = analyse(sub, v.told, tr.hand);
        const c = counts.get(v.name) ?? { base: 0, found: 0, extra: 0 };
        c.base += base.length;
        const used = new Set<number>();
        for (const b of base) {
          // Same shot: mid times within 0.6 s.
          let best = -1;
          let bd = 600;
          shots.forEach((s, k) => {
            const d = Math.abs(s.t - b.t);
            if (!used.has(k) && d < bd) {
              bd = d;
              best = k;
            }
          });
          if (best < 0) continue;
          used.add(best);
          c.found++;
          const s = shots[best]!;
          if (b.overall !== null && s.overall !== null) {
            const l = overallDiff.get(v.name) ?? [];
            l.push(s.overall - b.overall);
            overallDiff.set(v.name, l);
          }
          for (const [id, m] of Object.entries(b.metrics)) {
            const o = s.metrics[id];
            if (!o || !m.reliable) continue;
            const e = perMetric.get(id) ?? { unit: m.unit, diffs: new Map() };
            const l = e.diffs.get(v.name) ?? [];
            l.push(o.value - m.value);
            e.diffs.set(v.name, l);
            perMetric.set(id, e);
          }
        }
        c.extra += shots.length - used.size;
        counts.set(v.name, c);
        row.push(`${shots.length}`);
      }
      rows.push(`| ${row.join(" | ")} |`);
    }

    lines.push("## Shots detected per recording", "");
    lines.push(
      `| recording | 30 fps | ${variants.map((v) => v.name).join(" | ")} |`,
    );
    lines.push(`|---|---|${variants.map(() => "---").join("|")}|`);
    lines.push(...rows, "");
    lines.push(
      "| variant | 30 fps shots | matched | missed | extra |",
      "|---|---|---|---|---|",
    );
    for (const v of variants) {
      const c = counts.get(v.name)!;
      lines.push(
        `| ${v.name} | ${c.base} | ${c.found} | ${c.base - c.found} | ${c.extra} |`,
      );
    }
    lines.push("", "## Overall score change (matched shots, 0–10 scale)", "");
    lines.push(
      "| variant | n | median change | median abs | p90 abs |",
      "|---|---|---|---|---|",
    );
    for (const v of variants) {
      const d = overallDiff.get(v.name) ?? [];
      const a = d.map(Math.abs);
      lines.push(
        `| ${v.name} | ${d.length} | ${median(d).toFixed(2)} | ${median(a).toFixed(2)} | ${p90(a).toFixed(2)} |`,
      );
    }
    lines.push(
      "",
      "## Per metric: |10/15 fps − 30 fps| (matched shots, metrics reliable at 30 fps)",
      "",
      `| metric | unit | ${variants.map((v) => `${v.name} median / p90 (n)`).join(" | ")} |`,
      `|---|---|${variants.map(() => "---").join("|")}|`,
    );
    for (const [id, e] of [...perMetric.entries()].sort()) {
      const cells = variants.map((v) => {
        const a = (e.diffs.get(v.name) ?? []).map(Math.abs);
        return a.length
          ? `${median(a).toFixed(2)} / ${p90(a).toFixed(2)} (${a.length})`
          : "–";
      });
      lines.push(`| ${id} | ${e.unit} | ${cells.join(" | ")} |`);
    }
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/fps-compare.md", lines.join("\n") + "\n");
    console.log(lines.join("\n"));
  }, 600_000);
});
