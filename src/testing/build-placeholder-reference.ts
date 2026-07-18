#!/usr/bin/env npx tsx
/**
 * Builds PLACEHOLDER reference assets from test-data clips (metrics overhaul
 * Steps 6/10 stand-in until real NBA clips exist).
 *
 *   npm run metrics:reference
 *
 * Treats a handful of side-view test-data clips as "reference players",
 * derives thresholds and per-keyframe reference skeletons, and writes:
 *   reference/thresholds.json + reference/reference-poses.json      (validator)
 *   app/static/reference/thresholds.json + reference-poses.json     (app)
 *
 * Replace with `metrics:extract` + `metrics:thresholds` output once real clips
 * are gathered — the formats are identical.
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

import * as fs from "fs";
import * as path from "path";
import { detectKeyframesFromFrames } from "../detection/keyframe-phases";
import {
  buildReferenceSkeletons,
  deriveThresholds,
  extractShotMetrics,
  flattenMetrics,
  keyframeFramesFromPoseData,
  normalizeSkeleton,
  summarize,
  REFERENCE_VERSION,
  type NormLandmark,
  type PlayerSummary,
} from "../metrics/v2";
import { KEYFRAME_IDS, type KeyframeId, type PoseData } from "./types";

// Side-view clips that stand in for pros (good posture-metric coverage).
const REFERENCE_CLIPS = [
  "20190804_140654",
  "20190103_180930",
  "20190103_181419",
  "20190804_140617",
  "20190818_142631",
  "20201212_134104",
];

const summaries: PlayerSummary[] = [];
const skeletonSamples: Partial<Record<KeyframeId, (NormLandmark | null)[][]>> = {};

for (const clip of REFERENCE_CLIPS) {
  const posesPath = path.join("test-data", clip, "poses.json");
  if (!fs.existsSync(posesPath)) continue;
  const poses = JSON.parse(fs.readFileSync(posesPath, "utf8")) as PoseData;
  const kfFrames = keyframeFramesFromPoseData(poses);
  const byFrame = new Map(kfFrames.map((f) => [f.frameIndex, f]));

  const shots = extractShotMetrics(poses, {
    shootingHand: "right",
    cameraOrientation: "side-left",
  });

  // Per-clip metric summary (each clip = one "player").
  const values = new Map<string, number[]>();
  for (const shot of shots) {
    for (const m of flattenMetrics(shot)) {
      if (!m.reliable) continue;
      if (!values.has(m.id)) values.set(m.id, []);
      values.get(m.id)!.push(m.value);
    }
    // Reference skeletons: normalize each keyframe pose.
    const kf = detectKeyframesFromFrames(
      kfFrames,
      shot.shot.startFrame,
      shot.shot.endFrame,
    );
    for (const id of KEYFRAME_IDS) {
      const frameIdx = kf.get(id);
      if (typeof frameIdx !== "number") continue;
      const frame = byFrame.get(frameIdx);
      if (!frame) continue;
      const norm = normalizeSkeleton(frame);
      if (!norm) continue;
      (skeletonSamples[id] ??= []).push(norm);
    }
  }
  const metrics: Record<string, ReturnType<typeof summarize>> = {};
  for (const [id, vals] of values) metrics[id] = summarize(vals);
  summaries.push({ player: clip, metrics });
}

const thresholds = deriveThresholds(summaries);
const byKeyframe = buildReferenceSkeletons(skeletonSamples);
const referencePoses = {
  version: REFERENCE_VERSION,
  generatedFrom: summaries.map((s) => s.player),
  byKeyframe,
};

const targets = [
  path.join(process.cwd(), "reference"),
  path.join(process.cwd(), "app", "static", "reference"),
];
for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "thresholds.json"), JSON.stringify(thresholds, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "reference-poses.json"), JSON.stringify(referencePoses, null, 2) + "\n");
}

const kfCount = Object.keys(byKeyframe).length;
const scored = Object.values(thresholds.metrics).filter((t) => !t.reportedOnly).length;
console.log(
  `Placeholder reference from ${summaries.length} clip(s): ` +
    `${Object.keys(thresholds.metrics).length} metrics (${scored} scored), ` +
    `${kfCount} keyframe skeleton(s).`,
);
console.log(`Wrote reference/ and app/static/reference/ (thresholds.json + reference-poses.json).`);
