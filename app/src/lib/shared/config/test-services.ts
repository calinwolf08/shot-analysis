/**
 * Test composition root: in-memory better-sqlite3 + fakes.
 * Import ONLY from tests (better-sqlite3 is a devDependency).
 */
import type { AppServices } from "./services";
import { createDomainServices, createRepos } from "./services";
import {
  createBetterSqliteAdapterFor,
  openBetterSqlite,
} from "../db/drivers/better-sqlite3";
import { createSqliteKysely } from "$lib/server/database/kysely";
import { migrate } from "../db";
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
  // One in-memory SQLite connection behind both the raw-SQL adapter (legacy
  // shared repos) and Kysely (feature repos), so they see the same data.
  const conn = openBetterSqlite(":memory:");
  const db = overrides.db ?? createBetterSqliteAdapterFor(conn);
  await migrate(db);
  const ctx = {
    db,
    kdb: overrides.kdb ?? createSqliteKysely(conn),
    clock: overrides.clock ?? createFakeClock(1_000_000),
    ids: overrides.ids ?? createFakeIdGenerator(),
  };
  const repos = overrides.repos ?? createRepos(ctx);
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
