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

// Chronological keyframe order for the cascade view (arm + leg tracks
// interleaved roughly by time). "start" (the boundary) anchors the chain.
const CHRONO = [
  "legs_start_bending",
  "ball_low_point",
  "ball_starts_upward",
  "leg_bend_low_point",
  "legs_start_extending",
  "set_point",
  "release",
  "arms_fully_extended",
  "feet_leave_ground",
  "feet_land",
] as const;

type ShotRecord = {
  video: string;
  shot: number;
  orient: string;
  detected: boolean;
  startPass: boolean | null;
  kf: Record<string, "P" | "F" | "M" | "·">; // pass / fail / missing / not-labeled
};
const records: ShotRecord[] = [];

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
    const rec: ShotRecord = {
      video,
      shot: lab.shotNumber,
      orient: lab.cameraOrientation,
      detected: !!best && bestOv >= 0,
      startPass: null,
      kf: {},
    };
    if (!best || bestOv < 0) {
      records.push(rec);
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
      const pass = Math.abs(diff) <= DEFAULT_TOL;
      if (name === "start") rec.startPass = pass;
      if (!pass) {
        totalFails++;
        fails.push(`${name} ${det}v${lv} (${diff > 0 ? "+" : ""}${diff})`);
      }
    }
    for (const id of KEYFRAME_IDS) {
      const lv = lab[id];
      if (typeof lv !== "number") {
        rec.kf[id] = "·";
        continue;
      }
      const det = kf.get(id);
      perKf[id] ??= { n: 0, fail: 0 };
      perKf[id].n++;
      totalChecks++;
      if (typeof det !== "number") {
        perKf[id].fail++;
        totalFails++;
        rec.kf[id] = "M";
        fails.push(`${id} MISSING (lab ${lv})`);
        continue;
      }
      const diff = det - lv;
      if (Math.abs(diff) > tolFor(id)) {
        perKf[id].fail++;
        totalFails++;
        rec.kf[id] = "F";
        fails.push(
          `${id} ${det}v${lv} (${diff > 0 ? "+" : ""}${diff}, tol±${tolFor(id)})`,
        );
      } else {
        rec.kf[id] = "P";
      }
    }
    records.push(rec);
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

// --- Per-keyframe pass rate, in chronological order -----------------------
const startPassN = records.filter((r) => r.startPass === true).length;
const startTotal = records.filter((r) => r.startPass !== null).length;
console.log(`\n---- Pass rate per keyframe (chronological) ----`);
console.log(
  `  ${"start (boundary)".padEnd(22)} ${startPassN}/${startTotal}  (${pct(startPassN, startTotal)})`,
);
for (const id of CHRONO) {
  const s = perKf[id];
  if (!s) continue;
  const pass = s.n - s.fail;
  console.log(`  ${id.padEnd(22)} ${pass}/${s.n}  (${pct(pass, s.n)})`);
}

// --- Cascade: pass rate conditioned on whether the START is correct -------
console.log(
  `\n---- Cascade: downstream pass rate given the shot START (±2) ----`,
);
console.log(
  `  (shots with start correct: ${startPassN}; start wrong: ${startTotal - startPassN})`,
);
console.log(`  keyframe               start✓        start✗`);
for (const id of CHRONO) {
  const good = records.filter(
    (r) => r.startPass === true && r.kf[id] && r.kf[id] !== "·",
  );
  const bad = records.filter(
    (r) => r.startPass === false && r.kf[id] && r.kf[id] !== "·",
  );
  const gp = good.filter((r) => r.kf[id] === "P").length;
  const bp = bad.filter((r) => r.kf[id] === "P").length;
  console.log(
    `  ${id.padEnd(22)} ${`${gp}/${good.length}`.padEnd(6)} ${pct(gp, good.length).padEnd(6)}  ${`${bp}/${bad.length}`.padEnd(6)} ${pct(bp, bad.length)}`,
  );
}

// --- Per-shot P/F grid (P=pass F=fail M=missing ·=not labeled) ------------
console.log(`\n---- Per-shot grid (columns = chronological keyframes) ----`);
console.log(
  `  legend: st=start | ${CHRONO.map((c) => c.slice(0, 2)).join(" ")}`,
);
for (const r of records) {
  const st = r.startPass === null ? "-" : r.startPass ? "P" : "F";
  const cells = CHRONO.map((id) => r.kf[id] ?? "·").join("  ");
  const tag = !r.detected ? " (undetected)" : "";
  console.log(
    `  ${(r.video + " #" + r.shot).padEnd(26)} st=${st}  ${cells}${tag}`,
  );
}

function pct(a: number, b: number): string {
  return b === 0 ? "n/a" : `${Math.round((100 * a) / b)}%`;
}
