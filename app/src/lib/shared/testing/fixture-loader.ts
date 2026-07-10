/**
 * Node fixture loader for tests: reads app/src-tests/fixtures/poses/.
 * Import from tests only (uses node:fs).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FixtureLoader } from "$lib/features/analysis";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(
  here,
  "..",
  "..",
  "..",
  "..",
  "src-tests",
  "fixtures",
  "poses",
);

export const FIXTURES = {
  singleShot: "20201212_134104",
  threeShots: "20190103_180930",
  sevenShots: "20190804_140654",
} as const;

export function createNodeFixtureLoader(): FixtureLoader {
  return async (fixtureId: string) =>
    JSON.parse(readFileSync(join(fixturesDir, `${fixtureId}.json`), "utf8"));
}

export function loadManifest(): {
  fixtures: {
    id: string;
    file: string;
    expectedShots: number;
    fps: number;
    totalFrames: number;
  }[];
} {
  return JSON.parse(
    readFileSync(join(fixturesDir, "manifest.json"), "utf8"),
  ) as ReturnType<typeof loadManifest>;
}
