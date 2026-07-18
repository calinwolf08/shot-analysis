#!/usr/bin/env npx tsx
/**
 * Threshold derivation CLI (metrics overhaul Step 6).
 *
 *   npm run metrics:thresholds
 *
 * Reads the per-player summaries written by `npm run metrics:extract`
 * (reference-data/out/players/<player>.summary.json), derives a consensus band
 * and a tightness-based weight per metric, and writes:
 *   reference-data/out/thresholds.json   the scoring thresholds (versioned)
 *   reference-data/out/report.md         per-metric table you review + veto
 *
 * A hand-tuned thresholds.json is never clobbered: when one exists the derived
 * output goes to thresholds.derived.json instead.
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

import * as fs from "fs";
import * as path from "path";
import {
  deriveThresholds,
  categoryLabel,
  type PlayerSummary,
  type Stats,
} from "../metrics/v2";

const OUT_DIR = path.join(process.cwd(), "reference-data", "out");
const PLAYERS_DIR = path.join(OUT_DIR, "players");

if (!fs.existsSync(PLAYERS_DIR)) {
  console.log(
    `No player summaries found at reference-data/out/players/.\n` +
      `Run 'npm run metrics:extract' first (which needs clips under reference-data/players/).`,
  );
  process.exit(0);
}

const files = fs
  .readdirSync(PLAYERS_DIR)
  .filter((f) => f.endsWith(".summary.json"))
  .sort();

if (files.length === 0) {
  console.log(`No *.summary.json files under reference-data/out/players/.`);
  process.exit(0);
}

const summaries: PlayerSummary[] = files.map((f) => {
  const j = JSON.parse(fs.readFileSync(path.join(PLAYERS_DIR, f), "utf8"));
  return {
    player: typeof j.player === "string" ? j.player : f.replace(/\.summary\.json$/, ""),
    metrics: (j.metrics ?? {}) as Record<string, Stats | null>,
  };
});

const thresholds = deriveThresholds(summaries);

// Never overwrite a hand-tuned thresholds.json.
const primary = path.join(OUT_DIR, "thresholds.json");
const target = fs.existsSync(primary)
  ? path.join(OUT_DIR, "thresholds.derived.json")
  : primary;
fs.writeFileSync(target, JSON.stringify(thresholds, null, 2), "utf8");

// --- report.md ---
const entries = Object.entries(thresholds.metrics).sort((a, b) => {
  // Key metrics first (highest weight), then by category/id.
  if (b[1].weight !== a[1].weight) return b[1].weight - a[1].weight;
  return a[0].localeCompare(b[0]);
});

const lines: string[] = [];
lines.push(`# Reference thresholds`);
lines.push("");
lines.push(`Generated from ${summaries.length} player(s): ${thresholds.generatedFrom.join(", ")}.`);
lines.push("");
lines.push(`- **weight** — scoring weight (0 = reported-only; pros differ or low coverage).`);
lines.push(`- **tightness** — how tightly the pros agree (1 = identical).`);
lines.push(`- **coverage** — fraction of players with a reliable reading.`);
lines.push("");
lines.push(`| metric | category | band | weight | tightness | coverage | scored |`);
lines.push(`|---|---|---|---:|---:|---:|:--:|`);
for (const [id, t] of entries) {
  const band = `[${t.band[0].toFixed(3)}, ${t.band[1].toFixed(3)}]`;
  lines.push(
    `| ${t.label} (\`${id}\`) | ${categoryLabel(t.category)} | ${band} | ${t.weight.toFixed(2)} | ${t.tightness.toFixed(2)} | ${(t.coverage * 100).toFixed(0)}% | ${t.reportedOnly ? "—" : "✓"} |`,
  );
}
lines.push("");
const key = entries.filter(([, t]) => !t.reportedOnly);
lines.push(`## The key metrics (scored): ${key.length} of ${entries.length}`);
lines.push("");
lines.push(`These are the metrics where the pros agree tightly enough to score against.`);
fs.writeFileSync(path.join(OUT_DIR, "report.md"), lines.join("\n") + "\n", "utf8");

// --- console ---
console.log(
  `\nDerived ${entries.length} metric threshold(s) from ${summaries.length} player(s).`,
);
console.log(`  scored (key): ${key.length}   reported-only: ${entries.length - key.length}`);
console.log(`  thresholds: ${path.relative(process.cwd(), target)}`);
console.log(`  report:     reference-data/out/report.md`);
if (target !== primary) {
  console.log(`  (kept existing thresholds.json; wrote derived output alongside it)`);
}
