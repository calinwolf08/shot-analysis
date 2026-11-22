import { afterEach, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { ALL_MIGRATIONS, migrate as migrateLegacy } from "$lib/shared/db";
import {
  createBetterSqliteAdapterFor,
  openBetterSqlite,
} from "$lib/shared/db/drivers/better-sqlite3";
import { createSqliteKysely, type AppDatabase } from "../kysely";
import { migrateDatabase } from "../migrate";
import { APP_TABLES } from "../schema";
import { FRESH_POSTGRES, disposeTestDatabase } from "./dialects";

const open: AppDatabase[] = [];
afterEach(async () => {
  while (open.length) await disposeTestDatabase(open.pop()!);
});

function sqlite(): {
  app: AppDatabase;
  adapter: ReturnType<typeof createBetterSqliteAdapterFor>;
} {
  const conn = openBetterSqlite(":memory:");
  const app: AppDatabase = { kind: "sqlite", db: createSqliteKysely(conn) };
  open.push(app);
  return { app, adapter: createBetterSqliteAdapterFor(conn) };
}

const BOOKKEEPING =
  /^(kysely_migration|kysely_migration_lock|schema_migrations)$/;

/** Table → sorted column descriptors (normalized for comparison). */
async function describeSchema(
  app: AppDatabase,
  opts: { types: boolean },
): Promise<Record<string, string[]>> {
  const tables = await app.db.introspection.getTables();
  // Postgres: only this database's schema (a real server may hold others).
  const current =
    app.kind === "postgres"
      ? (await sql<{ s: string }>`SELECT current_schema() AS s`.execute(app.db))
          .rows[0]!.s
      : undefined;
  const out: Record<string, string[]> = {};
  for (const t of tables) {
    if (BOOKKEEPING.test(t.name)) continue;
    if (current && t.schema !== current) continue;
    out[t.name] = t.columns
      .map((c) =>
        [
          c.name,
          opts.types ? c.dataType.toLowerCase() : "",
          c.isNullable ? "null" : "notnull",
          c.hasDefaultValue ? "default" : "",
        ].join(" "),
      )
      .sort();
  }
  return out;
}

async function indexNames(app: AppDatabase): Promise<string[]> {
  const rows =
    app.kind === "sqlite"
      ? await sql<{ name: string }>`SELECT name FROM sqlite_master
          WHERE type = 'index' AND name LIKE 'idx_%'`.execute(app.db)
      : await sql<{ name: string }>`SELECT indexname AS name FROM pg_indexes
          WHERE schemaname = current_schema() AND indexname LIKE 'idx_%'`.execute(
          app.db,
        );
  return rows.rows.map((r) => r.name).sort();
}

/** Primary-key columns (SQLite reports TEXT PKs as nullable; Postgres doesn't). */
const PK_COLUMNS = new Set(["id", "key", "shot_id", "metric_name", "user_id"]);

describe.each(FRESH_POSTGRES)(
  "migrateDatabase (Postgres: %s)",
  (_pgName, freshPg) => {
    /** A fresh, empty Postgres of this kind. */
    async function pg(): Promise<AppDatabase> {
      const { app } = await freshPg();
      open.push(app);
      return app;
    }

    it("fresh SQLite: the baseline creates every table + index", async () => {
      const { app, adapter } = sqlite();
      const r = await migrateDatabase(app, { legacy: adapter });
      expect(r.legacyApplied).toEqual([]);
      expect(r.applied).toEqual(["0001-baseline"]);
      const tables = Object.keys(await describeSchema(app, { types: false }));
      expect(tables.sort()).toEqual([...APP_TABLES].sort());
      expect((await indexNames(app)).length).toBe(13);
    });

    it("fresh Postgres (PGlite): the same baseline creates every table + index", async () => {
      const app = await pg();
      const r = await migrateDatabase(app);
      expect(r.applied).toEqual(["0001-baseline"]);
      const tables = Object.keys(await describeSchema(app, { types: false }));
      expect(tables.sort()).toEqual([...APP_TABLES].sort());
      expect((await indexNames(app)).length).toBe(13);
      // The forward reference sessions → plan_items exists as a real FK.
      const fk = await sql<{ n: number }>`SELECT count(*)::int AS n
      FROM information_schema.table_constraints
      WHERE table_name = 'sessions' AND constraint_type = 'FOREIGN KEY'`.execute(
        app.db,
      );
      expect(fk.rows[0]!.n).toBe(2); // player_id + plan_item_id
    });

    it("schema parity: the baseline equals the legacy-built schema on SQLite, exactly", async () => {
      const legacy = sqlite();
      await migrateLegacy(legacy.adapter);
      const fresh = sqlite();
      await migrateDatabase(fresh.app, { legacy: fresh.adapter });
      expect(await describeSchema(fresh.app, { types: true })).toEqual(
        await describeSchema(legacy.app, { types: true }),
      );
      expect(await indexNames(fresh.app)).toEqual(await indexNames(legacy.app));
    });

    it("schema parity across dialects: same tables, columns, nullability, defaults", async () => {
      const s = sqlite();
      await migrateDatabase(s.app, { legacy: s.adapter });
      const p = await pg();
      await migrateDatabase(p);
      const strip = (schema: Record<string, string[]>) =>
        Object.fromEntries(
          Object.entries(schema).map(([t, cols]) => [
            t,
            cols.map((c) => {
              const [name, , nullable, dflt] = c.split(" ");
              return PK_COLUMNS.has(name!)
                ? `${name} ${dflt}`
                : `${name} ${nullable} ${dflt}`;
            }),
          ]),
        );
      expect(strip(await describeSchema(p, { types: false }))).toEqual(
        strip(await describeSchema(s.app, { types: false })),
      );
      expect(await indexNames(p)).toEqual(await indexNames(s.app));
    });

    it("upgrades an older SQLite database with its data intact", async () => {
      const { app, adapter } = sqlite();
      // A database left at legacy version 5 with a player and a shot.
      await migrateLegacy(
        adapter,
        ALL_MIGRATIONS.filter((m) => m.version <= 5),
      );
      await adapter.run(
        `INSERT INTO players (id, name, shooting_hand, level, created_at, updated_at, user_id)
       VALUES ('p1', 'A', 'right', 'advanced', 1, 1, 'u1')`,
      );
      await adapter.run(
        `INSERT INTO shots (id, player_id, shot_index, orientation, excluded, analysis_json, created_at)
       VALUES ('s1', 'p1', 0, 'side-right', 0, '{}', 2)`,
      );
      await adapter.run(
        `INSERT INTO settings (key, value) VALUES ('liveFocusAreas', '["rise"]')`,
      );
      const r = await migrateDatabase(app, { legacy: adapter });
      expect(r.legacyApplied).toEqual([6, 7]);
      expect(r.applied).toEqual(["0001-baseline"]); // recorded, no-op
      expect(
        (await app.db.selectFrom("shots").select("id").execute()).map(
          (s) => s.id,
        ),
      ).toEqual(["s1"]);
      // 007 copied the global setting to the user.
      expect(
        await app.db.selectFrom("user_settings").selectAll().execute(),
      ).toEqual([{ user_id: "u1", key: "liveFocusAreas", value: '["rise"]' }]);
    });

    it("is idempotent: a second run applies nothing", async () => {
      const { app, adapter } = sqlite();
      await migrateDatabase(app, { legacy: adapter });
      expect(await migrateDatabase(app, { legacy: adapter })).toEqual({
        legacyApplied: [],
        applied: [],
      });
      const p = await pg();
      await migrateDatabase(p);
      expect((await migrateDatabase(p)).applied).toEqual([]);
    });

    it("rollback safety: the legacy runner sees a fresh SQLite baseline as current", async () => {
      const { app, adapter } = sqlite();
      await migrateDatabase(app, { legacy: adapter });
      expect((await migrateLegacy(adapter)).applied).toEqual([]);
    });

    it("typed queries work on both: insert/read a player, ms timestamps as numbers", async () => {
      const s = sqlite();
      await migrateDatabase(s.app, { legacy: s.adapter });
      const p = await pg();
      await migrateDatabase(p);
      for (const app of [s.app, p]) {
        await app.db
          .insertInto("players")
          .values({
            id: "p1",
            name: "A",
            shooting_hand: "right",
            level: "advanced",
            created_at: 1795299587815,
            updated_at: 1795299587815,
            user_id: "u1",
          })
          .execute();
        const row = await app.db
          .selectFrom("players")
          .selectAll()
          .where("id", "=", "p1")
          .executeTakeFirstOrThrow();
        expect(row.created_at).toBe(1795299587815);
        // CHECK constraints hold on both.
        await expect(
          app.db
            .insertInto("players")
            .values({
              id: "p2",
              name: "B",
              shooting_hand: "both" as "left",
              level: "x",
              created_at: 1,
              updated_at: 1,
              user_id: null,
            })
            .execute(),
        ).rejects.toThrow();
      }
    });
  },
);
