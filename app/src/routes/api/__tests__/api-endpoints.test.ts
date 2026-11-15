import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { resetDbSingletonForTests } from "$lib/server/db";

import { POST as playersPost } from "../players/+server";
import { GET as playersCurrent } from "../players/current/+server";
import { GET as sessionsGet, POST as sessionsPost } from "../sessions/+server";
import { PATCH as sessionPatch } from "../sessions/[id]/+server";
import { GET as shotsGet, POST as shotsPost } from "../shots/+server";
import { PATCH as shotPatch } from "../shots/[id]/+server";

const dir = mkdtempSync(join(tmpdir(), "shotcoach-api-"));
const userA = { id: "user-a", email: "a@ex.com", name: "A" };
const userB = { id: "user-b", email: "b@ex.com", name: "B" };

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "api.sqlite");
});
afterAll(() => {
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => resetDbSingletonForTests());

type Handler = (event: RequestEvent) => Promise<Response>;

function ev(opts: {
  user?: unknown;
  body?: unknown;
  params?: Record<string, string>;
  url?: string;
}): RequestEvent {
  const url = "http://localhost" + (opts.url ?? "/");
  return {
    locals: { user: opts.user ?? null, session: null },
    request: new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    url: new URL(url),
    params: opts.params ?? {},
  } as unknown as RequestEvent;
}

async function call(h: Handler, opts: Parameters<typeof ev>[0]) {
  const res = await h(ev(opts));
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body };
}

const fakeAnalysis = (shotIndex = 0) => ({
  shotIndex,
  frameRange: { start: 0, end: 10 },
  orientation: "side-left",
  overallConfidence: 0.9,
  metrics: {},
});

describe("/api endpoints", () => {
  it("401s unauthenticated requests", async () => {
    expect((await call(playersCurrent, {})).status).toBe(401);
    expect((await call(playersPost, { body: {} })).status).toBe(401);
  });

  it("400s an invalid body", async () => {
    const r = await call(playersPost, { user: userA, body: { name: "" } });
    expect(r.status).toBe(400);
  });

  it("round-trips a player, session, and shot for the owner", async () => {
    const p = await call(playersPost, {
      user: userA,
      body: { name: "A", shootingHand: "right", level: "advanced" },
    });
    expect(p.status).toBe(201);
    const playerId = p.body.id;

    expect((await call(playersCurrent, { user: userA })).body.id).toBe(
      playerId,
    );

    const s = await call(sessionsPost, {
      user: userA,
      body: { playerId, type: "assessment" },
    });
    expect(s.status).toBe(201);
    const sessionId = s.body.id;

    const shot = await call(shotsPost, {
      user: userA,
      body: { sessionId, analysis: fakeAnalysis() },
    });
    expect(shot.status).toBe(201);

    const list = await call(shotsGet, {
      user: userA,
      url: `/api/shots?sessionId=${sessionId}`,
    });
    expect(list.body.length).toBe(1);
  });

  it("keeps users isolated across the API", async () => {
    // A sets up data.
    const p = await call(playersPost, {
      user: userA,
      body: { name: "A", shootingHand: "right", level: "advanced" },
    });
    const playerId = p.body.id;
    const s = await call(sessionsPost, {
      user: userA,
      body: { playerId, type: "assessment" },
    });
    const sessionId = s.body.id;
    const shot = await call(shotsPost, {
      user: userA,
      body: { sessionId, analysis: fakeAnalysis() },
    });
    const shotId = shot.body.id;

    // B sees its own (empty) world.
    expect((await call(playersCurrent, { user: userB })).body).toBeNull();
    expect(
      (
        await call(sessionsGet, {
          user: userB,
          url: `/api/sessions?playerId=${playerId}`,
        })
      ).body,
    ).toEqual([]);
    expect(
      (
        await call(shotsGet, {
          user: userB,
          url: `/api/shots?sessionId=${sessionId}`,
        })
      ).body,
    ).toEqual([]);

    // B cannot mutate A's resources → 403.
    expect(
      (
        await call(sessionPatch, {
          user: userB,
          params: { id: sessionId },
          body: { action: "complete" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(shotPatch, {
          user: userB,
          params: { id: shotId },
          body: { excluded: true },
        })
      ).status,
    ).toBe(403);
    // B cannot create a session under A's player → 403.
    expect(
      (
        await call(sessionsPost, {
          user: userB,
          body: { playerId, type: "assessment" },
        })
      ).status,
    ).toBe(403);

    // A still can.
    expect(
      (
        await call(sessionPatch, {
          user: userA,
          params: { id: sessionId },
          body: { action: "complete" },
        })
      ).status,
    ).toBe(200);
  });
});
