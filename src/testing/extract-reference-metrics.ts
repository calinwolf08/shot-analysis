#!/usr/bin/env npx tsx
/**
 * NBA reference metrics extraction (metrics overhaul Step 5).
 *
 *   npm run metrics:extract            # all players
 *   npm run metrics:extract -- curry   # only players whose folder matches
 *
 * Reads clips from reference-data/players/<player>/clip-N/poses.json, extracts
 * v2 metrics per shot (auto-detecting boundaries, or using labels.json when
 * present), and writes:
 *   reference-data/out/metrics/<player>/<clip>.metrics.json   per-clip metrics
 *   reference-data/out/players/<player>.summary.json          per-metric stats
 * plus a table flagging which metrics are unreliable/missing so you can see
 * which clips need better angles before deriving thresholds (Step 6).
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

import * as fs from "fs";
import * as path from "path";
import {
  detectKeyframesFromFrames,
} from "../detection/keyframe-phases";
import {
  extractShotMetrics,
  keyframeFramesFromPoseData,
  metricsForShot,
  flattenMetrics,
  summarize,
  type ShotMetricsV2,
  type ShootingHand,
} from "../metrics/v2";

const REF_DIR = path.join(process.cwd(), "reference-data");
const PLAYERS_DIR = path.join(REF_DIR, "players");
const OUT_DIR = path.join(REF_DIR, "out");

const playerFilter = process.argv[2]?.trim() ?? "";

interface PlayerConfig {
  name: string;
  shootingHand: ShootingHand;
}

function readPlayerConfig(dir: string, fallbackName: string): PlayerConfig {
  const p = path.join(dir, "player.json");
  if (fs.existsSync(p)) {
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      return {
        name: typeof j.name === "string" ? j.name : fallbackName,
        shootingHand: j.shootingHand === "left" ? "left" : "right",
      };
    } catch {
      /* fall through to defaults */
    }
  }
  return { name: fallbackName, shootingHand: "right" };
}

/** Extract metrics for one clip, honoring labels.json boundaries when present. */
function metricsForClip(
  clipDir: string,
  cfg: PlayerConfig,
): ShotMetricsV2[] {
  const poses = JSON.parse(
    fs.readFileSync(path.join(clipDir, "poses.json"), "utf8"),
  );
  const labelsPath = path.join(clipDir, "labels.json");
  if (!fs.existsSync(labelsPath)) {
    // Auto-detect boundaries + orientation.
    return extractShotMetrics(poses, { shootingHand: cfg.shootingHand });
  }
  // Use the human-labeled boundaries + per-shot orientation.
  const labels = JSON.parse(fs.readFileSync(labelsPath, "utf8"));
  const kfFrames = keyframeFramesFromPoseData(poses);
  const fps = poses.fps ?? 30;
  return (labels.shots ?? []).map((lab: any) => {
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
    return metricsForShot(
      kfFrames,
      kf,
      { startFrame: start, endFrame: end },
      {
        fps,
        cameraOrientation: lab.cameraOrientation ?? "side-left",
        shootingHand: cfg.shootingHand,
        poseConfidence: n > 0 ? sum / n : 0,
      },
    );
  });
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function scaffold(): void {
  ensureDir(PLAYERS_DIR);
  const readme = path.join(REF_DIR, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# Reference data (NBA shooters)

Drop pose data here to derive scoring thresholds. Layout:

    reference-data/
      players/
        <player>/
          player.json          # { "name": "...", "shootingHand": "right" }
          clip-01/poses.json    # required; + optional labels.json to pin shots
          clip-02/poses.json
      out/                      # generated — do not edit (gitignored)

Prefer SIDE-view clips (posture/depth metrics need them) and 3+ clips per
player so the per-player spread is measurable. Then:

    npm run metrics:extract          # writes out/metrics + out/players
    npm run metrics:extract -- curry # one player

Boundaries are auto-detected; add a labels.json (same format as test-data/)
when detection misses. The validator's dropdown can point at these folders to
label them with the same tool.
`,
      "utf8",
    );
  }
  const examplePlayer = path.join(PLAYERS_DIR, "_example", "player.json");
  if (!fs.existsSync(examplePlayer)) {
    ensureDir(path.dirname(examplePlayer));
    fs.writeFileSync(
      examplePlayer,
      JSON.stringify({ name: "Example Player", shootingHand: "right" }, null, 2) + "\n",
      "utf8",
    );
  }
}

// ---- run --------------------------------------------------------------------

if (!fs.existsSync(PLAYERS_DIR)) {
  scaffold();
  console.log(
    `No reference data yet. Created the layout under reference-data/.\n` +
      `Add clips at reference-data/players/<player>/clip-01/poses.json, then re-run.`,
  );
  process.exit(0);
}

const playerDirs = fs
  .readdirSync(PLAYERS_DIR)
  .filter((d) => !d.startsWith("_"))
  .filter((d) => fs.statSync(path.join(PLAYERS_DIR, d)).isDirectory())
  .filter((d) => !playerFilter || d.includes(playerFilter))
  .sort();

if (playerDirs.length === 0) {
  scaffold();
  console.log(
    `No player folders found under reference-data/players/` +
      (playerFilter ? ` matching "${playerFilter}"` : "") +
      `.\nAdd reference-data/players/<player>/clip-01/poses.json and re-run.`,
  );
  process.exit(0);
}

ensureDir(path.join(OUT_DIR, "metrics"));
ensureDir(path.join(OUT_DIR, "players"));

let totalClips = 0;
let totalShots = 0;

for (const player of playerDirs) {
  const dir = path.join(PLAYERS_DIR, player);
  const cfg = readPlayerConfig(dir, player);
  const clips = fs
    .readdirSync(dir)
    .filter((c) => fs.existsSync(path.join(dir, c, "poses.json")))
    .sort();

  if (clips.length === 0) {
    console.log(`\n### ${cfg.name} (${player}) — no clips with poses.json`);
    continue;
  }

  // metric id -> reliable values across all this player's shots
  const values = new Map<string, number[]>();
  let playerShots = 0;

  for (const clip of clips) {
    const clipDir = path.join(dir, clip);
    let shots: ShotMetricsV2[];
    try {
      shots = metricsForClip(clipDir, cfg);
    } catch (err) {
      console.log(`  !! ${player}/${clip}: ${(err as Error).message}`);
      continue;
    }
    totalClips++;
    ensureDir(path.join(OUT_DIR, "metrics", player));
    fs.writeFileSync(
      path.join(OUT_DIR, "metrics", player, `${clip}.metrics.json`),
      JSON.stringify(shots, null, 2),
      "utf8",
    );
    for (const shot of shots) {
      playerShots++;
      for (const m of flattenMetrics(shot)) {
        if (!m.reliable) continue;
        if (!values.has(m.id)) values.set(m.id, []);
        values.get(m.id)!.push(m.value);
      }
    }
  }

  totalShots += playerShots;

  // Per-player summary: stats per metric id.
  const summary: Record<string, unknown> = {
    player: cfg.name,
    shootingHand: cfg.shootingHand,
    clips: clips.length,
    shots: playerShots,
    metrics: {} as Record<string, unknown>,
  };
  for (const [id, vals] of [...values.entries()].sort()) {
    (summary.metrics as Record<string, unknown>)[id] = summarize(vals);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "players", `${player}.summary.json`),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  // Console table.
  console.log(`\n### ${cfg.name} (${player}) — ${clips.length} clip(s), ${playerShots} shot(s)`);
  console.log(`  ${"metric".padEnd(34)} ${"median".padStart(8)}  ${"[min..max]".padStart(18)}  n`);
  for (const [id, vals] of [...values.entries()].sort()) {
    const s = summarize(vals)!;
    console.log(
      `  ${id.padEnd(34)} ${s.median.toFixed(3).padStart(8)}  ${`[${s.min.toFixed(2)}..${s.max.toFixed(2)}]`.padStart(18)}  ${s.n}`,
    );
  }
}

console.log(
  `\n================ done: ${playerDirs.length} player(s), ${totalClips} clip(s), ${totalShots} shot(s) ================`,
);
console.log(`Per-clip metrics: reference-data/out/metrics/  |  summaries: reference-data/out/players/`);
