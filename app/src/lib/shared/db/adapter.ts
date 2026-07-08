/**
 * Portable SQLite abstraction. Three drivers implement this contract:
 * - better-sqlite3 (Node, tests)
 * - @capacitor-community/sqlite (iOS/Android)
 * - sql.js (web dev / e2e)
 */

export type SqlValue = string | number | null | Uint8Array;

export type Row = Record<string, SqlValue>;

export interface RunResult {
  /** Number of rows changed by the statement. */
  changes: number;
  /** rowid of the last inserted row, when meaningful. */
  lastId?: number;
}

export interface DatabaseAdapter {
  /** Execute a statement that does not return rows (INSERT/UPDATE/DDL…). */
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Execute a query and return all result rows. */
  query<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /**
   * Run `fn` inside a transaction. Rolls back if `fn` throws/rejects,
   * commits otherwise. Nested calls use savepoints.
   */
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  /** Close the underlying database. Further calls are invalid. */
  close(): Promise<void>;
}
