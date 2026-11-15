import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createReplayAnalysisService } from "$lib/features/analysis/replay/replay-analysis-service";
import { analyzePoseData, parsePoseData } from "../analysis";

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

interface ManifestEntry {
  id: string;
  file: string;
  expectedShots: number;
}
const manifest = JSON.parse(
  readFileSync(join(fixturesDir, "manifest.json"), "utf8"),
) as { fixtures: ManifestEntry[] };

const loadRaw = (id: string) =>
  JSON.parse(readFileSync(join(fixturesDir, `${id}.json`), "utf8"));

const opts = { shootingHand: "right" as const, profile: "pro-form" };
const clientService = createReplayAnalysisService({
  loadFixture: async (id) => loadRaw(id),
});

describe("server analyzePoseData matches the client replay path exactly", () => {
  for (const fixture of manifest.fixtures) {
    it(`fixture ${fixture.id} is deep-equal to the client result`, async () => {
      const pose = parsePoseData(loadRaw(fixture.id));
      const server = analyzePoseData(pose, opts);
      const client = await clientService.analyzeVideoFile(
        { kind: "fixture", fixtureId: fixture.id },
        opts,
      );
      // The whole result — keyframes, metrics, v2, orientation — must match.
      expect(server).toStrictEqual(client);
      expect(server.shots).toHaveLength(fixture.expectedShots);
    });
  }
});
