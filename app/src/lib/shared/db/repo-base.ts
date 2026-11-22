import type { Kysely } from "kysely";
import type { DatabaseAdapter } from "./adapter";
import type { Database } from "./schema";
import type { Clock, IdGenerator } from "../utils";

/** Everything a repository needs; built once in AppServices. */
export interface RepoContext {
  /**
   * Raw-SQL adapter — only the legacy SQLite repos in ./repos (used by unit
   * tests) still read it; removed in database-abstraction-plan Phase 7.
   */
  db: DatabaseAdapter;
  /** Typed queries (SQLite or Postgres) — what the feature repos use. */
  kdb: Kysely<Database>;
  clock: Clock;
  ids: IdGenerator;
}

/** A raw-SQL `db` for contexts that have none (server on Postgres, browser). */
export function noRawSql(where: string): DatabaseAdapter {
  const fail = (): never => {
    throw new Error(`No raw-SQL database in ${where}; use kdb (Kysely)`);
  };
  return {
    run: async () => fail(),
    query: async () => fail(),
    transaction: async () => fail(),
    close: async () => {},
  };
}

/**
 * A `kdb` for contexts with no database (the browser: all data goes through
 * the API). Any use throws, and no Kysely runtime is bundled.
 */
export function noDatabase(where: string): Kysely<Database> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined; // not a thenable
        throw new Error(`No database in ${where} (kdb.${String(prop)})`);
      },
    },
  ) as Kysely<Database>;
}

/** SQLite has no boolean type — normalize 0/1. */
export function toBool(v: unknown): boolean {
  return v === 1 || v === true;
}

export function fromBool(v: boolean): number {
  return v ? 1 : 0;
}

/** Parse a JSON column, throwing a descriptive error on corruption. */
export function parseJson<T>(text: string, context: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Corrupted JSON in ${context}`);
  }
}
