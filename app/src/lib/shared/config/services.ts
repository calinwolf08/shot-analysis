/**
 * AppServices — the composition root. Built once at startup in
 * +layout.svelte, injected everywhere via Svelte context; tests build a
 * fake container with createTestServices() (see test-services.ts).
 *
 * Grows as features land (analysis, scoring, benchmarks, …).
 */
import type { DatabaseAdapter } from "../db";
import { createDatabase, migrate } from "../db";
import type { Clock, IdGenerator } from "../utils";
import { systemClock, uuidIdGenerator } from "../utils";
import { getPlatform } from "./platform";

export interface AppServices {
  db: DatabaseAdapter;
  clock: Clock;
  ids: IdGenerator;
}

/** Production composition: platform DB, migrations applied. */
export async function createAppServices(): Promise<AppServices> {
  const db = await createDatabase(getPlatform());
  await migrate(db);
  return {
    db,
    clock: systemClock,
    ids: uuidIdGenerator,
  };
}
