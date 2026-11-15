#!/usr/bin/env npx tsx
/**
 * Live-targets pipeline (live-first redesign — Milestone 1, step 1).
 *
 *   npm run targets:build                         # default: stephen-curry-1
 *   npm run targets:build -- <dir> <out> <hand>   # overrides
 *
 * Builds the editable per-metric target band used by the live deviation
 * scoring (step 2). Reads the APPROVED reference shots in a labeled test-data
 * folder (default `test-data/stephen-curry-1`, Stephen Curry's 7 side-left
 * shots), runs the v2 metrics (sequencing + structure) over each labeled shot
 * window using DETECTED keyframes — the same way the live pipeline measures, so
 * targets and live shots are comparable — collects the reliable values per
 * metric id, and writes:
 *
 *   app/static/reference/live-targets.json
 *
 * For each metric id it records the ideal (mean), the observed spread
 * (passMin/passMax = min/max across the approved shots), a ramp scale for the
 * 1..10 deviation score, and section/phase/label metadata. The file is meant to
 * be hand-tuned — see the `notes` block it emits and docs/follow-up-work.md.
 *
 * @see docs/live-redesign-plan.md §3.1
 */

import * as fs from "fs";
import * as path from "path";
import { detectKeyframesFromFrames } from "../detection/keyframe-phases";
import {
  keyframeFramesFromPoseData,
  metricsForShot,
  flattenMetrics,
  summarize,
  categoryOf,
  labelFor,
  categoryLabel,
  type ShootingHand,
} from "../metrics/v2";

const LIVE_TARGETS_VERSION = 1 as const;

// ---- args -------------------------------------------------------------------

const srcDir = path.resolve(
  process.cwd(),
  process.argv[2]?.trim() || "test-data/stephen-curry-1",
);
const outPath = path.resolve(
  process.cwd(),
  process.argv[3]?.trim() || "app/static/reference/live-targets.json",
);
const shootingHand: ShootingHand =
  process.argv[4]?.trim() === "left" ? "left" : "right";

// ---- stats ------------------------------------------------------------------

function mean(v: readonly number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Sample standard deviation (n−1); 0 when fewer than 2 values. */
function sampleSd(v: readonly number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  const ss = v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1);
  return Math.sqrt(ss);
}

/**
 * The per-deviation-step scale for the 1..10 score. Prefer the sample SD; fall
 * back to a robust estimate so a degenerate SD (tiny n, identical values) never
 * yields a divide-by-zero or an absurdly sensitive ramp.
 */
function rampScale(
  sd: number,
  iqr: number,
  range: number,
  ideal: number,
): number {
  if (sd > 0) return sd;
  if (iqr > 0) return iqr / 1.349; // IQR→SD for a normal distribution
  if (range > 0) return range / 4;
  return Math.max(1e-6, Math.abs(ideal) * 0.05);
}

/** Native unit + direction vocabulary for a metric id (hand-editable after). */
function metaFor(id: string): {
  unit: string;
  direction: { low: string; high: string };
} {
  if (id.startsWith("seq.")) {
    // Signed normalized gap (fraction of shot duration): below ideal = the
    // later event arrived earlier than the pros', above = later.
    return { unit: "Δt", direction: { low: "early", high: "late" } };
  }
  // Structure metrics vary in unit (degrees, body-scaled fractions, …); left
  // generic for hand-tuning. Positional metrics read low/high.
  return { unit: "", direction: { low: "low", high: "high" } };
}

// ---- load + extract ---------------------------------------------------------

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

const posesPath = path.join(srcDir, "poses.json");
const labelsPath = path.join(srcDir, "labels.json");
for (const p of [posesPath, labelsPath]) {
  if (!fs.existsSync(p)) {
    console.error(
      `Missing ${path.relative(process.cwd(), p)} — nothing to build.`,
    );
    process.exit(1);
  }
}

interface Poses {
  readonly fps?: number;
  readonly frames: readonly { readonly poseConfidence?: number }[];
}
interface Labels {
  readonly shots?: readonly {
    readonly startFrame: number;
    readonly endFrame: number;
    readonly cameraOrientation?: string;
  }[];
}

const poses = readJson<Poses>(posesPath);
const labels = readJson<Labels>(labelsPath);
const fps = poses.fps ?? 30;
const shots = labels.shots ?? [];

if (shots.length === 0) {
  console.error(
    `No labeled shots in ${path.relative(process.cwd(), labelsPath)}.`,
  );
  process.exit(1);
}

// Keyframe-frame view once; keyframes are DETECTED per shot (not read from the
// labels) to match the live pipeline.
const kfFrames = keyframeFramesFromPoseData(poses as never);

// metric id -> reliable values across the approved shots
const values = new Map<string, number[]>();
let usedShots = 0;

for (const lab of shots) {
  const start = lab.startFrame;
  const end = lab.endFrame;
  const kf = detectKeyframesFromFrames(kfFrames, start, end);
  let sum = 0;
  let n = 0;
  for (let i = start; i <= end && i < poses.frames.length; i++) {
    const c = poses.frames[i]?.poseConfidence;
    if (typeof c === "number") {
      sum += c;
      n++;
    }
  }
  const metrics = metricsForShot(
    kfFrames,
    kf,
    { startFrame: start, endFrame: end },
    {
      fps,
      cameraOrientation: lab.cameraOrientation ?? "side-left",
      shootingHand,
      poseConfidence: n > 0 ? sum / n : 0,
    },
  );
  usedShots++;
  for (const m of flattenMetrics(metrics)) {
    if (!m.reliable || !Number.isFinite(m.value)) continue;
    if (!values.has(m.id)) values.set(m.id, []);
    values.get(m.id)!.push(m.value);
  }
}

// ---- build targets ----------------------------------------------------------

interface TargetStats {
  n: number;
  mean: number;
  sd: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  iqr: number;
}
interface Target {
  section: "structure" | "sequencing";
  phase: string | null;
  label: string;
  unit: string;
  ideal: number;
  sd: number;
  passMin: number;
  passMax: number;
  rampSd: number;
  direction: { low: string; high: string };
  scored: boolean;
  stats: TargetStats;
}

const metrics: Record<string, Target> = {};
for (const [id, vals] of [...values.entries()].sort()) {
  const s = summarize(vals);
  if (!s) continue;
  const m = mean(vals);
  const sd = sampleSd(vals);
  const category = categoryOf(id);
  const section = category === "sequencing" ? "sequencing" : "structure";
  const phase = category === "sequencing" ? null : category;
  const meta = metaFor(id);
  // The `*.ankles` posture offset is ≈0 by construction (follow-up §1.2); and a
  // single reading can't establish a band — both are reported-only, not scored.
  const scored = s.n >= 2 && !/ankle/i.test(id);

  metrics[id] = {
    section,
    phase,
    label: labelFor(id),
    unit: meta.unit,
    ideal: m,
    sd,
    passMin: s.min,
    passMax: s.max,
    rampSd: rampScale(sd, s.iqr, s.max - s.min, m),
    direction: meta.direction,
    scored,
    stats: {
      n: s.n,
      mean: m,
      sd,
      median: s.median,
      min: s.min,
      max: s.max,
      p25: s.p25,
      p75: s.p75,
      iqr: s.iqr,
    },
  };
}

const output = {
  version: LIVE_TARGETS_VERSION,
  builtFrom: path.basename(srcDir),
  source: path.relative(process.cwd(), srcDir),
  shootingHand,
  shots: usedShots,
  generatedAt: new Date().toISOString(),
  notes: [
    "PLACEHOLDER baseline derived from a small set of approved reference shots.",
    "ideal = mean across the approved shots; passMin/passMax = observed min/max;",
    "rampSd scales the 1..10 deviation score (≈ one point per SD outside the band).",
    "Hand-tune freely — this file is the tuning surface and is not clobbered by the pipeline.",
    "`*.ankles` posture metrics are ≈0 by construction and left unscored (docs/follow-up-work.md §1.2).",
    "`unit`/`direction` default by metric family; refine per metric where a precise unit is known.",
  ],
  metrics,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

// ---- console summary --------------------------------------------------------

const ids = Object.keys(metrics).sort();
const scoredCount = ids.filter((id) => metrics[id]!.scored).length;
console.log(
  `\nBuilt live targets from ${usedShots} shot(s) in ${output.source} (${shootingHand}-handed).`,
);
console.log(
  `  metrics: ${ids.length}   scored: ${scoredCount}   reported-only: ${ids.length - scoredCount}`,
);
console.log(`  output:  ${path.relative(process.cwd(), outPath)}\n`);
console.log(
  `  ${"metric".padEnd(38)} ${"sec".padEnd(5)} ${"ideal".padStart(9)}  ${"[pass band]".padStart(20)}  n  scored`,
);
for (const id of ids) {
  const t = metrics[id]!;
  const band = `[${t.passMin.toFixed(2)}..${t.passMax.toFixed(2)}]`;
  console.log(
    `  ${id.padEnd(38)} ${(t.section === "sequencing" ? "seq" : "str").padEnd(5)} ${t.ideal
      .toFixed(3)
      .padStart(
        9,
      )}  ${band.padStart(20)}  ${String(t.stats.n).padStart(1)}  ${t.scored ? "✓" : "—"}`,
  );
}
void categoryLabel; // reserved for a future grouped report
