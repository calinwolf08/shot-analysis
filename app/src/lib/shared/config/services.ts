/**
 * AppServices — the composition root. Built once at startup in
 * +layout.svelte, injected everywhere via Svelte context; tests build a
 * fake container with createTestServices() (see test-services.ts).
 *
 * Grows as features land (analysis, scoring, benchmarks, …).
 */
import type { DatabaseAdapter } from "../db";
import { createDatabase, migrate } from "../db";
import type { RepoContext } from "../db/repo-base";
import {
  createPlayerRepo,
  createRepRepo,
  createScoreRepo,
  createSessionRepo,
  createSettingsRepo,
  createShotRepo,
  createVideoRepo,
  type PlayerRepo,
  type RepRepo,
  type ScoreRepo,
  type SessionRepo,
  type SettingsRepo,
  type ShotRepo,
  type VideoRepo,
} from "../db/repos";
import type { Clock, IdGenerator } from "../utils";
import { systemClock, uuidIdGenerator } from "../utils";
import { getPlatform } from "./platform";

export interface AppRepos {
  player: PlayerRepo;
  video: VideoRepo;
  session: SessionRepo;
  shot: ShotRepo;
  score: ScoreRepo;
  rep: RepRepo;
  settings: SettingsRepo;
}

export interface AppServices extends RepoContext {
  db: DatabaseAdapter;
  clock: Clock;
  ids: IdGenerator;
  repos: AppRepos;
}

/** Builds the shared repo set from a RepoContext. */
export function createRepos(ctx: RepoContext): AppRepos {
  return {
    player: createPlayerRepo(ctx),
    video: createVideoRepo(ctx),
    session: createSessionRepo(ctx),
    shot: createShotRepo(ctx),
    score: createScoreRepo(ctx),
    rep: createRepRepo(ctx),
    settings: createSettingsRepo(ctx),
  };
}

/** Production composition: platform DB, migrations applied. */
export async function createAppServices(): Promise<AppServices> {
  const db = await createDatabase(getPlatform());
  await migrate(db);
  const ctx: RepoContext = {
    db,
    clock: systemClock,
    ids: uuidIdGenerator,
  };
  return {
    ...ctx,
    repos: createRepos(ctx),
  };
}
