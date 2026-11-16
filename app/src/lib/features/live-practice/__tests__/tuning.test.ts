import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LIVE_TUNING, loadLiveTuning, mergeTuning } from "../tuning";

describe("mergeTuning", () => {
  it("returns defaults for an empty object", () => {
    expect(mergeTuning({})).toEqual({
      tuning: DEFAULT_LIVE_TUNING,
      warnings: [],
    });
  });

  it("overrides only the given keys and ignores $comment", () => {
    const r = mergeTuning({
      $comment: "x",
      cues: { $comment: "y", cooldownMs: 3000 },
    });
    expect(r.warnings).toEqual([]);
    expect(r.tuning.cues.cooldownMs).toBe(3000);
    expect(r.tuning.cues.holdMs).toBe(DEFAULT_LIVE_TUNING.cues.holdMs);
    expect(r.tuning.readiness).toEqual(DEFAULT_LIVE_TUNING.readiness);
  });

  it("drops invalid values and unknown keys with warnings", () => {
    const r = mergeTuning({
      cues: { holdMs: -5, cooldownMs: "soon", typo: 1 },
      readiness: { minOrientationAgreement: 2 },
    });
    expect(r.tuning).toEqual(DEFAULT_LIVE_TUNING);
    expect(r.warnings).toHaveLength(4);
  });

  it("warns on a non-object file", () => {
    const r = mergeTuning("nope");
    expect(r.tuning).toEqual(DEFAULT_LIVE_TUNING);
    expect(r.warnings).toHaveLength(1);
  });
});

describe("the shipped live-tuning.json", () => {
  it("is valid and matches the code defaults", () => {
    const raw = JSON.parse(
      readFileSync(
        join(__dirname, "../../../../../static/config/live-tuning.json"),
        "utf8",
      ),
    );
    const r = mergeTuning(raw);
    expect(r.warnings).toEqual([]);
    expect(r.tuning).toEqual(DEFAULT_LIVE_TUNING);
  });
});

describe("loadLiveTuning", () => {
  it("falls back to defaults on HTTP errors", async () => {
    const fetchImpl = (async () =>
      new Response("", { status: 404 })) as typeof fetch;
    const r = await loadLiveTuning(fetchImpl);
    expect(r.tuning).toEqual(DEFAULT_LIVE_TUNING);
    expect(r.warnings[0]).toMatch(/404/);
  });

  it("falls back to defaults on bad JSON", async () => {
    const fetchImpl = (async () => new Response("{not json")) as typeof fetch;
    const r = await loadLiveTuning(fetchImpl);
    expect(r.tuning).toEqual(DEFAULT_LIVE_TUNING);
    expect(r.warnings).toHaveLength(1);
  });

  it("applies the fetched file without caching", async () => {
    let init: RequestInit | undefined;
    const fetchImpl = (async (_u: string, i?: RequestInit) => {
      init = i;
      return new Response(JSON.stringify({ cues: { holdMs: 200 } }));
    }) as typeof fetch;
    const r = await loadLiveTuning(fetchImpl);
    expect(r.tuning.cues.holdMs).toBe(200);
    expect(init?.cache).toBe("no-store");
  });
});
