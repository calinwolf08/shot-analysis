import { readFileSync, mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { beforeAll, describe, it } from "vitest";
import { resetDbSingletonForTests } from "$lib/server/db";
import { createApiClient } from "$lib/shared/api/client";
import { createRemoteRepos } from "$lib/shared/api/remote-repos";
import { inProcessFetch } from "$lib/shared/api/__tests__/in-process-server";
import { poseDataToLandmarkFrames, landmarkFramesToPoseData } from "$lib/features/analysis/replay/replay-pipeline";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "..", "..", "..", "src-tests", "fixtures", "poses");
const manifest = JSON.parse(readFileSync(join(fixturesDir, "manifest.json"), "utf8"));
const fixture = manifest.fixtures[0];
const pose = JSON.parse(readFileSync(join(fixturesDir, `${fixture.id}.json`), "utf8"));

beforeAll(() => { process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(),"dbg-")), "d.sqlite"); });

describe("dbg", () => {
  it("posts a window", async () => {
    resetDbSingletonForTests();
    const api = createApiClient({ fetch: inProcessFetch({id:"u",email:"e",name:"n"}), baseUrl:"http://localhost" });
    const repos = createRemoteRepos(api);
    const player = await repos.player.create({ name:"L", shootingHand:"right", level:"high-school" });
    const session = await repos.session.create({ playerId: player.id, type:"live_practice" });
    const frames = poseDataToLandmarkFrames(pose);
    const poseData = landmarkFramesToPoseData(frames, fixture.fps);
    console.log("FPS", fixture.fps, "frames", frames.length, "poseData.frames", poseData.frames.length);
    try {
      const res = await api.send("/api/analysis/shot", { sessionId: session.id, playerId: player.id, poseData });
      console.log("RES shots", (res as any).shots.length);
    } catch (e) {
      console.log("ERR", (e as any).status, (e as any).message, JSON.stringify((e as any).body)?.slice(0,300));
    }
  });
});
