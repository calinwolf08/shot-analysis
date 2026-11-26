import { describe, expect, it } from "vitest";
import type { ProProfiles } from "basketball-shot-analysis";
import { loadProProfiles, resetProProfilesCache } from "../pros";

const profiles = {
  version: 1,
  builtAt: "2026-01-01T00:00:00Z",
  metricsSchema: 4,
  pros: [
    {
      id: "a",
      name: "A",
      shootingHand: "right",
      shots: 10,
      angles: [0],
      metrics: {},
    },
    {
      id: "b",
      name: "B",
      shootingHand: "right",
      shots: 10,
      angles: [0],
      metrics: {},
    },
  ],
} as unknown as ProProfiles;

describe("loading profiles", () => {
  it("null when the file is missing or empty", async () => {
    resetProProfilesCache();
    const missing = (async () =>
      new Response("", { status: 404 })) as typeof fetch;
    expect(await loadProProfiles(missing)).toBeNull();
    resetProProfilesCache();
    const empty = (async () =>
      new Response(JSON.stringify({ pros: [] }))) as typeof fetch;
    expect(await loadProProfiles(empty)).toBeNull();
    resetProProfilesCache();
    const ok = (async () =>
      new Response(JSON.stringify(profiles))) as typeof fetch;
    expect((await loadProProfiles(ok))?.pros).toHaveLength(2);
    resetProProfilesCache();
  });
});
