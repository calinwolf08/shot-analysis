import type { RepoContext } from "$lib/shared/db/repo-base";
import type { SettingsRepo } from "$lib/shared/db/repos";
import elitePlaceholderV1 from "./data/elite-placeholder-v1.json";
import { createBenchmarkRepo, type BenchmarkRepo } from "./repo/benchmark-repo";
import { parseBenchmarkProfile, type BenchmarkProfile } from "./schema";

export const DEFAULT_BENCHMARK_ID = "elite-placeholder-v1";

/** Benchmarks shipped with the app, seeded into the DB on boot. */
export function builtInBenchmarks(): BenchmarkProfile[] {
  return [parseBenchmarkProfile(elitePlaceholderV1, DEFAULT_BENCHMARK_ID)];
}

export interface BenchmarkService {
  /** Validates + upserts built-ins whose version is newer than stored. */
  seed(): Promise<void>;
  /** The active benchmark: settings override, else the default. */
  getActive(): Promise<BenchmarkProfile>;
  list(): Promise<BenchmarkProfile[]>;
  get(id: string): Promise<BenchmarkProfile | null>;
}

export interface BenchmarkServiceDeps {
  repo?: BenchmarkRepo;
  settings: SettingsRepo;
  /** Override the shipped set (tests). */
  builtIns?: BenchmarkProfile[];
}

export function createBenchmarkService(
  ctx: RepoContext,
  deps: BenchmarkServiceDeps,
): BenchmarkService {
  const repo = deps.repo ?? createBenchmarkRepo(ctx);
  const builtIns = deps.builtIns ?? builtInBenchmarks();

  async function loadValidated(id: string): Promise<BenchmarkProfile | null> {
    const row = await repo.get(id);
    if (!row) return null;
    return parseBenchmarkProfile(row.data, id);
  }

  return {
    async seed() {
      for (const profile of builtIns) {
        const existing = await repo.get(profile.id);
        if (existing && existing.version >= profile.version) continue;
        await repo.upsert({
          id: profile.id,
          name: profile.name,
          version: profile.version,
          isPlaceholder: profile.isPlaceholder,
          data: profile,
        });
      }
    },

    async getActive() {
      const activeId =
        (await deps.settings.get("activeBenchmarkId")) ?? DEFAULT_BENCHMARK_ID;
      const active =
        (await loadValidated(activeId)) ??
        (await loadValidated(DEFAULT_BENCHMARK_ID));
      if (!active) {
        throw new Error(
          "No active benchmark available — was BenchmarkService.seed() run at boot?",
        );
      }
      return active;
    },

    async list() {
      const rows = await repo.list();
      return rows.map((row) => parseBenchmarkProfile(row.data, row.id));
    },

    get: loadValidated,
  };
}
