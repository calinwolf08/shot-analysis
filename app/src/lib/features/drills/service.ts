import type { MetricName } from "$lib/features/benchmarks";
import type { IssueGroupId } from "$lib/features/diagnosis";
import type { RepoContext } from "$lib/shared/db/repo-base";
import drillsJson from "./data/drills.json";
import { createDrillRepo, type DrillRepo } from "./repo/drill-repo";
import { parseDrillFile, type Drill } from "./schema";

export interface DrillQuery {
  issueGroups?: IssueGroupId[];
  focusMetrics?: MetricName[];
  maxDifficulty?: 1 | 2 | 3;
}

export interface DrillService {
  /** Validates + upserts the shipped catalog when the version is newer. */
  seed(): Promise<void>;
  list(): Promise<Drill[]>;
  get(id: string): Promise<Drill | null>;
  getBySlug(slug: string): Promise<Drill | null>;
  /**
   * Drills matching a focus, best matches first (focus-metric overlap,
   * then issue-group overlap, then easier first).
   */
  findForFocus(query: DrillQuery): Promise<Drill[]>;
}

export interface DrillServiceDeps {
  repo?: DrillRepo;
  /** Override the shipped catalog (tests). */
  file?: unknown;
}

export function createDrillService(
  ctx: RepoContext,
  deps: DrillServiceDeps = {},
): DrillService {
  const repo = deps.repo ?? createDrillRepo(ctx);
  const file = parseDrillFile(deps.file ?? drillsJson);

  return {
    async seed() {
      for (const drill of file.drills) {
        const existing = await repo.get(drill.id);
        if (existing && existing.version >= file.version) continue;
        await repo.upsert({
          id: drill.id,
          slug: drill.slug,
          version: file.version,
          isPlaceholder: drill.isPlaceholder,
          data: drill,
        });
      }
    },

    async list() {
      const rows = await repo.list();
      return rows.map((r) => parseDrill(r.data));
    },

    async get(id) {
      const row = await repo.get(id);
      return row ? parseDrill(row.data) : null;
    },

    async getBySlug(slug) {
      const row = await repo.getBySlug(slug);
      return row ? parseDrill(row.data) : null;
    },

    async findForFocus(query) {
      const rows = await repo.list();
      const drills = rows.map((r) => parseDrill(r.data));
      const max = query.maxDifficulty ?? 3;
      const wantGroups = new Set(query.issueGroups ?? []);
      const wantMetrics = new Set(query.focusMetrics ?? []);

      return drills
        .filter((d) => d.difficulty <= max)
        .map((d) => ({
          drill: d,
          metricOverlap: d.focusMetrics.filter((m) => wantMetrics.has(m))
            .length,
          groupOverlap: d.issueGroups.filter((g) => wantGroups.has(g)).length,
        }))
        .filter(
          (x) =>
            (wantGroups.size === 0 && wantMetrics.size === 0) ||
            x.metricOverlap > 0 ||
            x.groupOverlap > 0,
        )
        .sort(
          (a, b) =>
            b.metricOverlap - a.metricOverlap ||
            b.groupOverlap - a.groupOverlap ||
            a.drill.difficulty - b.drill.difficulty ||
            a.drill.slug.localeCompare(b.drill.slug),
        )
        .map((x) => x.drill);
    },
  };
}

function parseDrill(data: unknown): Drill {
  // Rows are written from validated content; re-validate on read to catch
  // corruption early with a typed error.
  const parsed = parseDrillFile({ version: 1, drills: [data] });
  return parsed.drills[0]!;
}
