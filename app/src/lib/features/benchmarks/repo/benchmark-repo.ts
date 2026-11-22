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
  const { kdb, clock } = ctx;
  return {
    async upsert(input) {
      await kdb
        .insertInto("benchmarks")
        .values({
          id: input.id,
          name: input.name,
          version: input.version,
          is_placeholder: fromBool(input.isPlaceholder),
          data_json: JSON.stringify(input.data),
          created_at: clock.now(),
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet((eb) => ({
            name: eb.ref("excluded.name"),
            version: eb.ref("excluded.version"),
            is_placeholder: eb.ref("excluded.is_placeholder"),
            data_json: eb.ref("excluded.data_json"),
          })),
        )
        .execute();
    },

    async get(id) {
      const row = await kdb
        .selectFrom("benchmarks")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toRow(row) : null;
    },

    async list() {
      const rows = await kdb
        .selectFrom("benchmarks")
        .selectAll()
        .orderBy("created_at")
        .execute();
      return rows.map(toRow);
    },
  };
}
