import { describe, expect, it } from "vitest";
import { createCuePacer } from "../cue-pacer";

const CFG = {
  holdMs: 1500,
  cooldownMs: 5000,
  repeatSameMs: 10000,
  readyHoldMs: 1000,
};

/** A pacer on a manual clock, plus a helper to feed a cue for a duration. */
function harness(cfg = CFG) {
  let t = 0;
  const pacer = createCuePacer(cfg, () => t);
  const said: { t: number; what: string }[] = [];
  /** Feed `cue` every 100 ms for `ms`. */
  const feed = (cue: string | null, ms: number, coachable = true) => {
    const end = t + ms;
    while (t < end) {
      const out = pacer.update(cue, coachable);
      if (out) said.push({ t, what: out.kind === "ready" ? "ready" : out.cue });
      t += 100;
    }
  };
  return { pacer, said, feed, now: () => t };
}

describe("createCuePacer", () => {
  it("waits for a cue to hold before speaking it", () => {
    const h = harness();
    h.feed("full-body", 1400);
    expect(h.said).toEqual([]);
    h.feed("full-body", 200);
    expect(h.said.map((s) => s.what)).toEqual(["full-body"]);
    expect(h.said[0]!.t).toBe(1500);
  });

  it("never speaks a cue that flickers shorter than the hold", () => {
    const h = harness();
    for (let i = 0; i < 20; i++) {
      h.feed("full-body", 700);
      h.feed("side-on", 700);
    }
    expect(h.said).toEqual([]);
  });

  it("repeats the same cue no more often than repeatSameMs", () => {
    const h = harness();
    h.feed("side-on", 30_000);
    const times = h.said.map((s) => s.t);
    expect(times).toEqual([1500, 11500, 21500]);
  });

  it("keeps the global cooldown between different cues", () => {
    const h = harness();
    h.feed("full-body", 2000); // spoken at 1.5 s
    h.feed("side-on", 6000); // held from 2 s; cooldown until 6.5 s
    const [a, b] = h.said;
    expect(a!.what).toBe("full-body");
    expect(b!.what).toBe("side-on");
    expect(b!.t - a!.t).toBeGreaterThanOrEqual(5000);
  });

  it("says Ready once after the ready hold, skipping the cooldown", () => {
    const h = harness();
    h.feed("side-on", 1600); // cue at 1.5 s
    h.feed(null, 3000);
    expect(h.said.map((s) => s.what)).toEqual(["side-on", "ready"]);
    expect(h.said[1]!.t).toBe(2600); // 1 s after positioned, inside cooldown
  });

  it("does not re-announce Ready after a brief flicker out of position", () => {
    const h = harness();
    h.feed(null, 1200);
    h.feed("full-body", 500); // shorter than holdMs
    h.feed(null, 2000);
    expect(h.said.map((s) => s.what)).toEqual(["ready"]);
  });

  it("re-arms Ready after a real correction", () => {
    const h = harness();
    h.feed(null, 1200);
    // Spoken once the cooldown after "Ready" (5 s) has passed.
    h.feed("full-body", 6000);
    h.feed(null, 2000);
    expect(h.said.map((s) => s.what)).toEqual(["ready", "full-body", "ready"]);
  });

  it("stays silent while not coachable, then speaks once coachable", () => {
    const h = harness();
    h.feed("side-on", 3000, false);
    expect(h.said).toEqual([]);
    h.feed("side-on", 100);
    expect(h.said.map((s) => s.what)).toEqual(["side-on"]);
  });

  it("follows tuned values", () => {
    const h = harness({
      holdMs: 500,
      cooldownMs: 1000,
      repeatSameMs: 2000,
      readyHoldMs: 0,
    });
    h.feed("side-on", 5000);
    expect(h.said.map((s) => s.t)).toEqual([500, 2500, 4500]);
  });

  it("reports a snapshot for the debug panel", () => {
    const h = harness();
    h.feed("full-body", 1600);
    const snap = h.pacer.snapshot();
    expect(snap.current).toBe("full-body");
    expect(snap.lastSpoken).toBe("full-body");
    expect(snap.cooldownLeftMs).toBeGreaterThan(4000);
  });
});
