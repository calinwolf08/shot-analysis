/**
 * Copies curated pose-sequence fixtures from the repo's test-data/ into
 * app/src-tests/fixtures/poses/ with a manifest of expected shot counts
 * (from the adjacent human labels.json).
 *
 * Run from app/: npx tsx scripts/build-fixtures.ts
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(here, "..", "src-tests", "fixtures", "poses");

/** Curated set: single-shot, 3-shot, 7-shot (ids from test-data/). */
const FIXTURE_IDS = [
  "20201212_134104",
  "20190103_180930",
  "20190804_140654",
] as const;

interface ManifestEntry {
  id: string;
  file: string;
  expectedShots: number;
  fps: number;
  totalFrames: number;
}

function main(): void {
  mkdirSync(outDir, { recursive: true });
  const entries: ManifestEntry[] = [];

  for (const id of FIXTURE_IDS) {
    const posesPath = join(repoRoot, "test-data", id, "poses.json");
    const labelsPath = join(repoRoot, "test-data", id, "labels.json");
    const poses = JSON.parse(readFileSync(posesPath, "utf8")) as {
      fps: number;
      totalFrames: number;
    };
    const labels = JSON.parse(readFileSync(labelsPath, "utf8")) as {
      shots: unknown[];
    };

    copyFileSync(posesPath, join(outDir, `${id}.json`));
    entries.push({
      id,
      file: `${id}.json`,
      expectedShots: labels.shots.length,
      fps: poses.fps,
      totalFrames: poses.totalFrames,
    });
    console.log(
      `fixture ${id}: ${labels.shots.length} labeled shots, ${poses.totalFrames} frames`,
    );
  }

  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify({ fixtures: entries }, null, 2) + "\n",
  );
  console.log(`Wrote ${entries.length} fixtures + manifest to ${outDir}`);
}

main();
