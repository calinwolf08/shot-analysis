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
  const { db } = ctx;
  return {
    async upsert(input) {
      await db.run(
        `INSERT INTO drills (id, slug, version, is_placeholder, data_json)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug,
           version = excluded.version,
           is_placeholder = excluded.is_placeholder,
           data_json = excluded.data_json`,
        [
          input.id,
          input.slug,
          input.version,
          fromBool(input.isPlaceholder),
          JSON.stringify(input.data),
        ],
      );
    },

    async get(id) {
      const rows = await db.query<DbRow>("SELECT * FROM drills WHERE id = ?", [
        id,
      ]);
      return rows[0] ? toRow(rows[0]) : null;
    },

    async getBySlug(slug) {
      const rows = await db.query<DbRow>(
        "SELECT * FROM drills WHERE slug = ?",
        [slug],
      );
      return rows[0] ? toRow(rows[0]) : null;
    },

    async list() {
      const rows = await db.query<DbRow>("SELECT * FROM drills ORDER BY slug");
      return rows.map(toRow);
    },
  };
}
