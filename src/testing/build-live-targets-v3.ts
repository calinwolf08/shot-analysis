#!/usr/bin/env npx tsx
/**
 * Builds app/static/reference/live-targets-v3.json from the labeled reference
 * shots (default: test-data/stephen-curry-1), measured with the v3 catalog.
 * Keeps hand edits (label / wording / override) from an existing file.
 *
 *   npm run targets:build:v3 [-- <dir> <out> <hand>]
 */
import * as fs from "fs";
import * as path from "path";
import {
  EVENT_PAD_AFTER,
  EVENT_PAD_BEFORE,
  buildTargetsV3,
  computeShotMetricsV3,
  type LiveTargetsV3,
  type SignalFrame,
} from "../metrics/v3";

const srcDir = path.resolve(process.argv[2]?.trim() || "test-data/stephen-curry-1");
const outPath = path.resolve(process.argv[3]?.trim() || "app/static/reference/live-targets-v3.json");
const hand = process.argv[4]?.trim() === "left" ? "left" : "right";

const poses = JSON.parse(fs.readFileSync(path.join(srcDir, "poses.json"), "utf8"));
const labels = JSON.parse(fs.readFileSync(path.join(srcDir, "labels.json"), "utf8"));
const shots = (labels.shots ?? []).map((s: { startFrame: number; endFrame: number }) => {
  const lo = Math.max(0, s.startFrame - EVENT_PAD_BEFORE);
  const hi = Math.min(poses.frames.length - 1, s.endFrame + EVENT_PAD_AFTER);
  return computeShotMetricsV3(poses.frames.slice(lo, hi + 1) as SignalFrame[], {
    aspect: poses.width / poses.height,
    shootingHand: hand,
  });
});
const previous = fs.existsSync(outPath)
  ? (JSON.parse(fs.readFileSync(outPath, "utf8")) as LiveTargetsV3)
  : null;
const out = buildTargetsV3(
  shots,
  { builtFrom: `${path.basename(srcDir)} (${shots.length} labeled shots)`, shootingHand: hand },
  previous,
);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
const scored = Object.values(out.metrics).filter((m) => m.scored).length;
console.log(`Wrote ${path.relative(process.cwd(), outPath)}: ${Object.keys(out.metrics).length} metrics (${scored} scored).`);
