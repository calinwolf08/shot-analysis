import {
  parseJson,
  toBool,
  fromBool,
  type RepoContext,
} from "$lib/shared/db/repo-base";

/** Stored benchmark row; `data` is the full BenchmarkProfile JSON. */
export interface BenchmarkRow {
  id: string;
  name: string;
  version: number;
  isPlaceholder: boolean;
  data: unknown;
  createdAt: number;
}

export interface BenchmarkRepo {
  upsert(input: Omit<BenchmarkRow, "createdAt">): Promise<void>;
  get(id: string): Promise<BenchmarkRow | null>;
  list(): Promise<BenchmarkRow[]>;
}

interface DbRow {
  id: string;
  name: string;
  version: number;
  is_placeholder: number;
  data_json: string;
  created_at: number;
}

function toRow(r: DbRow): BenchmarkRow {
  return {
    id: r.id,
    name: r.name,
    version: r.version,
    isPlaceholder: toBool(r.is_placeholder),
    data: parseJson(r.data_json, `benchmarks.${r.id}`),
    createdAt: r.created_at,
  };
}

export function createBenchmarkRepo(ctx: RepoContext): BenchmarkRepo {
  const { db, clock } = ctx;
  return {
    async upsert(input) {
      await db.run(
        `INSERT INTO benchmarks (id, name, version, is_placeholder, data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           version = excluded.version,
           is_placeholder = excluded.is_placeholder,
           data_json = excluded.data_json`,
        [
          input.id,
          input.name,
          input.version,
          fromBool(input.isPlaceholder),
          JSON.stringify(input.data),
          clock.now(),
        ],
      );
    },

    async get(id) {
      const rows = await db.query<DbRow>(
        "SELECT * FROM benchmarks WHERE id = ?",
        [id],
      );
      return rows[0] ? toRow(rows[0]) : null;
    },

    async list() {
      const rows = await db.query<DbRow>(
        "SELECT * FROM benchmarks ORDER BY created_at",
      );
      return rows.map(toRow);
    },
  };
}
