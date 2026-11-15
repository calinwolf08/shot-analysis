import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb, resetDbSingletonForTests } from "$lib/server/db";
import { createFocusAreaRepo } from "$lib/features/diagnosis";
import { systemClock, uuidIdGenerator } from "$lib/shared/utils";

import { GET as benchmarksActive } from "../benchmarks/active/+server";
import { GET as drillsList } from "../drills/+server";
import { GET as drillById } from "../drills/[id]/+server";
import { GET as progressGet } from "../progress/+server";
import { GET as diagnosisGet } from "../diagnosis/+server";
import { GET as plansGet, POST as plansPost } from "../plans/+server";
import { GET as planById } from "../plans/[id]/+server";
import { PATCH as planItemPatch } from "../plans/items/[id]/+server";
import { POST as playersPost } from "../players/+server";
import { POST as sessionsPost } from "../sessions/+server";

const dir = mkdtempSync(join(tmpdir(), "shotcoach-domain-"));
const userA = { id: "user-a", email: "a@ex.com", name: "A" };
const userB = { id: "user-b", email: "b@ex.com", name: "B" };

beforeAll(() => {
  process.env.DATABASE_PATH = join(dir, "domain.sqlite");
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

/** Seeds surfaced focus rows the way the diagnosis service does. */
async function seedFocus(sessionId: string) {
  const db = await getDb();
  const repo = createFocusAreaRepo({
    db,
    clock: systemClock,
    ids: uuidIdGenerator,
  });
  await repo.replaceForSession(sessionId, [
    {
      rank: 1,
      issueGroup: "alignment",
      severity: 0.8,
      metrics: {
        displayName: "Alignment",
        whyItMatters: "test",
        surfaced: true,
        metrics: [{ metric: "shootingElbowFlare", severity: 0.8 }],
      },
    },
  ]);
}

describe("/api domain endpoints", () => {
  it("serves the global benchmark + drill catalogs to any signed-in user", async () => {
    const b = await call(benchmarksActive, { user: userA });
    expect(b.status).toBe(200);
    expect(b.body.id).toBeTruthy();

    const list = await call(drillsList, { user: userA });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);

    // Lookup by slug falls back correctly.
    const slug = list.body[0].slug;
    const one = await call(drillById, { user: userB, params: { id: slug } });
    expect(one.status).toBe(200);
    expect(one.body.slug).toBe(slug);

    expect(
      (await call(drillById, { user: userA, params: { id: "nope" } })).status,
    ).toBe(404);
  });

  it("401s unauthenticated domain requests", async () => {
    expect((await call(drillsList, {})).status).toBe(401);
    expect((await call(benchmarksActive, {})).status).toBe(401);
  });

  it("scopes progress + plans to the owning user and generates a plan", async () => {
    const p = await call(playersPost, {
      user: userA,
      body: { name: "A", shootingHand: "right", level: "high-school" },
    });
    const playerId = p.body.id;
    const s = await call(sessionsPost, {
      user: userA,
      body: { playerId, type: "assessment" },
    });
    const sessionId = s.body.id;
    await seedFocus(sessionId);

    // Owner can read progress; a stranger cannot touch A's player.
    expect(
      (await call(progressGet, { user: userA, url: `/?playerId=${playerId}` }))
        .status,
    ).toBe(200);
    expect(
      (await call(progressGet, { user: userB, url: `/?playerId=${playerId}` }))
        .status,
    ).toBe(403);

    // Diagnosis is readable by the owner, forbidden to others.
    const diag = await call(diagnosisGet, {
      user: userA,
      url: `/?sessionId=${sessionId}`,
    });
    expect(diag.status).toBe(200);
    expect(diag.body.length).toBe(1);
    expect(
      (
        await call(diagnosisGet, {
          user: userB,
          url: `/?sessionId=${sessionId}`,
        })
      ).status,
    ).toBe(403);

    // B cannot generate a plan against A's session/player.
    expect(
      (await call(plansPost, { user: userB, body: { sessionId, playerId } }))
        .status,
    ).toBe(403);

    // A generates a plan, reads it back, and completes its first item.
    const gen = await call(plansPost, {
      user: userA,
      body: { sessionId, playerId },
    });
    expect(gen.status).toBe(201);
    const planId = gen.body.id;

    const active = await call(plansGet, {
      user: userA,
      url: `/?playerId=${playerId}`,
    });
    expect(active.body.plan.id).toBe(planId);

    const full = await call(planById, { user: userA, params: { id: planId } });
    expect(full.body.items.length).toBeGreaterThan(0);
    // B cannot read A's plan.
    expect(
      (await call(planById, { user: userB, params: { id: planId } })).status,
    ).toBe(403);

    const itemId = full.body.items[0].id;
    expect(
      (await call(planItemPatch, { user: userB, params: { id: itemId } }))
        .status,
    ).toBe(403);
    expect(
      (await call(planItemPatch, { user: userA, params: { id: itemId } }))
        .status,
    ).toBe(200);
  });
});
