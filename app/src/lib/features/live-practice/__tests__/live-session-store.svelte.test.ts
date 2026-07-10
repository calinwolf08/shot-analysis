import { describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "basketball-shot-analysis";
import { createFakeAudio } from "$lib/shared/audio";
import { createTestServices } from "$lib/shared/config/test-services";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import type {
  CoordinatorEvents,
  LiveRepCoordinator,
} from "../coordinator/coordinator";
import { LiveSessionStore } from "../loop/live-session-store.svelte";

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

function repResultEvent(
  metrics: Record<string, { value: number | string; confidence?: number }> = {},
): CoordinatorEvents["repResult"] {
  return {
    analysis: {
      shots: [makeShotAnalysis({ metrics })],
    } as unknown as AnalysisResult,
    window: { frames: [], startedAt: 0, endedAt: 1000, trigger: "settled" },
  };
}

async function makeStore(
  overrides: { focusMetric?: string; feedbackMs?: number } = {},
) {
  const services = await createTestServices();
  await services.repos.player.create({
    name: "Live",
    shootingHand: "right",
    level: "high-school",
  });
  const { coordinator, emit } = fakeCoordinator();
  const audio = createFakeAudio();
  const store = new LiveSessionStore({
    repos: services.repos,
    scoring: services.scoring,
    benchmarks: services.benchmarks,
    db: services.db,
    coordinator,
    audio,
    focusMetric: (overrides.focusMetric ?? null) as never,
    feedbackMs: overrides.feedbackMs ?? 60,
  });
  await services.benchmarks.seed();
  await store.start();
  return { store, services, coordinator, emit, audio };
}

describe("LiveSessionStore", () => {
  it("persists shot + rep + score rows for each rep and updates the average", async () => {
    const { store, services, emit, audio } = await makeStore();
    expect(store.sessionId).not.toBeNull();
    const session = await services.repos.session.get(store.sessionId!);
    expect(session?.type).toBe("live_practice");

    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));

    const shots = await services.repos.shot.listBySession(store.sessionId!);
    expect(shots).toHaveLength(1);
    const reps = await services.repos.rep.listBySession(store.sessionId!);
    expect(reps).toHaveLength(1);
    expect(reps[0]!.repScore).toBe(store.reps[0]!.score);
    const shotScore = await services.repos.score.latestForRef(
      "shot",
      shots[0]!.id,
    );
    expect(shotScore?.formScore).not.toBeNull();

    expect(store.feedback?.score).toBe(store.reps[0]!.score);
    expect(store.feedback?.delta).toBeNull(); // first rep has no baseline
    expect(store.average).toBe(store.reps[0]!.score);
    expect(audio.spoken).toHaveLength(1);

    // Second rep: delta is measured against the prior average.
    emit("repResult", repResultEvent({ kneeFlexion: { value: 45 } }));
    await vi.waitFor(() => expect(store.reps).toHaveLength(2));
    const [first, second] = store.reps;
    expect(second!.delta).toBeCloseTo(second!.score! - first!.score!, 5);
  });

  it("prioritizes the plan focus metric's cue over a worse metric", async () => {
    const { store, emit } = await makeStore({
      focusMetric: "wristSnapAngle",
    });

    emit(
      "repResult",
      repResultEvent({
        kneeFlexion: { value: 15, confidence: 0.9 }, // catastrophic
        wristSnapAngle: { value: 54, confidence: 0.9 }, // mild fail
      }),
    );
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));
    expect(store.feedback?.cues.primary?.metric).toBe("wristSnapAngle");
    expect(store.feedback?.cues.primary?.text).toBe("Snap your wrist");
  });

  it("auto-dismisses feedback after feedbackMs", async () => {
    const { store, coordinator, emit } = await makeStore({ feedbackMs: 300 });
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.feedback).not.toBeNull());
    await vi.waitFor(() => expect(store.feedback).toBeNull());
    expect(coordinator.dismissFeedback).toHaveBeenCalled();
  });

  it("'not a shot' excludes the rep and re-averages", async () => {
    const { store, services, emit } = await makeStore();
    emit("repResult", repResultEvent({ kneeFlexion: { value: 45 } }));
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));
    emit("repResult", repResultEvent({ kneeFlexion: { value: 10 } }));
    await vi.waitFor(() => expect(store.reps).toHaveLength(2));

    const before = store.average!;
    await store.excludeRep(2);
    expect(store.reps[1]!.excluded).toBe(true);
    expect(store.repCount).toBe(1);
    expect(store.average).toBe(store.reps[0]!.score);
    expect(store.average).not.toBe(before);

    const shot = await services.repos.shot.get(store.reps[1]!.shotId);
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
    const { store, services, emit } = await makeStore();
    emit("repResult", repResultEvent());
    await vi.waitFor(() => expect(store.reps).toHaveLength(1));

    const sessionId = await store.end();
    expect(sessionId).toBe(store.sessionId);
    expect(store.phase).toBe("ended");

    const session = await services.repos.session.get(sessionId!);
    expect(session?.status).toBe("completed");
    const sessionScore = await services.repos.score.latestForRef(
      "session",
      sessionId!,
    );
    expect(sessionScore).not.toBeNull();
  });
});
