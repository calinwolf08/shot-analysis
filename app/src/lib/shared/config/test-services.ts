/**
 * Test composition root: in-memory better-sqlite3 + fakes.
 * Import ONLY from tests (better-sqlite3 is a devDependency).
 */
import type { AppServices } from "./services";
import { createDomainServices, createRepos } from "./services";
import { createBetterSqliteAdapter } from "../db/drivers/better-sqlite3";
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
  createLiveSession: () => {
    throw new Error("TestServices.analysis is a stub — inject one");
  },
};

export async function createTestServices(
  overrides: Partial<TestServices> = {},
): Promise<TestServices> {
  const db = overrides.db ?? createBetterSqliteAdapter();
  await migrate(db);
  const ctx = {
    db,
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
