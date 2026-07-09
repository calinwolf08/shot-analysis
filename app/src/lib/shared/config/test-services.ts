/**
 * Test composition root: in-memory better-sqlite3 + fakes.
 * Import ONLY from tests (better-sqlite3 is a devDependency).
 */
import type { AppServices } from "./services";
import { createRepos } from "./services";
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
  return {
    ...ctx,
    repos: overrides.repos ?? createRepos(ctx),
    ...overrides,
  };
}
