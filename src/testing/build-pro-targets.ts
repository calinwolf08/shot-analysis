#!/usr/bin/env npx tsx
/**
 * Builds the app's targets (and per-pro profiles) from the REVIEWED pro
 * library in reference-data/players (docs/pro-targets-plan.md, Phase 3).
 *
 *   npm run targets:build:pros [-- --dry-run] [-- --root <dir>]
 *
 * Reads only approved attempts (plus flagged ones when the config says so),
 * measures each from its labelled key frames with the confirmed camera angle
 * corrected for, and writes:
 *   app/static/reference/live-targets-v3.json   (what the app scores against)
 *   app/static/reference/pro-profiles.json      (per-pro values)
 *   reference-data/out/report.md                (calibration + detection report)
 *   reference-data/out/angle-trends.json        (leftover angle error per metric)
 * Each player's proportions are saved to their player.json.
 *
 * Config (optional): reference-data/targets-config.json — see BuildConfig.
 * --dry-run writes only the report.
 */
import * as fs from "fs";
import * as path from "path";
import {
  METRICS_V3_SCHEMA_VERSION,
  estimateProportions,
  type LiveTargetsV3,
} from "../metrics/v3";
import {
  buildConfig,
  frontalFor,
  buildProTargets,
  keyframeChecks,
  measureAttempt,
  reportMarkdown,
  upgradeLabels,
  withinAngleLimit,
  type MeasuredAttempt,
  type PoseFile,
} from "../pro-reference";
import { listLibrary, writePlayer } from "../pro-reference/library";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rootArg = args.indexOf("--root");
const root = path.resolve(
  rootArg >= 0 ? args[rootArg + 1]! : "reference-data/players",
);
const configPath = path.resolve(root, "..", "targets-config.json");
const targetsPath = path.resolve("app/static/reference/live-targets-v3.json");
const profilesPath = path.resolve("app/static/reference/pro-profiles.json");
const reportPath = path.resolve(root, "..", "out", "report.md");

const readJson = (p: string): unknown =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;

async function main(): Promise<void> {
  const cfg = buildConfig(readJson(configPath));
  const library = await listLibrary(root);
  const attempts: MeasuredAttempt[] = [];
  const dropped: { where: string; why: string }[] = [];
  const detection = new Map<string, number[]>();
  /** Metric id → values left out for the camera angle. */
  const overLimit = new Map<string, number>();
  const players: Record<
    string,
    { name: string; shootingHand: "left" | "right" }
  > = {};

  for (const p of library) {
    players[p.id] = { name: p.name, shootingHand: p.shootingHand };
    const clips = p.clips
      .filter((c) => c.poses)
      .map((c) => ({
        id: c.id,
        poses: readJson(path.join(root, p.id, c.id, "poses.json")) as PoseFile,
        labels: upgradeLabels(
          readJson(path.join(root, p.id, c.id, "labels.json")) ?? {},
        ),
      }));
    // Proportions from all of the player's frames (calibrates the angle).
    const props = estimateProportions(
      clips.map((c) => ({
        frames: c.poses.frames,
        aspect: c.poses.width / c.poses.height,
      })),
    );
    if (!dryRun) await writePlayer(root, p.id, { proportions: props });
    // Front-on calibration photo first, else widths seen in the clips.
    const frontal = frontalFor(p.calibration, props);
    for (const c of clips) {
      for (const s of c.labels.shots) {
        const where = `${p.id}/${c.id} shot ${s.shotNumber}`;
        const use =
          s.status === "approved" ||
          (cfg.includeFlagged && s.status === "flagged");
        if (!use) {
          if (s.status !== "unreviewed")
            dropped.push({
              where,
              why: s.status + (s.excludeReason ? `: ${s.excludeReason}` : ""),
            });
          continue;
        }
        const m = measureAttempt(c.poses, s, {
          shootingHand: p.shootingHand,
          ...(frontal ? { frontal } : {}),
        });
        if (!s.camera?.confirmed) {
          dropped.push({
            where,
            why: `camera angle not confirmed (used the estimate, ${m.angle.toFixed(0)}°) — still included`,
          });
        }
        const values: MeasuredAttempt["values"] = {};
        const out = values as Record<string, MeasuredAttempt["values"][string]>;
        for (const [id, x] of Object.entries(m.primary.metrics)) {
          if (!x.reliable || !Number.isFinite(x.value)) continue;
          if (id in s.metricFlags) continue;
          if (!withinAngleLimit(id, m.angle, cfg.angleLimits)) {
            overLimit.set(id, (overLimit.get(id) ?? 0) + 1);
            continue;
          }
          out[id] = {
            value: x.value,
            phase: x.phase,
            kind: x.kind,
            unit: x.unit,
            lowResolution: x.note === "low resolution",
          };
        }
        attempts.push({
          player: p.id,
          clip: c.id,
          shotNumber: s.shotNumber,
          angle: m.angle,
          values,
        });
        for (const k of keyframeChecks(s, m.app)) {
          if (k.diff === null) continue;
          detection.set(k.name, [
            ...(detection.get(k.name) ?? []),
            Math.abs(k.diff),
          ]);
        }
      }
    }
  }

  const previous = readJson(targetsPath) as LiveTargetsV3 | null;
  const result = buildProTargets({
    attempts,
    players,
    config: cfg,
    previous,
    metricsSchema: METRICS_V3_SCHEMA_VERSION,
  });
  const q = (xs: number[], f: number) =>
    [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))] ?? 0;
  const report = reportMarkdown(result, {
    attempts: { used: attempts.length, dropped },
    overLimit: [...overLimit].sort((a, b) => b[1] - a[1]),
    detection: [...detection].map(([event, xs]) => ({
      event,
      n: xs.length,
      median: q(xs, 0.5),
      p90: q(xs, 0.9),
    })),
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  // The fitted trends, for the review page's "at 0°" values.
  fs.writeFileSync(
    path.join(path.dirname(reportPath), "angle-trends.json"),
    JSON.stringify(result.angleTrends, null, 2) + "\n",
  );
  console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);

  if (result.profiles.pros.length === 0) {
    console.log(
      `No pro has ${cfg.minShotsPerPlayer}+ approved attempts yet (${attempts.length} approved in total): targets left unchanged.`,
    );
    return;
  }
  const scoredCount = Object.values(result.targets.metrics).filter(
    (m) => m.scored,
  ).length;
  if (scoredCount === 0) {
    console.log(
      "No metric can be scored from the approved attempts (see the report — likely camera angles beyond the limits): targets left unchanged.",
    );
    return;
  }
  if (dryRun) {
    console.log(
      `Dry run: ${result.profiles.pros.length} pro(s), ${attempts.length} shots — targets not written.`,
    );
    return;
  }
  fs.writeFileSync(targetsPath, JSON.stringify(result.targets, null, 2) + "\n");
  fs.writeFileSync(
    profilesPath,
    JSON.stringify(result.profiles, null, 2) + "\n",
  );
  console.log(
    `Wrote ${path.relative(process.cwd(), targetsPath)} (${Object.keys(result.targets.metrics).length} metrics, ${scoredCount} scored) and ${path.relative(process.cwd(), profilesPath)} (${result.profiles.pros.length} pros).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
