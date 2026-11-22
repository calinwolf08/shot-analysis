/**
 * Test composition root: in-memory SQLite (Kysely, migrated like the server)
 * + the server's own repos for one test user + fakes.
 * Import ONLY from tests.
 */
import type { AppServices } from "./services";
import { createDomainServices } from "./services";
import {
  createBetterSqliteAdapterFor,
  openBetterSqlite,
} from "../db/drivers/better-sqlite3";
import { createSqliteKysely } from "$lib/server/database/kysely";
import { migrateDatabase } from "$lib/server/database/migrate";
import { createServerRepos } from "$lib/server/repos";

/** The user every test-services repo is scoped to. */
export const TEST_USER_ID = "test-user";
import {
  createFakeClock,
  createFakeIdGenerator,
  type FakeClock,
  type FakeIdGenerator,
} from "../utils";

export interface TestServices extends AppServices {
  clock: FakeClock;
  ids: FakeIdGenerator;
}

import type { AnalysisService } from "$lib/features/analysis";

/** Tests that exercise analysis inject the replay service explicitly. */
const analysisStub: AnalysisService = {
  analyzeVideoFile: () => {
    throw new Error(
      "TestServices.analysis is a stub — inject a ReplayAnalysisService (see createNodeFixtureLoader in shared/testing)",
    );
  },
  extractPoses: () => {
    throw new Error("TestServices.analysis is a stub — inject one");
  },
  createLiveSession: () => {
    throw new Error("TestServices.analysis is a stub — inject one");
  },
};

export async function createTestServices(
  overrides: Partial<TestServices> = {},
): Promise<TestServices> {
  let kdb = overrides.kdb;
  if (!kdb) {
    const conn = openBetterSqlite(":memory:");
    kdb = createSqliteKysely(conn);
    await migrateDatabase(
      { kind: "sqlite", db: kdb },
      { legacy: createBetterSqliteAdapterFor(conn) },
    );
  }
  const ctx = {
    kdb,
    clock: overrides.clock ?? createFakeClock(1_000_000),
    ids: overrides.ids ?? createFakeIdGenerator(),
  };
  // The server's repos (Kysely), scoped to one test user.
  const repos =
    overrides.repos ?? createServerRepos(kdb, TEST_USER_ID, ctx.clock, ctx.ids);
  const analysis = overrides.analysis ?? analysisStub;
  const domain = createDomainServices(ctx, repos, analysis);
  return {
    ...ctx,
    repos,
    analysis,
    ...domain,
    ...overrides,
  };
}
