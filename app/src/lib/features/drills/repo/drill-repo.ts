import {
  fromBool,
  parseJson,
  toBool,
  type RepoContext,
} from "$lib/shared/db/repo-base";

/** Stored drill row; `data` is the full Drill JSON (schema in step 16). */
export interface DrillRow {
  id: string;
  slug: string;
  version: number;
  isPlaceholder: boolean;
  data: unknown;
}

export interface DrillRepo {
  upsert(input: DrillRow): Promise<void>;
  get(id: string): Promise<DrillRow | null>;
  getBySlug(slug: string): Promise<DrillRow | null>;
  list(): Promise<DrillRow[]>;
}

interface DbRow {
  id: string;
  slug: string;
  version: number;
  is_placeholder: number;
  data_json: string;
}

function toRow(r: DbRow): DrillRow {
  return {
    id: r.id,
    slug: r.slug,
    version: r.version,
    isPlaceholder: toBool(r.is_placeholder),
    data: parseJson(r.data_json, `drills.${r.id}`),
  };
}

export function createDrillRepo(ctx: RepoContext): DrillRepo {
  const { kdb } = ctx;
  return {
    async upsert(input) {
      await kdb
        .insertInto("drills")
        .values({
          id: input.id,
          slug: input.slug,
          version: input.version,
          is_placeholder: fromBool(input.isPlaceholder),
          data_json: JSON.stringify(input.data),
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet((eb) => ({
            slug: eb.ref("excluded.slug"),
            version: eb.ref("excluded.version"),
            is_placeholder: eb.ref("excluded.is_placeholder"),
            data_json: eb.ref("excluded.data_json"),
          })),
        )
        .execute();
    },

    async get(id) {
      const row = await kdb
        .selectFrom("drills")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toRow(row) : null;
    },

    async getBySlug(slug) {
      const row = await kdb
        .selectFrom("drills")
        .selectAll()
        .where("slug", "=", slug)
        .executeTakeFirst();
      return row ? toRow(row) : null;
    },

    async list() {
      const rows = await kdb
        .selectFrom("drills")
        .selectAll()
        .orderBy("slug")
        .execute();
      return rows.map(toRow);
    },
  };
}
