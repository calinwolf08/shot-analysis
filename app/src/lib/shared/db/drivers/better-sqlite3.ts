/**
 * Node driver over better-sqlite3 (synchronous under the hood).
 * Test/dev only — never bundled into the app build (dynamic import in the
 * factory keeps it out of the client graph).
 */
import Database from "better-sqlite3";
import type { DatabaseAdapter, Row, RunResult, SqlValue } from "../adapter";

class BetterSqliteAdapter implements DatabaseAdapter {
  private depth = 0;

  constructor(private readonly db: Database.Database) {}

  async run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return {
      changes: info.changes,
      lastId: Number(info.lastInsertRowid),
    };
  }

  async query<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Nested transactions become savepoints so inner failures can roll
    // back without killing the outer transaction.
    const savepoint = `sp_${this.depth}`;
    const begin = this.depth === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`;
    const commit =
      this.depth === 0 ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`;
    const rollback =
      this.depth === 0
        ? "ROLLBACK"
        : `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`;

    this.db.exec(begin);
    this.depth += 1;
    try {
      const result = await fn(this);
      this.depth -= 1;
      this.db.exec(commit);
      return result;
    } catch (err) {
      this.depth -= 1;
      this.db.exec(rollback);
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export interface BetterSqliteOptions {
  /** File path, or ":memory:" (default) for an in-memory database. */
  path?: string;
}

export function createBetterSqliteAdapter(
  options: BetterSqliteOptions = {},
): DatabaseAdapter {
  const db = new Database(options.path ?? ":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return new BetterSqliteAdapter(db);
}
