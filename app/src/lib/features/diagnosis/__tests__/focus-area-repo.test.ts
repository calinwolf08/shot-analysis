import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestServices,
  type TestServices,
} from "$lib/shared/config/test-services";
import { createPlayerRepo } from "$lib/shared/db/repos/player-repo";
import { createSessionRepo } from "$lib/shared/db/repos/session-repo";
import { createFocusAreaRepo } from "../repo/focus-area-repo";

let services: TestServices;
let sessionId: string;

beforeEach(async () => {
  services = await createTestServices();
  const player = await createPlayerRepo(services).create({
    name: "A",
    shootingHand: "right",
    level: "youth",
  });
  sessionId = (
    await createSessionRepo(services).create({
      playerId: player.id,
      type: "assessment",
    })
  ).id;
});

describe("FocusAreaRepo", () => {
  it("stores ranked focus areas and lists them by rank", async () => {
    const repo = createFocusAreaRepo(services);
    await repo.replaceForSession(sessionId, [
      {
        rank: 2,
        issueGroup: "rhythm",
        severity: 0.4,
        metrics: { contributing: ["ballLegSync"] },
      },
      {
        rank: 1,
        issueGroup: "alignment",
        severity: 0.7,
        metrics: { contributing: ["shootingElbowFlare"] },
      },
    ]);
    const rows = await repo.listBySession(sessionId);
    expect(rows.map((r) => r.issueGroup)).toEqual(["alignment", "rhythm"]);
    expect(rows[0]?.metrics).toEqual({
      contributing: ["shootingElbowFlare"],
    });
  });

  it("replaceForSession swaps the previous diagnosis atomically", async () => {
    const repo = createFocusAreaRepo(services);
    await repo.replaceForSession(sessionId, [
      { rank: 1, issueGroup: "posture", severity: 0.5, metrics: {} },
    ]);
    await repo.replaceForSession(sessionId, [
      { rank: 1, issueGroup: "guide-hand", severity: 0.9, metrics: {} },
      { rank: 2, issueGroup: "release", severity: 0.6, metrics: {} },
    ]);
    const rows = await repo.listBySession(sessionId);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.issueGroup).toBe("guide-hand");
  });
});
