import { describe, expect, it, vi } from "vitest";
import { createFakeAudio } from "$lib/shared/audio";
import type { MetricDeviation, ShotScorecard } from "$lib/features/scoring";
import type { ShotRecord } from "$lib/shared/db/repos";
import type { AnalyzeOptions } from "$lib/features/analysis";
import type {
  LiveShotPipeline,
  ProcessedShot,
  ShotStore,
} from "../../pipeline";
import type {
  CoordinatorEvents,
  LiveRepCoordinator,
} from "../../coordinator/coordinator";
import { LivePracticeStore } from "../live-practice-store.svelte";

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

function shotRecord(id: string): ShotRecord {
  return {
    id,
    playerId: "p1",
    sessionId: null,
    videoId: null,
    shotIndex: 0,
    orientation: "side-left",
    startFrame: 0,
    endFrame: 29,
    overallConfidence: 0.9,
    excluded: false,
    analysis: {} as ShotRecord["analysis"],
    createdAt: 0,
  };
}

function worst(label: string): MetricDeviation {
  return {
    id: `setPoint.${label}`,
    label,
    section: "structure",
    phase: "setPoint",
    value: 100,
    ideal: 90,
    passMin: 85,
    passMax: 95,
    unit: "",
    score: 3,
    normDev: 2,
    inBand: false,
    direction: "high",
    magnitude: 6,
    scored: true,
  };
}

function scorecard(
  overall: number,
  worstList: MetricDeviation[],
): ShotScorecard {
  return {
    overall,
    sections: [],
    worst: worstList,
    all: worstList,
    measuredCount: worstList.length,
    scoredTargetCount: worstList.length,
    measuredFraction: 1,
    belowCoverageGate: false,
    targetsVersion: 1,
  };
}

function processed(
  id: string,
  overall: number,
  labels: string[],
): ProcessedShot {
  const w = labels.map(worst);
  return { shot: shotRecord(id), scorecard: scorecard(overall, w), worst: w };
}

function fakePipeline(results: ProcessedShot[][]): LiveShotPipeline {
  let call = 0;
  return {
    location: "device",
    process: vi.fn(async () => results[Math.min(call++, results.length - 1)]!),
  };
}

function fakeStore() {
  const excluded: string[] = [];
  const store: ShotStore = {
    save: vi.fn(),
    setExcluded: vi.fn(async (id: string) => {
      excluded.push(id);
    }),
  };
  return { store, excluded };
}

const opts: AnalyzeOptions = { shootingHand: "right", profile: "pro-form" };

function makeStore(results: ProcessedShot[][]) {
  const { coordinator, emit } = fakeCoordinator();
  const pipeline = fakePipeline(results);
  const { store: shotStore, excluded } = fakeStore();
  const audio = createFakeAudio();
  const store = new LivePracticeStore({
    coordinator,
    pipeline,
    shotStore,
    audio,
    playerId: "p1",
    opts,
    fps: 30,
    feedbackMs: 60,
  });
  store.start();
  return { store, emit, audio, pipeline, shotStore, excluded, coordinator };
}

function repEvent(): CoordinatorEvents["repResult"] {
  return {
    analysis: {
      shots: [],
    } as unknown as CoordinatorEvents["repResult"]["analysis"],
    window: { frames: [], startedAt: 0, endedAt: 1000, trigger: "settled" },
  };
}

describe("LivePracticeStore", () => {
  it("brackets a shot with earcons and reads the worst metrics", async () => {
    const { store, emit, audio } = makeStore([
      [processed("s1", 3.4, ["Elbow flare", "Set point"])],
    ]);

    emit("repAnalyzing", { frameCount: 10, trigger: "settled" });
    expect(audio.earcons).toEqual(["analyzing"]);
    expect(audio.cancels).toBe(1); // interrupts any prior readback

    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.shots).toHaveLength(1));

    expect(audio.earcons).toEqual(["analyzing", "ready"]);
    expect(audio.spoken[0]).toContain("Elbow flare high by 6");
    expect(store.feedback?.overall).toBe(3.4);
    expect(store.feedback?.worst).toHaveLength(2);
    expect(store.average).toBe(3.4);
    expect(store.shots[0]!.shotId).toBe("s1");
  });

  it("stays silent (no readback) when nothing is off-target", async () => {
    const { store, emit, audio } = makeStore([[processed("s1", 1, [])]]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.shots).toHaveLength(1));
    expect(audio.spoken).toEqual([]); // no worst metrics → nothing spoken
    expect(audio.earcons).toContain("ready");
  });

  it("treats an empty pipeline result as a miss", async () => {
    const { store, emit, audio } = makeStore([[]]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.noShotFlash).toBe(true));
    expect(store.shots).toHaveLength(0);
    expect(audio.earcons).toContain("ready");
  });

  it("flashes and signals ready on a no-shot", () => {
    const { store, emit, audio } = makeStore([[]]);
    emit("noShot", {
      window: { frames: [], startedAt: 0, endedAt: 1, trigger: "settled" },
      reason: "no-shot-detected",
    });
    expect(store.noShotFlash).toBe(true);
    expect(audio.earcons).toEqual(["ready"]);
  });

  it("excludes a shot and re-averages", async () => {
    const { store, emit, excluded } = makeStore([
      [processed("s1", 4, ["Elbow flare"])],
    ]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.shots).toHaveLength(1));

    await store.excludeShot(1);
    expect(excluded).toEqual(["s1"]);
    expect(store.shots[0]!.excluded).toBe(true);
    expect(store.shotCount).toBe(0);
    expect(store.average).toBeNull();
  });

  it("pause cancels speech + stops the coordinator; resume restarts", () => {
    const { store, audio, coordinator } = makeStore([[]]);
    const cancelsBefore = audio.cancels;
    store.pause();
    expect(store.phase).toBe("paused");
    expect(coordinator.stop).toHaveBeenCalled();
    expect(audio.cancels).toBe(cancelsBefore + 1);
    store.resume();
    expect(store.phase).toBe("ready");
    expect(coordinator.start).toHaveBeenCalledTimes(2); // start() + resume()
  });

  it("toggleMute mutes the audio service", () => {
    const { store, audio } = makeStore([[]]);
    expect(store.muted).toBe(false);
    store.toggleMute();
    expect(store.muted).toBe(true);
    expect(audio.isMuted()).toBe(true);
  });
});
