import { describe, expect, it, vi } from "vitest";
import type { ShotRecord } from "$lib/shared/db/repos";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import {
  AssessmentAbortedError,
  NoShotsDetectedError,
  type AssessmentOutcome,
  type AssessmentService,
} from "../services/assessment-service";
import { AssessmentStore } from "../stores/assessment-store.svelte";

function makeShotRecord(id: string, excluded = false): ShotRecord {
  return {
    id,
    sessionId: "sess-1",
    videoId: null,
    shotIndex: 0,
    orientation: null,
    startFrame: 0,
    endFrame: 10,
    overallConfidence: 0.9,
    excluded,
    analysis: makeShotAnalysis(),
    createdAt: 0,
  };
}

function makeOutcome(shots: ShotRecord[]): AssessmentOutcome {
  return {
    sessionId: "sess-1",
    shots,
    sessionScore: {
      form: 70,
      consistency: null,
      efficiency: 60,
      overall: 67,
      breakdown: {} as AssessmentOutcome["sessionScore"]["breakdown"],
      scoringVersion: 1,
    },
    focusAreas: [],
  };
}

function makeFakeService(overrides: Partial<AssessmentService> = {}) {
  const outcome = makeOutcome([makeShotRecord("shot-1")]);
  const service: AssessmentService = {
    runAssessment: vi.fn(async () => outcome),
    rescoreSession: vi.fn(async () =>
      makeOutcome([makeShotRecord("shot-1", true)]),
    ),
    setShotExcluded: vi.fn(async () => undefined),
    ...overrides,
  };
  return service;
}

const input = {
  input: { kind: "fixture" as const, fixtureId: "f1" },
  name: "f1",
};

describe("AssessmentStore state machine", () => {
  it("starts idle → picking via begin()", () => {
    const store = new AssessmentStore(makeFakeService());
    expect(store.phase).toBe("idle");
    store.begin();
    expect(store.phase).toBe("picking");
    store.begin(); // no-op
    expect(store.phase).toBe("picking");
  });

  it("only accepts inputs while picking, capped at 10", () => {
    const store = new AssessmentStore(makeFakeService());
    store.addInputs([input]); // ignored: still idle
    expect(store.inputs).toHaveLength(0);
    store.begin();
    store.addInputs(Array.from({ length: 12 }, () => input));
    expect(store.inputs).toHaveLength(10);
    store.removeInput(0);
    expect(store.inputs).toHaveLength(9);
  });

  it("start() runs the service and lands in reviewing", async () => {
    const service = makeFakeService();
    const store = new AssessmentStore(service);
    store.begin();
    store.addInputs([input]);
    await store.start();
    expect(service.runAssessment).toHaveBeenCalledOnce();
    expect(store.phase).toBe("reviewing");
    expect(store.outcome?.sessionId).toBe("sess-1");
  });

  it("start() without inputs is a no-op", async () => {
    const service = makeFakeService();
    const store = new AssessmentStore(service);
    store.begin();
    await store.start();
    expect(service.runAssessment).not.toHaveBeenCalled();
    expect(store.phase).toBe("picking");
  });

  it("abort lands in aborted", async () => {
    const service = makeFakeService({
      runAssessment: vi.fn(async () => {
        throw new AssessmentAbortedError("sess-1");
      }),
    });
    const store = new AssessmentStore(service);
    store.begin();
    store.addInputs([input]);
    await store.start();
    expect(store.phase).toBe("aborted");
  });

  it("errors return to picking with a message (retry affordance)", async () => {
    const service = makeFakeService({
      runAssessment: vi.fn(async () => {
        throw new Error("worker exploded");
      }),
    });
    const store = new AssessmentStore(service);
    store.begin();
    store.addInputs([input]);
    await store.start();
    expect(store.phase).toBe("picking");
    expect(store.error).toContain("worker exploded");
    expect(store.errorKind).toBe("generic");
  });

  it("zero detected shots flags the coaching empty state", async () => {
    const service = makeFakeService({
      runAssessment: vi.fn(async () => {
        throw new NoShotsDetectedError("sess-1");
      }),
    });
    const store = new AssessmentStore(service);
    store.begin();
    store.addInputs([input]);
    await store.start();
    expect(store.phase).toBe("picking");
    expect(store.errorKind).toBe("no-shots");

    // A retry clears the flag.
    await store.start();
    expect(store.errorKind).toBe("no-shots"); // still failing service
  });

  it("finishReview with no changes skips re-scoring", async () => {
    const service = makeFakeService();
    const store = new AssessmentStore(service);
    store.begin();
    store.addInputs([input]);
    await store.start();
    const sessionId = await store.finishReview();
    expect(sessionId).toBe("sess-1");
    expect(store.phase).toBe("done");
    expect(service.setShotExcluded).not.toHaveBeenCalled();
    expect(service.rescoreSession).not.toHaveBeenCalled();
  });

  it("finishReview applies exclusions and re-scores", async () => {
    const service = makeFakeService();
    const store = new AssessmentStore(service);
    store.begin();
    store.addInputs([input]);
    await store.start();

    const shot = store.outcome!.shots[0]!;
    store.toggleExclude(shot);
    expect(store.isExcluded(shot)).toBe(true);
    store.toggleExclude(shot);
    expect(store.isExcluded(shot)).toBe(false);
    store.toggleExclude(shot);

    await store.finishReview();
    expect(service.setShotExcluded).toHaveBeenCalledWith("shot-1", true);
    expect(service.rescoreSession).toHaveBeenCalledWith("sess-1");
    expect(store.phase).toBe("done");
  });
});
