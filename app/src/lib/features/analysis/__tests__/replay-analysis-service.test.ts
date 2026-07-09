import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AnalysisProgress } from "../types";
import {
  FixtureNotSupportedError,
  createReplayAnalysisService,
} from "../replay/replay-analysis-service";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(
  here,
  "..",
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
  fps: number;
  totalFrames: number;
}

const manifest = JSON.parse(
  readFileSync(join(fixturesDir, "manifest.json"), "utf8"),
) as { fixtures: ManifestEntry[] };

const loadFixture = async (id: string) =>
  JSON.parse(readFileSync(join(fixturesDir, `${id}.json`), "utf8"));

const service = createReplayAnalysisService({ loadFixture });
const opts = { shootingHand: "right" as const, profile: "pro-form" };

describe("ReplayAnalysisService.analyzeVideoFile", () => {
  it("has 3 curated fixtures", () => {
    expect(manifest.fixtures).toHaveLength(3);
  });

  for (const fixture of manifest.fixtures) {
    describe(`fixture ${fixture.id}`, () => {
      it(`detects exactly ${fixture.expectedShots} shots with rich metrics`, async () => {
        const result = await service.analyzeVideoFile(
          { kind: "fixture", fixtureId: fixture.id },
          opts,
        );
        expect(result.shots).toHaveLength(fixture.expectedShots);
        expect(result.videoMetadata.fps).toBe(fixture.fps);

        for (const shot of result.shots) {
          const confident = Object.values(shot.metrics).filter(
            (m) => m.confidence > 0,
          );
          expect(confident.length).toBeGreaterThanOrEqual(15);
          expect(shot.overallConfidence).toBeGreaterThan(0);
          expect(shot.orientation).toBeDefined();
          expect(shot.frameRange.end).toBeGreaterThan(shot.frameRange.start);
        }
      }, 30_000);

      it("emits monotonic progress ending in extracting", async () => {
        const events: AnalysisProgress[] = [];
        await service.analyzeVideoFile(
          { kind: "fixture", fixtureId: fixture.id },
          opts,
          (p) => events.push(p),
        );
        expect(events.length).toBeGreaterThan(2);
        for (let i = 1; i < events.length; i++) {
          expect(events[i]!.framesProcessed).toBeGreaterThanOrEqual(
            events[i - 1]!.framesProcessed,
          );
          expect(events[i]!.shotsDetected).toBeGreaterThanOrEqual(
            events[i - 1]!.shotsDetected,
          );
        }
        expect(events[0]!.phase).toBe("loading");
        expect(events.at(-1)!.phase).toBe("extracting");
        expect(events.at(-1)!.shotsDetected).toBe(fixture.expectedShots);
      }, 30_000);
    });
  }

  it("is deterministic: two runs produce deep-equal results", async () => {
    const ref = { kind: "fixture" as const, fixtureId: "20190103_180930" };
    const a = await service.analyzeVideoFile(ref, opts);
    const b = await service.analyzeVideoFile(ref, opts);
    expect(a).toEqual(b);
  }, 60_000);

  it("rejects real Blobs with a typed error", async () => {
    await expect(
      service.analyzeVideoFile(new Blob(["x"]), opts),
    ).rejects.toBeInstanceOf(FixtureNotSupportedError);
  });

  it("rejects malformed fixture JSON", async () => {
    const bad = createReplayAnalysisService({
      loadFixture: async () => ({ nope: true }),
    });
    await expect(
      bad.analyzeVideoFile({ kind: "fixture", fixtureId: "x" }, opts),
    ).rejects.toThrow();
  });
});

describe("ReplayAnalysisService.createLiveSession", () => {
  it("replays frames to subscribers and analyzes a window", async () => {
    // Immediate scheduler = synchronous replay drain.
    const immediate = (cb: () => void) => {
      cb();
      return () => undefined;
    };
    const live = createReplayAnalysisService({
      loadFixture,
      liveFixtureId: "20201212_134104",
      schedule: immediate,
    }).createLiveSession(opts);

    const frames: number[] = [];
    const unsubscribe = live.onFrame((f) => frames.push(f.frameIndex));
    await live.start();
    await live.stop();
    unsubscribe();

    expect(frames.length).toBeGreaterThan(100); // whole fixture replayed

    // Analyze the full replayed window → the known single shot.
    const pose = (await loadFixture("20201212_134104")) as {
      fps: number;
      frames: {
        frameIndex: number;
        timestamp: number;
        poseConfidence: number;
        landmarks:
          | {
              x: number;
              y: number;
              z: number;
              visibility: number;
              confidence: number;
            }[]
          | null;
      }[];
    };
    const window = pose.frames.map((f) => ({
      frameIndex: f.frameIndex,
      timestamp: f.timestamp,
      poseConfidence: f.poseConfidence,
      landmarks: f.landmarks,
    }));
    const result = await live.analyzeWindow(window);
    expect(result.shots).toHaveLength(1);
  }, 30_000);

  it("requires liveFixtureId", () => {
    const svc = createReplayAnalysisService({ loadFixture });
    expect(() => svc.createLiveSession(opts)).toThrow(/liveFixtureId/);
  });
});
