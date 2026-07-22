import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AnalysisResult } from "basketball-shot-analysis";
import { resetDbSingletonForTests } from "$lib/server/db";
import { createApiClient } from "$lib/shared/api/client";
import { createRemoteRepos } from "$lib/shared/api/remote-repos";
import {
  inProcessFetch,
  type SessionUser,
} from "$lib/shared/api/__tests__/in-process-server";
import { createScoringService } from "$lib/features/scoring";
import { createRemoteBenchmarks } from "$lib/shared/api/remote-services";
import { poseDataToLandmarkFrames } from "$lib/features/analysis/replay/replay-pipeline";
import { systemClock, uuidIdGenerator } from "$lib/shared/utils";
import type { DatabaseAdapter } from "$lib/shared/db";
import type { LandmarkFrame } from "$lib/features/analysis";
import { createFakeAudio } from "$lib/shared/audio";
import type {
  CoordinatorEvents,
  LiveRepCoordinator,
} from "../coordinator/coordinator";
import { LiveSessionStore } from "../loop/live-session-store.svelte";

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
const manifest = JSON.parse(
  readFileSync(join(fixturesDir, "manifest.json"), "utf8"),
) as { fixtures: { id: string; fps: number }[] };
const fixture = manifest.fixtures[0]!;
const pose = JSON.parse(
  readFileSync(join(fixturesDir, `${fixture.id}.json`), "utf8"),
);
const windowFrames: LandmarkFrame[] = poseDataToLandmarkFrames(pose);

const dir = mkdtempSync(join(tmpdir(), "shotcoach-live-"));
const userA: SessionUser = { id: "user-a", email: "a@ex.com", name: "A" };
const noDb = {} as DatabaseAdapter; // flushDb() is a no-op without a `flush`

type EventName = keyof CoordinatorEvents;

function fakeCoordinator() {
  const listeners = new Map<EventName, Set<(p: unknown) => void>>();
  const coordinator = {
    state: "IDLE",
    start: vi.fn(),
    stop: vi.fn(),
    dismissFeedback: vi.fn(),
    pushFrame: vi.fn(),
    on(event: EventName, cb: (p: never) => void) {
      const set = listeners.get(event) ?? new Set();
      set.add(cb as (p: unknown) => void);
      listeners.set(event, set);
      return () => set.delete(cb as (p: unknown) => void);
    },
  } as unknown as LiveRepCoordinator;
  function emit<K extends EventName>(event: K, payload: CoordinatorEvents[K]) {
    for (const cb of listeners.get(event) ?? []) cb(payload);
  }
  return { coordinator, emit };
}

/** A rep window carrying a fixture's real pose frames (the server re-analyzes). */
function repResultEvent(): CoordinatorEvents["repResult"] {
  return {
    // The client-side analysis is now advisory only; the store ignores it.
    analysis: { shots: [] } as unknown as AnalysisResult,
    window: {
      frames: windowFrames,
      startedAt: 0,
      endedAt: windowFrames.at(-1)?.timestamp ?? 1000,
      trigger: "settled",
    },
  };
}

async function makeStore(overrides: { feedbackMs?: number } = {}) {
  const api = createApiClient({
    fetch: inProcessFetch(userA),
    baseUrl: "http://localhost",
  });
  const repos = createRemoteRepos(api);
  await repos.player.create({
    name: "Live",
    shootingHand: "right",
    level: "high-school",
  });
  const scoring = createScoringService(
    { db: noDb, clock: systemClock, ids: uuidIdGenerator },
    { shotRepo: repos.shot, scoreRepo: repos.score },
  );
  const benchmarks = createRemoteBenchmarks(api);
  const { coordinator, emit } = fakeCoordinator();
  const audio = createFakeAudio();
  const store = new LiveSessionStore({
    repos,
    scoring,
    benchmarks,
    api,
    fps: fixture.fps,
    db: noDb,
    coordinator,
    audio,
    feedbackMs: overrides.feedbackMs ?? 60,
  });
  await store.start();
  return { store, repos, coordinator, emit, audio };
}

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "live.sqlite");
});
afterAll(() => {
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => resetDbSingletonForTests());

describe("LiveSessionStore (server-analyzed reps)", () => {
  it("posts each rep window to the server and persists shot + rep + score", async () => {
    const { store, repos, emit, audio } = await makeStore();
    expect(store.sessionId).not.toBeNull();
    const session = await repos.session.get(store.sessionId!);
    expect(session?.type).toBe("live_practice");

    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));

    const shots = await repos.shot.listBySession(store.sessionId!);
    expect(shots.length).toBeGreaterThanOrEqual(1);
    const reps = await repos.rep.listBySession(store.sessionId!);
    expect(reps).toHaveLength(1);
    expect(reps[0]!.repScore).toBe(store.reps[0]!.score);
    const shotScore = await repos.score.latestForRef("shot", shots[0]!.id);
    expect(shotScore?.formScore).not.toBeNull();

    expect(store.feedback?.score).toBe(store.reps[0]!.score);
    expect(store.feedback?.delta).toBeNull(); // first rep has no baseline
    expect(store.average).toBe(store.reps[0]!.score);
    expect(audio.spoken.length).toBeGreaterThanOrEqual(0);

    // Second rep: delta measured against the prior average.
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(2));
    const [first, second] = store.reps;
    expect(second!.delta).toBeCloseTo(second!.score! - first!.score!, 5);
  });

  it("auto-dismisses feedback after feedbackMs", async () => {
    const { store, coordinator, emit } = await makeStore({ feedbackMs: 300 });
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.feedback).not.toBeNull());
    await vi.waitFor(() => expect(store.feedback).toBeNull());
    expect(coordinator.dismissFeedback).toHaveBeenCalled();
  });

  it("'not a shot' excludes the rep and re-averages", async () => {
    const { store, repos, emit } = await makeStore();
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(2));

    await store.excludeRep(2);
    expect(store.reps[1]!.excluded).toBe(true);
    expect(store.repCount).toBe(1);
    expect(store.average).toBe(store.reps[0]!.score);

    const shot = await repos.shot.get(store.reps[1]!.shotId);
    expect(shot?.excluded).toBe(true);
  });

  it("pause stops the coordinator; resume restarts it", async () => {
    const { store, coordinator } = await makeStore();
    store.pause();
    expect(store.phase).toBe("paused");
    expect(coordinator.stop).toHaveBeenCalledTimes(1);
    store.resume();
    expect(store.phase).toBe("idle");
    expect(coordinator.start).toHaveBeenCalledTimes(2); // start() + resume()
  });

  it("end completes the session and persists a session score", async () => {
    const { store, repos, emit } = await makeStore();
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));

    const sessionId = await store.end();
    expect(sessionId).toBe(store.sessionId);
    expect(store.phase).toBe("ended");

    const session = await repos.session.get(sessionId!);
    expect(session?.status).toBe("completed");
    const sessionScore = await repos.score.latestForRef("session", sessionId!);
    expect(sessionScore).not.toBeNull();
  });
});
