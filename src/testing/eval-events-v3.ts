#!/usr/bin/env npx tsx
/**
 * Agreement of v3 sub-frame events (and the current keyframe detector, as a
 * baseline) with the HUMAN labels on every labeled side-on shot in test-data.
 *
 *   npx tsx src/testing/eval-events-v3.ts
 */
import * as fs from "fs";
import * as path from "path";
import { computeSignals, type SignalFrame } from "../metrics/v3/signals";
import { detectEvents, frameAt } from "../metrics/v3/events";
import { detectKeyframesFromFrames } from "../detection/keyframe-phases";
import { keyframeFramesFromPoseData } from "../metrics/v2/extract";

import {
  EVENT_PAD_AFTER as PAD_AFTER,
  EVENT_PAD_BEFORE as PAD_BEFORE,
  LABEL_FOR_EVENT as MAP,
  isClippedStartLabel,
} from "../metrics/v3/labeled";

interface Row { v3: number | null; old: number | null; label: number }
const rows = new Map<string, Row[]>();

const root = path.resolve(process.cwd(), "test-data");
for (const dir of fs.readdirSync(root)) {
  const lp = path.join(root, dir, "labels.json");
  const pp = path.join(root, dir, "poses.json");
  if (!fs.existsSync(lp) || !fs.existsSync(pp)) continue;
  const labels = JSON.parse(fs.readFileSync(lp, "utf8"));
  const poses = JSON.parse(fs.readFileSync(pp, "utf8"));
  const aspect = poses.width / poses.height;
  const kfFrames = keyframeFramesFromPoseData(poses);
  for (const s of labels.shots ?? []) {
    if (!String(s.cameraOrientation).startsWith("side")) continue;
    const lo = Math.max(0, s.startFrame - PAD_BEFORE);
    const hi = Math.min(poses.frames.length - 1, s.endFrame + PAD_AFTER);
    const frames = (poses.frames as SignalFrame[]).slice(lo, hi + 1);
    const sig = computeSignals(frames, { aspect, shootingHand: "right" });
    const ev = detectEvents(sig);
    const old = detectKeyframesFromFrames(kfFrames, s.startFrame, s.endFrame);
    for (const [id, key] of MAP) {
      const label = s[key];
      if (typeof label !== "number") continue;
      // Start-of-movement labels placed ON the shot's first frame are clipped
      // by the labeled window (movement visibly began earlier) — not scored.
      if (isClippedStartLabel(key, label, s.startFrame)) continue;
      const v = ev[id];
      const r: Row = {
        v3: v === null ? null : frameAt(sig, v),
        old: old.get(key as never) ?? null,
        label,
      };
      rows.set(key, [...(rows.get(key) ?? []), r]);
    }
  }
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");
const stat = (rs: Row[], k: "v3" | "old") => {
  const errs = rs.filter((r) => r[k] !== null).map((r) => r[k]! - r.label);
  const within = errs.filter((e) => Math.abs(e) <= 1).length;
  const within2 = errs.filter((e) => Math.abs(e) <= 2).length;
  const sorted = errs.map(Math.abs).sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : NaN;
  const bias = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : NaN;
  return { within: pct(within, rs.length), within2: pct(within2, rs.length), med: med.toFixed(2), bias: bias.toFixed(2), missing: rs.length - errs.length };
};
console.log("label                    n   v3 ±1  ±2   med  bias miss | old ±1  ±2   med  bias miss");
let tot = 0, totIn = 0, oldIn = 0, totIn2 = 0, oldIn2 = 0;
for (const [key, rs] of rows) {
  const a = stat(rs, "v3"), b = stat(rs, "old");
  tot += rs.length;
  totIn += rs.filter((r) => r.v3 !== null && Math.abs(r.v3 - r.label) <= 1).length;
  oldIn += rs.filter((r) => r.old !== null && Math.abs(r.old - r.label) <= 1).length;
  totIn2 += rs.filter((r) => r.v3 !== null && Math.abs(r.v3 - r.label) <= 2).length;
  oldIn2 += rs.filter((r) => r.old !== null && Math.abs(r.old - r.label) <= 2).length;
  console.log(`${key.padEnd(24)} ${String(rs.length).padStart(2)}  ${a.within.padStart(5)} ${a.within2.padStart(4)} ${a.med.padStart(5)} ${a.bias.padStart(5)} ${String(a.missing).padStart(3)} | ${b.within.padStart(5)} ${b.within2.padStart(4)} ${b.med.padStart(5)} ${b.bias.padStart(5)} ${String(b.missing).padStart(3)}`);
}
console.log(`ALL ${tot}: within ±1 — v3 ${pct(totIn, tot)} · old ${pct(oldIn, tot)}; within ±2 — v3 ${pct(totIn2, tot)} · old ${pct(oldIn2, tot)}`);
