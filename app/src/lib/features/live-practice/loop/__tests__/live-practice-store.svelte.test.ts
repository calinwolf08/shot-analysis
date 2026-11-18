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
import {
  ANALYZING_TEXT,
  CAPTURED_TEXT,
  LivePracticeStore,
  NOT_SCORED_TEXT,
  ON_TARGET_TEXT,
  WRONG_ANGLE_TEXT,
} from "../live-practice-store.svelte";
import type { RejectedShot } from "../../pipeline";

type EventName = keyof CoordinatorEvents;

function fakeCoordinator() {
  const listeners = new Map<EventName, Set<(p: unknown) => void>>();
  const coordinator = {
    state: "IDLE",
    start: vi.fn(),
    stop: vi.fn(),
    dismissFeedback: vi.fn(),
    pushFrame: vi.fn(),
    setArmed: vi.fn(),
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

type Outcome =
  | ProcessedShot[]
  | { shots: ProcessedShot[]; rejected: RejectedShot[] };

function fakePipeline(results: Outcome[]): LiveShotPipeline {
  let call = 0;
  return {
    location: "device",
    process: vi.fn(async () => {
      const r = results[Math.min(call++, results.length - 1)]!;
      return Array.isArray(r) ? { shots: r, rejected: [] } : r;
    }),
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

function makeStore(
  results: Outcome[],
  audioOpts: { holdSpeech?: boolean } = {},
) {
  const { coordinator, emit } = fakeCoordinator();
  const pipeline = fakePipeline(results);
  const { store: shotStore, excluded } = fakeStore();
  const audio = createFakeAudio(audioOpts);
  const store = new LivePracticeStore({
    coordinator,
    pipeline,
    shotStore,
    audio,
    playerId: "p1",
    opts,
    fps: 30,
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

describe("LivePracticeStore — per-shot cycle", () => {
  it("captured → analyzing → readback → ready, strictly in order", async () => {
    const { store, emit, audio, coordinator } = makeStore([
      [processed("s1", 3.4, ["Elbow flare", "Set point"])],
    ]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));

    expect(audio.sequence).toEqual([
      "earcon:captured",
      `speak:${CAPTURED_TEXT}`,
      `speak:${ANALYZING_TEXT}`,
      "speak:Set point: Elbow flare high by 6, Set point high by 6.",
      "earcon:ready",
    ]);
    expect(store.shots).toHaveLength(1);
    expect(store.feedback?.overall).toBe(3.4);
    expect(store.average).toBe(3.4);
    // Tracking resumed exactly once, at the end.
    expect(coordinator.dismissFeedback).toHaveBeenCalledTimes(1);
  });

  it("holds shot detection until the readback has FINISHED", async () => {
    const { store, emit, audio, coordinator } = makeStore(
      [[processed("s1", 2, ["Set point"])]],
      { holdSpeech: true },
    );
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("captured"));
    expect(coordinator.dismissFeedback).not.toHaveBeenCalled();

    const next = async () => {
      await vi.waitFor(() => expect(audio.speaking).toBe(1));
      audio.releaseSpeech();
    };
    await next(); // "Shot captured" done
    await vi.waitFor(() => expect(store.cycle).toBe("analyzing"));
    await vi.waitFor(() => expect(audio.speaking).toBe(1));
    expect(coordinator.dismissFeedback).not.toHaveBeenCalled();
    audio.releaseSpeech(); // "Analyzing" done
    await vi.waitFor(() => expect(store.cycle).toBe("readback"));
    expect(store.feedback).not.toBeNull();
    expect(coordinator.dismissFeedback).not.toHaveBeenCalled();

    await next(); // readback done
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));
    expect(coordinator.dismissFeedback).toHaveBeenCalledTimes(1);
    // The card stays up until the next shot.
    expect(store.feedback?.index).toBe(1);
  });

  it("says 'On target' instead of falling silent", async () => {
    const { store, emit, audio } = makeStore([[processed("s1", 1, [])]]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));
    expect(audio.spoken.at(-1)).toBe(ON_TARGET_TEXT);
    expect(audio.earcons.at(-1)).toBe("ready");
  });

  it("announces a wrong-angle shot, stores nothing, resumes tracking", async () => {
    const { store, emit, audio, coordinator } = makeStore([
      {
        shots: [],
        rejected: [
          {
            reason: "orientation",
            orientation: "front",
            allowed: ["side-right"],
          },
        ],
      },
    ]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));
    expect(store.wrongAngleFlash).toBe(true);
    expect(store.shots).toHaveLength(0);
    expect(audio.sequence.slice(-2)).toEqual([
      `speak:${WRONG_ANGLE_TEXT}`,
      "earcon:ready",
    ]);
    expect(coordinator.dismissFeedback).toHaveBeenCalledTimes(1);
  });

  it("an empty pipeline result is reported and releases tracking", async () => {
    const { store, emit, audio, coordinator } = makeStore([[]]);
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));
    expect(store.noShotFlash).toBe(true);
    expect(audio.spoken).toContain(NOT_SCORED_TEXT);
    expect(coordinator.dismissFeedback).toHaveBeenCalled();
  });

  it("a pipeline error still ends the cycle and resumes tracking", async () => {
    const { store, emit, pipeline, coordinator } = makeStore([[]]);
    (pipeline.process as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom"),
    );
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));
    expect(store.error).toBe("boom");
    expect(coordinator.dismissFeedback).toHaveBeenCalled();
  });

  it("a non-shot motion only flashes (nothing was announced)", () => {
    const { store, emit, audio } = makeStore([[]]);
    emit("repAnalyzing", { frameCount: 10, trigger: "settled" });
    expect(audio.cancels).toBe(1); // cuts any positioning cue
    emit("noShot", {
      window: { frames: [], startedAt: 0, endedAt: 1, trigger: "settled" },
      reason: "no-shot-detected",
    });
    expect(store.noShotFlash).toBe(true);
    expect(audio.sequence).toEqual([]);
  });

  it("pausing mid-cycle abandons it without resuming tracking", async () => {
    const { store, emit, audio, coordinator } = makeStore(
      [[processed("s1", 2, ["Set point"])]],
      { holdSpeech: true },
    );
    emit("repResult", repEvent());
    await vi.waitFor(() => expect(store.cycle).toBe("captured"));
    store.pause();
    audio.releaseSpeech();
    await new Promise((r) => setTimeout(r, 10));
    expect(store.cycle).toBe("tracking");
    expect(store.phase).toBe("paused");
    expect(coordinator.stop).toHaveBeenCalled();
    expect(coordinator.dismissFeedback).not.toHaveBeenCalled();
    expect(audio.earcons).not.toContain("ready");
  });

  it("'Not a shot?' excludes, re-averages, and cuts its readback short", async () => {
    const { store, emit, audio, excluded } = makeStore(
      [[processed("s1", 4, ["Elbow flare"])]],
      { holdSpeech: true },
    );
    emit("repResult", repEvent());
    const next = async () => {
      await vi.waitFor(() => expect(audio.speaking).toBe(1));
      audio.releaseSpeech();
    };
    await next(); // "Shot captured"
    await next(); // "Analyzing"
    await vi.waitFor(() => expect(store.cycle).toBe("readback"));

    await store.excludeShot(1);
    expect(excluded).toEqual(["s1"]);
    expect(store.shots[0]!.excluded).toBe(true);
    expect(store.shotCount).toBe(0);
    expect(store.average).toBeNull();
    expect(store.feedback).toBeNull();
    await vi.waitFor(() => expect(store.cycle).toBe("tracking"));
  });

  it("forwards arming to the coordinator", () => {
    const { store, coordinator } = makeStore([[]]);
    store.setArmed(false);
    expect(coordinator.setArmed).toHaveBeenCalledWith(false);
  });

  it("pause stops the coordinator; resume restarts", () => {
    const { store, coordinator } = makeStore([[]]);
    store.pause();
    expect(store.phase).toBe("paused");
    expect(coordinator.stop).toHaveBeenCalled();
    store.resume();
    expect(store.phase).toBe("ready");
    expect(coordinator.start).toHaveBeenCalledTimes(2); // start() + resume()
  });

  it("continues today's shots (counter + average) and numbers new ones after them", async () => {
    const { coordinator } = fakeCoordinator();
    const earlier = processed("old", 5, ["Set point"]);
    const store = new LivePracticeStore({
      coordinator,
      pipeline: fakePipeline([[processed("s2", 3, [])]]),
      shotStore: fakeStore().store,
      audio: createFakeAudio(),
      playerId: "p1",
      opts,
      fps: 30,
      initialShots: [
        {
          index: 1,
          shotId: "old",
          overall: 5,
          worst: earlier.worst,
          scorecard: earlier.scorecard,
          excluded: false,
        },
      ],
    });
    expect(store.shotCount).toBe(1);
    expect(store.average).toBe(5);
    expect(store.running).toBe(false);
    store.start();
    expect(store.running).toBe(true);
    store.stop();
    expect(store.running).toBe(false);
  });

  it("toggleMute mutes the audio service", () => {
    const { store, audio } = makeStore([[]]);
    expect(store.muted).toBe(false);
    store.toggleMute();
    expect(store.muted).toBe(true);
    expect(audio.isMuted()).toBe(true);
  });
});
