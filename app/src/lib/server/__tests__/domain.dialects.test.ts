import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ShotAnalysis } from "basketball-shot-analysis";
import {
  createBetterSqliteAdapterFor,
  openBetterSqlite,
} from "$lib/shared/db/drivers/better-sqlite3";
import { noRawSql, type RepoContext } from "$lib/shared/db/repo-base";
import { createFakeClock, createFakeIdGenerator } from "$lib/shared/utils";
import { createBenchmarkRepo } from "$lib/features/benchmarks/repo/benchmark-repo";
import { createDrillRepo } from "$lib/features/drills/repo/drill-repo";
import { createFocusAreaRepo } from "$lib/features/diagnosis/repo/focus-area-repo";
import { createPlanRepo } from "$lib/features/training-plan/repo/plan-repo";
import { createProgressService } from "$lib/features/progress/service";
import { createSqliteKysely, type AppDatabase } from "../database/kysely";
import { migrateDatabase } from "../database/migrate";
import { createPgliteDatabase } from "../database/__tests__/pglite";
import { createServerRepos } from "../repos";
import { seedGlobals } from "../services";

/**
 * The server's feature repos + progress service give the same answers on
 * SQLite and Postgres: upserts (ON CONFLICT), transactions, joins, and the
 * aggregates whose types differ by database (COUNT/SUM → int8, AVG → numeric;
 * both must come back as JS numbers).
 */
const DIALECTS: [string, () => Promise<AppDatabase>][] = [
  [
    "sqlite",
    async () => {
      const conn = openBetterSqlite(":memory:");
      const app: AppDatabase = { kind: "sqlite", db: createSqliteKysely(conn) };
      await migrateDatabase(app, {
        legacy: createBetterSqliteAdapterFor(conn),
      });
      return app;
    },
  ],
  [
    "postgres (PGlite)",
    async () => {
      const app = createPgliteDatabase();
      await migrateDatabase(app);
      return app;
    },
  ],
];

const DAY = 86_400_000;

function analysis(knee: number): ShotAnalysis {
  return {
    shotIndex: 0,
    frameRange: { start: 0, end: 10 },
    orientation: "side-right",
    overallConfidence: 0.9,
    phases: {},
    metrics: {
      kneeFlexion: { value: knee, unit: "deg", frame: 3, confidence: 0.9 },
      orientationTag: { value: "side", unit: "", frame: 0, confidence: 1 },
    },
  } as unknown as ShotAnalysis;
}

describe.each(DIALECTS)("domain on %s", (_name, make) => {
  let app: AppDatabase;
  let ctx: RepoContext;
  beforeEach(async () => {
    app = await make();
    ctx = {
      db: noRawSql("test"),
      kdb: app.db,
      clock: createFakeClock(10 * DAY + 5_000),
      ids: createFakeIdGenerator(),
    };
  });
  afterEach(async () => {
    await app.db.destroy();
  });

  it("seeds the global catalogs; upserts update in place", async () => {
    await seedGlobals(app.db);
    await seedGlobals(app.db); // idempotent (ON CONFLICT DO UPDATE)
    const benchmarks = createBenchmarkRepo(ctx);
    const drills = createDrillRepo(ctx);
    const list = await benchmarks.list();
    expect(list.length).toBeGreaterThan(0);
    await benchmarks.upsert({
      id: list[0]!.id,
      name: "Renamed",
      version: 9,
      isPlaceholder: false,
      data: { a: 1 },
    });
    const b = await benchmarks.get(list[0]!.id);
    expect(b).toMatchObject({
      name: "Renamed",
      version: 9,
      isPlaceholder: false,
    });
    expect((await benchmarks.list()).length).toBe(list.length);
    const ds = await drills.list();
    expect(ds.length).toBeGreaterThan(0);
    expect((await drills.getBySlug(ds[0]!.slug))?.id).toBe(ds[0]!.id);
  });

  it("focus areas replace atomically; plans + items round-trip", async () => {
    await seedGlobals(app.db);
    const repos = createServerRepos(app.db, "u1");
    const p = await repos.player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    const s = await repos.session.create({
      playerId: p.id,
      type: "assessment",
    });
    const focus = createFocusAreaRepo(ctx);
    await focus.replaceForSession(s.id, [
      { rank: 1, issueGroup: "a", severity: 0.5, metrics: { x: 1 } },
      { rank: 2, issueGroup: "b", severity: 0.25, metrics: [] },
    ]);
    await focus.replaceForSession(s.id, [
      { rank: 1, issueGroup: "c", severity: 0.75, metrics: {} },
    ]);
    const areas = await focus.listBySession(s.id);
    expect(areas.map((a) => [a.rank, a.issueGroup, a.severity])).toEqual([
      [1, "c", 0.75],
    ]);

    const drill = (await createDrillRepo(ctx).list())[0]!;
    const plans = createPlanRepo(ctx);
    const plan = await plans.createWithItems({
      playerId: p.id,
      sourceSessionId: s.id,
      focus: { top: "c" },
      items: [
        {
          dayIndex: 1,
          position: 1,
          type: "drill",
          drillId: drill.id,
          focusMetric: null,
          targetReps: 10,
        },
        {
          dayIndex: 0,
          position: 0,
          type: "live_practice",
          drillId: null,
          focusMetric: "knee",
          targetReps: null,
        },
      ],
    });
    expect((await plans.getActiveByPlayer(p.id))?.id).toBe(plan.id);
    const items = await plans.getItems(plan.id);
    expect(items.map((i) => i.dayIndex)).toEqual([0, 1]);
    await plans.updateItemStatus(items[0]!.id, "done");
    expect((await plans.getItem(items[0]!.id))?.completedAt).toBe(
      10 * DAY + 5_000,
    );
    await plans.setStatus(plan.id, "completed");
    expect(await plans.getActiveByPlayer(p.id)).toBeNull();
  });

  it("progress: history, metric trend (AVG) and totals (COUNT/SUM) as numbers", async () => {
    await seedGlobals(app.db);
    const benchmarkId = (await createBenchmarkRepo(ctx).list())[0]!.id;
    // Two completed sessions on consecutive days, each with two shots.
    let t = 9 * DAY + 1_000;
    const clocked = (now: number) =>
      createServerRepos(app.db, "u1", { now: () => now });
    const p = await clocked(t).player.create({
      name: "A",
      shootingHand: "right",
      level: "advanced",
    });
    for (const [i, knees] of [
      [0, [100, 110]],
      [1, [120, 140]],
    ] as const) {
      const repos = clocked(t);
      const s = await repos.session.create({
        playerId: p.id,
        type: i === 0 ? "assessment" : "live_practice",
      });
      for (const k of knees) {
        await repos.shot.saveAnalysis({
          sessionId: s.id,
          analysis: analysis(k),
        });
      }
      await repos.score.insert({
        scope: "session",
        refId: s.id,
        benchmarkId,
        scoringVersion: 1,
        overallScore: 70 + i,
        breakdown: {},
      });
      await repos.session.complete(s.id);
      t += DAY;
    }
    const progress = createProgressService(ctx);

    const history = await progress.scoreHistory(p.id);
    expect(history.map((h) => [h.type, h.overallScore])).toEqual([
      ["assessment", 70],
      ["live_practice", 71],
    ]);
    expect(typeof history[0]!.completedAt).toBe("number");

    const trend = await progress.metricTrend(p.id, "kneeFlexion" as never);
    expect(trend.map((x) => [x.mean, x.n])).toEqual([
      [105, 2],
      [130, 2],
    ]);
    expect(trend[1]!.std).toBeCloseTo(10, 9);

    expect(await progress.totals(p.id)).toEqual({
      sessions: 2,
      assessments: 1,
      repsAnalyzed: 4,
      streakDays: 2, // days 9 and 10 (today = day 10)
    });
  });
});
