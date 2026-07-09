/**
 * Native driver over @capacitor-community/sqlite. Only ever imported on
 * iOS/Android (dynamic import in the factory keeps it off the web path).
 */
import type { DatabaseAdapter, Row, RunResult, SqlValue } from "../adapter";
import { runInTransaction } from "./transactions";

/**
 * The slice of SQLiteDBConnection the adapter needs — expressed as our own
 * interface so unit tests can inject a mock without the plugin.
 */
export interface CapacitorSqliteConnection {
  run(
    statement: string,
    values?: unknown[],
    transaction?: boolean,
  ): Promise<{ changes?: { changes?: number; lastId?: number } }>;
  query(statement: string, values?: unknown[]): Promise<{ values?: unknown[] }>;
  execute(statements: string, transaction?: boolean): Promise<unknown>;
  close(): Promise<unknown>;
}

class CapacitorSqliteAdapter implements DatabaseAdapter {
  private readonly depth = { value: 0 };

  constructor(
    private readonly conn: CapacitorSqliteConnection,
    private readonly onClose?: () => Promise<void>,
  ) {}

  async run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    // transaction=false: transactions are managed by this adapter.
    const res = await this.conn.run(sql, params, false);
    const changes = res.changes?.changes ?? 0;
    const lastId = res.changes?.lastId;
    return {
      changes,
      ...(lastId !== undefined && lastId > 0 ? { lastId } : {}),
    };
  }

  async query<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const res = await this.conn.query(sql, params);
    return (res.values ?? []) as T[];
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    return runInTransaction(
      this,
      async (sql) => {
        await this.conn.execute(sql, false);
      },
      this.depth,
      fn,
    );
  }

  async close(): Promise<void> {
    await this.conn.close();
    await this.onClose?.();
  }
}

/** Test seam: wrap any connection-shaped object. */
export function createCapacitorAdapterFromConnection(
  conn: CapacitorSqliteConnection,
  onClose?: () => Promise<void>,
): DatabaseAdapter {
  return new CapacitorSqliteAdapter(conn, onClose);
}

export interface CapacitorSqliteOptions {
  databaseName?: string;
}

/** Production path: opens (or creates) the named database via the plugin. */
export async function createCapacitorSqliteAdapter(
  options: CapacitorSqliteOptions = {},
): Promise<DatabaseAdapter> {
  const name = options.databaseName ?? "shotcoach";
  const { CapacitorSQLite, SQLiteConnection } =
    await import("@capacitor-community/sqlite");
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  const consistency = await sqlite.checkConnectionsConsistency();
  const alreadyConnected = await sqlite.isConnection(name, false);
  const conn =
    consistency.result && alreadyConnected.result
      ? await sqlite.retrieveConnection(name, false)
      : await sqlite.createConnection(name, false, "no-encryption", 1, false);

  await conn.open();
  await conn.execute("PRAGMA foreign_keys = ON", false);

  return new CapacitorSqliteAdapter(
    conn as unknown as CapacitorSqliteConnection,
    async () => {
      await sqlite.closeConnection(name, false);
    },
  );
}
