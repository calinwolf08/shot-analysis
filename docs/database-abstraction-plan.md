# Database abstraction (Kysely): SQLite or Postgres via an env var

**Goal.** The server runs on either SQLite (today's single file) or Postgres.
An environment variable chooses which, and no other code changes. All server
queries go through one typed query layer, Kysely, and better-auth uses the
same connection. SQLite stays the default.

**Out of scope.** The client has no database anymore. Since the server
migration, all user data goes through the API (`createRemoteRepos`;
`services.ts` installs a stub DB that throws). This plan only touches the
server.

---

## 1. Current state (from the code)

| Area                     | Where                                                                                                      | How it talks to the DB                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| DB handle                | `lib/server/db.ts` → `createBetterSqliteAdapter`                                                           | One `DatabaseAdapter` (`run` / `query` / `transaction`), raw SQL with `?` placeholders.                                    |
| User-scoped repos        | `lib/server/repos.ts` (~690 lines)                                                                         | Player, video, session, shot (+ poses), score, rep and settings. Raw SQL with ownership joins.                             |
| Feature repos / services | `features/{benchmarks,drills,diagnosis,training-plan}/repo/*`, `features/progress/service.ts` (~600 lines) | Raw SQL via `RepoContext.db`. Benchmarks and drills are seeded at boot (`seedGlobals`).                                    |
| Shared SQLite repos      | `lib/shared/db/repos/*` (~950 lines)                                                                       | Only `test-services.ts` (unit tests) uses them now. The server has its own copies in `repos.ts`.                           |
| Migrations               | `lib/shared/db/migrations/001–007` + `migrate()`, table `schema_migrations`                                | Raw SQLite DDL: `PRAGMA defer_foreign_keys` and a table rebuild in 004, `INSERT OR REPLACE` in data steps.                 |
| Auth                     | `lib/server/auth.ts`                                                                                       | better-auth on its own `better-sqlite3` connection to the same file. Tables: `user`, `session`, `account`, `verification`. |
| Test-only DB code        | `api/auth-test/reset`, `test-services.ts`, DB driver tests                                                 | Raw SQL; better-sqlite3 in memory.                                                                                         |
| Leftover client drivers  | `shared/db/drivers/{sqljs-web,capacitor-sqlite}.ts`, `create-database.ts`, `bytes-store.ts`                | No longer used by the production client (see Phase 7).                                                                     |

SQLite-only syntax in use:

- `INSERT OR REPLACE` (settings);
- `PRAGMA` (foreign keys, `table_info` in tests);
- `sqlite_master` (tests);
- integer booleans (`toBool` / `fromBool`);
- `INTEGER` millisecond timestamps;
- JSON in `TEXT` columns.

## 2. Decisions (proposed defaults — confirm before Phase 1)

1. **Selector.**
   - `DATABASE_URL=postgres://…` means Postgres.
   - Otherwise `DATABASE_PATH` (a SQLite file) means SQLite.
   - In production the server **refuses to start** unless one of them is set
     explicitly. That prevents silently writing to a throwaway file inside the
     container, which is what lost accounts on redeploy.
2. **One schema for both databases**, using portable types:
   - `TEXT` ids and JSON;
   - `BIGINT` millisecond timestamps (an `INTEGER` affinity alias on SQLite);
   - `INTEGER` 0/1 booleans on both, so no boolean conversions are needed;
   - `DOUBLE PRECISION` / `REAL` for floats.

   Postgres-native `boolean` / `jsonb` can come later and are not required.

3. **Postgres `BIGINT` comes back as a JS number:** register a `pg` type
   parser for int8. Timestamps fit safely in 2^53.
4. **Kysely `Migrator`** owns schema changes from now on: one **baseline**
   migration equal to today's schema (version 7), then new migrations.
   Existing SQLite files are recognized and baselined without re-running
   anything.
5. **Tests use PGlite** (Postgres in WebAssembly, in-process) as the Postgres
   variant, so neither developers nor CI need Docker. CI also runs one job
   against a real Postgres service container.
6. **The repo interfaces stay unchanged** (`AppRepos`, the feature repo
   types), so API routes, services and the client are untouched.

## 3. Phases

Each phase ends green: `npm run verify` plus the full Playwright suite on
SQLite, plus the phase's Postgres checks.

### Phase 1 — Foundation: config, dialect factory, typed schema

- Dependencies (server only): `kysely`, `pg` (+ `@types/pg`), and for tests
  `@electric-sql/pglite` plus a PGlite Kysely dialect.
- `lib/server/database/config.ts`: reads the environment and returns
  `{ kind: "sqlite", path } | { kind: "postgres", url }`. Includes the
  production guard.
- `lib/server/database/schema.ts`: a Kysely `Database` interface for every
  app table (`players`, `videos`, `sessions`, `shots`, `shot_poses`,
  `shot_metrics`, `scores`, `reps`, `benchmarks`, `focus_areas`, `drills`,
  `plans`, `plan_items`, `settings`, `user_settings`).
- `lib/server/database/kysely.ts`: `createKysely(config)`.
  - SQLite: `SqliteDialect` over better-sqlite3, with `PRAGMA foreign_keys = ON`.
  - Postgres: `PostgresDialect` over a `pg.Pool`, with the int8 parser.
  - Tests: PGlite.
- `getDb()` returns the Kysely instance. During the transition it also
  exposes the old `DatabaseAdapter` for code not yet converted, implemented
  on top of Kysely `sql` raw queries for SQLite only.
- **Validation:** unit tests for config parsing and the guard. A
  smoke test opens both dialects and runs `select 1`.

### Phase 2 — Portable migrations

- `lib/server/database/migrations/0001-baseline.ts`: today's full schema
  (after 007), written with Kysely's schema builder (`createTable`,
  `addColumn`, `createIndex`, foreign keys). It runs on both databases.
- Existing **SQLite** databases:
  - Below version 7: run the legacy `migrate()` (001–007) first.
  - Then a one-time step records `0001-baseline` as applied in Kysely's
    migration table without running it.
- A **fresh** database of either kind runs the baseline. The data-cleanup
  steps (006 shot deletion, 007 settings copy) aren't needed on an empty
  database.
- **Validation:**
  - **Schema parity:** introspect both dialects (Kysely
    `introspection.getTables()`) and compare table and column names and
    nullability.
  - **Upgrade:** an old SQLite file at version 5 upgrades to the baseline
    with its data intact.
  - **Idempotent:** running migrate twice applies nothing.

### Phase 3 — Server repos on Kysely

- Rewrite `lib/server/repos.ts` with the Kysely query builder:
  - same SQL semantics;
  - ownership enforced with the same joins;
  - `INSERT OR REPLACE` becomes `insertInto(...).onConflict((oc) =>
oc.columns([...]).doUpdateSet(...))`;
  - transactions use `db.transaction().execute(...)`.
- Rewrite the server-side feature repos and services in the same way:
  benchmark, drill, focus-area and plan repos, `progress/service.ts`, and
  `seedGlobals`.
- `RepoContext` gains the Kysely instance (`db: Kysely<Database>`). The old
  `DatabaseAdapter` field is removed once nothing reads it.
- `api/auth-test/reset` (E2E only) uses Kysely deletes.
- **Validation:**
  - The existing repo and isolation tests run against **SQLite and PGlite**
    (a parameterized `describe.each`).
  - The pipeline end-to-end test (`pipeline.test.ts`: live shot → persist →
    read-time migration) runs on both.

### Phase 4 — better-auth on the shared connection

- Pass the same dialect to better-auth:
  `database: { dialect, type: "sqlite" | "postgres" }`.
  - Its `getMigrations` creates `user`, `session`, `account` and
    `verification` on either database.
  - One connection pool overall, with no separate better-sqlite3 handle.
- **Validation:**
  - Auth server tests on both databases: sign up, sign in after sign-out,
    duplicate email rejected (any letter case), password reset, session
    revoke on reset.
  - E2E auth specs on SQLite.

### Phase 5 — Test matrix and CI

- `DB_TEST_DIALECT=sqlite|pglite` switches the server and integration
  suites. By default `npm test` runs both for the DB-touching suites.
- **CI:**
  - The existing jobs stay on SQLite.
  - New job: unit and integration tests plus the Playwright suite against a
    **real Postgres** service container (`DATABASE_URL`), catching anything
    PGlite misses (connection pooling, the int8 parser).
- **Validation:** CI is green on both. A deliberately broken query (e.g. a
  SQLite-only function) fails the Postgres job.

### Phase 6 — Moving data and deploying

- `npm run db:copy -- --from sqlite:/data/shotcoach.sqlite --to postgres://…`:
  - copies every table (app and better-auth) in foreign-key order, in
    batches, inside one Postgres transaction;
  - then compares row counts and a checksum of ids per table, and aborts on
    any mismatch.
- Docs (`docs/hosting-and-deployment.md`):
  - **SQLite:** a Coolify persistent volume at `/data` plus `DATABASE_PATH`.
  - **Postgres:** a Coolify Postgres resource, `DATABASE_URL`, backups.
  - How to switch between them and roll back (keep the SQLite file until
    Postgres is verified).
- **Validation:** copy a seeded SQLite database (users, shots with pose
  tracks, settings) to PGlite and real Postgres. The app then signs in with
  the same password and shows the same shots and scores.

### Phase 7 — Cleanup (optional, separate decision)

- Remove the leftover client database code that production no longer uses:
  - `sqljs-web`, `capacitor-sqlite`, `create-database`, `bytes-store`;
  - the `sql.js` / `@capacitor-community/sqlite` dependencies and the static
    `sqljs` wasm.
- Point `test-services.ts` at the server Kysely repos, then delete the
  duplicate `shared/db/repos/*` implementations, keeping their types.
- Remove the legacy `migrate()` once no SQLite database older than version 7
  can exist (after one release).

## Implementation notes

### Phases 1–2 (done)

- **Config** (`lib/server/database/config.ts`):
  - A `DATABASE_URL` with a `postgres://` or `postgresql://` scheme selects
    Postgres.
  - Otherwise `DATABASE_PATH` selects SQLite. A non-Postgres `DATABASE_URL` is
    still read as a SQLite path, for compatibility.
  - Setting both is an error.
  - **Production guard:** with `NODE_ENV=production` and neither set, the
    server refuses to start. The Docker image sets `NODE_ENV=production`.
    - A SvelteKit `init` hook in `hooks.server.ts` opens and migrates the
      database at startup. A bad config or a failed migration therefore exits
      the process (code 1, error logged) instead of failing every request.
    - The guard is skipped while `vite build` renders pages (`building`).
  - `describeDbConfig` hides credentials in logs.
- **Schema types** (`schema.ts`): a Kysely `Database` interface for all 15
  app tables.
- **Dialects** (`kysely.ts`):
  - **SQLite:** `createSqliteKysely` over an open better-sqlite3 connection.
  - **Postgres:** `createPostgresKysely` over a `pg.Pool`, with a per-pool
    type parser that turns int8 into a number.
  - **Tests:** PGlite via `kysely-pglite-dialect`, in `__tests__/pglite.ts`.
- **Server wiring** (`lib/server/db.ts`):
  - One better-sqlite3 connection is shared by the raw-SQL adapter (repos,
    until Phase 3) and Kysely. `getKysely()` exposes the latter.
  - A Postgres `DATABASE_URL` currently stops startup with a clear message,
    since the queries move over in Phase 3.
  - better-auth still opens the SQLite file itself (Phase 4).
- **Migrations** (`migrate.ts`, `migrations/0001-baseline.ts`):
  - **Legacy SQLite files** (those with a `schema_migrations` table) first
    finish the legacy runs 001–007 on the same connection.
  - **Kysely's `Migrator`** then runs `0001-baseline`, which builds today's
    schema with the schema builder.
  - **Fresh database (either kind):** the baseline creates all 15 tables and
    13 indexes. On Postgres, the sessions → plan_items foreign key is added
    after both tables exist.
  - **Upgraded database:** the baseline is recorded but does nothing.
  - **Rollback safety:** a fresh SQLite database also gets the legacy
    `schema_migrations` rows 1–7, so an older release's runner sees it as
    current.
- **Tests (17):**
  - Config, including the guard and credential hiding.
  - Both dialects run; Postgres BIGINT comes back as a number.
  - Fresh baseline on both, including the Postgres sessions → plan_items FK.
  - Schema parity:
    - **Baseline vs legacy on SQLite:** exact match on types, nullability,
      defaults and indexes.
    - **SQLite vs Postgres:** match on columns, nullability, defaults and
      indexes.
  - Legacy v5 → current with data intact, including 007's settings copy.
  - Idempotent on both.
  - Rollback safety.
  - Typed insert/select and CHECK constraints on both.

## 4. Risks

| Risk                                                                  | Mitigation                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pg` returns `BIGINT` as strings                                      | int8 type parser (Phase 1); a test asserts `createdAt` is a number on Postgres.                              |
| Booleans differ                                                       | Keep `INTEGER` 0/1 on both, so no conversions (decision 2).                                                  |
| Case-sensitive text comparisons in Postgres                           | Emails are lower-cased by better-auth; app lookups are by id. Audit any `LIKE`/text equality in Phase 3.     |
| `NULL` sort order differs                                             | Explicit `nulls last` where order matters (review list queries in Phase 3).                                  |
| Concurrency: Postgres runs concurrent writers, SQLite serializes them | Repos already use transactions for multi-statement writes; Phase 5 adds a concurrent-write test on Postgres. |
| Large JSON payloads (pose tracks)                                     | `TEXT` on both is fine. `jsonb` is optional later.                                                           |
| Migration drift between dialects                                      | The Phase 2 schema-parity test runs in CI on every change.                                                   |

## 5. Effort (rough)

| Phase              | Size                                    |
| ------------------ | --------------------------------------- |
| 1 Foundation       | S                                       |
| 2 Migrations       | M                                       |
| 3 Repos            | L (the bulk: ~1,300 lines of SQL repos) |
| 4 Auth             | S                                       |
| 5 Test matrix / CI | M                                       |
| 6 Data copy + docs | M                                       |
| 7 Cleanup          | S (optional)                            |

## 6. To confirm before starting

1. **Env vars:** `DATABASE_URL` selects Postgres, else `DATABASE_PATH`; the
   production guard refuses to start without one.
2. **Types:** portable schema (`INTEGER` booleans, `TEXT` JSON) rather than
   Postgres-native `boolean` / `jsonb`.
3. **Testing:** PGlite in the test suite, plus one CI job on a real Postgres
   container.
4. **Phase 7:** whether to remove the unused client DB code now or later.
