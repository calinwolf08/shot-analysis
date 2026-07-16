// Failure report at tightened tolerance (set_point ±1, all other keyframes
// ±2, boundary start/end ±2), comparing labeled data to the RUNTIME output
// (detected shot boundaries). Best-overlap shot matching; no exclusions.
import * as fs from "fs";
import * as path from "path";
import { createShotDetector } from "../detection/integrated-shot-detector";
import {
  detectKeyframesFromFrames,
  poseLandmarksToFrames,
} from "../detection/keyframe-phases";
import { KEYFRAME_IDS } from "./types";

const TOL: Record<string, number> = { set_point: 1 };
const DEFAULT_TOL = 2;
const tolFor = (k: string) => TOL[k] ?? DEFAULT_TOL;

const EMPTY = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  visibility: 0,
  confidence: 0,
}));
const toSeq = (frames: any[]) =>
  frames.map((f: any) => ({
    landmarks:
      f.landmarks && f.landmarks.length
        ? f.landmarks.map((l: any) => ({
            x: l.x,
            y: l.y,
            z: l.z,
            visibility: l.visibility,
            confidence: l.confidence ?? l.visibility,
          }))
        : EMPTY,
    poseConfidence: f.poseConfidence ?? 0,
  }));

let totalChecks = 0;
let totalFails = 0;
const perKf: Record<string, { n: number; fail: number }> = {};

for (const video of fs.readdirSync("test-data").sort()) {
  const dir = path.join("test-data", video);
  if (!fs.existsSync(path.join(dir, "poses.json"))) continue;
  if (!fs.existsSync(path.join(dir, "labels.json"))) continue;
  const poses = JSON.parse(
    fs.readFileSync(path.join(dir, "poses.json"), "utf8"),
  );
  const labels = JSON.parse(
    fs.readFileSync(path.join(dir, "labels.json"), "utf8"),
  );
  const seq = toSeq(poses.frames);
  const shots = createShotDetector().processFrames(seq);
  const kfFrames = poseLandmarksToFrames(seq);

  const lines: string[] = [];
  for (const lab of labels.shots) {
    let best: any = null;
    let bestOv = -1e9;
    for (const s of shots) {
      const ov =
        Math.min(s.frameRange.end, lab.endFrame) -
        Math.max(s.frameRange.start, lab.startFrame);
      if (ov > bestOv) {
        bestOv = ov;
        best = s;
      }
    }
    if (!best || bestOv < 0) {
      lines.push(
        `  shot ${lab.shotNumber}: NO DETECTED SHOT (labeled ${lab.startFrame}-${lab.endFrame})`,
      );
      continue;
    }
    const kf = detectKeyframesFromFrames(
      kfFrames,
      best.frameRange.start,
      best.frameRange.end,
    );
    const fails: string[] = [];
    for (const [name, det, lv] of [
      ["start", best.frameRange.start, lab.startFrame],
      ["end", best.frameRange.end, lab.endFrame],
    ] as const) {
      const diff = det - lv;
      totalChecks++;
      if (Math.abs(diff) > DEFAULT_TOL) {
        totalFails++;
        fails.push(`${name} ${det}v${lv} (${diff > 0 ? "+" : ""}${diff})`);
      }
    }
    for (const id of KEYFRAME_IDS) {
      const lv = lab[id];
      if (typeof lv !== "number") continue;
      const det = kf.get(id);
      perKf[id] ??= { n: 0, fail: 0 };
      perKf[id].n++;
      totalChecks++;
      if (typeof det !== "number") {
        perKf[id].fail++;
        totalFails++;
        fails.push(`${id} MISSING (lab ${lv})`);
        continue;
      }
      const diff = det - lv;
      if (Math.abs(diff) > tolFor(id)) {
        perKf[id].fail++;
        totalFails++;
        fails.push(
          `${id} ${det}v${lv} (${diff > 0 ? "+" : ""}${diff}, tol±${tolFor(id)})`,
        );
      }
    }
    if (fails.length) {
      lines.push(
        `  shot ${lab.shotNumber} [${lab.cameraOrientation}] det@${best.frameRange.start}-${best.frameRange.end}:\n      ${fails.join("\n      ")}`,
      );
    }
  }
  if (lines.length) {
    console.log(`\n### ${video}`);
    console.log(lines.join("\n"));
  }
}

console.log(
  `\n================ SUMMARY (set_point ±1, others ±2) ================`,
);
console.log(`total checks: ${totalChecks}, failures: ${totalFails}`);
console.log("per-keyframe fails:");
for (const id of KEYFRAME_IDS) {
  const s = perKf[id];
  if (s) console.log(`  ${id.padEnd(20)} ${s.fail}/${s.n} fail`);
}
