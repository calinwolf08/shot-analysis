/**
 * Web driver over sql.js (SQLite compiled to WASM). The whole database lives
 * in memory; after any write transaction/statement the image is persisted to
 * the injected BytesStore (IndexedDB in the browser — see bytes-store.ts).
 *
 * Persistence choice (documented per plan step 5): manual image export to
 * IndexedDB rather than jeep-sqlite. It keeps the web path dependency-free,
 * uses the exact same sql.js engine, and is deterministic in e2e.
 */
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { DatabaseAdapter, Row, RunResult, SqlValue } from "../adapter";
import type { BytesStore } from "../bytes-store";
import { runInTransaction } from "./transactions";

export interface SqlJsAdapterOptions {
  /** Where to load/persist the database image. Omit for ephemeral in-memory. */
  store?: BytesStore;
  /** URL or filesystem path of sql-wasm.wasm. */
  wasmUrl?: string;
  /** Milliseconds to debounce persistence after writes. Default 150. */
  persistDebounceMs?: number;
}

class SqlJsAdapter implements DatabaseAdapter {
  private readonly depth = { value: 0 };
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingPersist: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: Database,
    private readonly store: BytesStore | undefined,
    private readonly debounceMs: number,
  ) {}

  async run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    this.db.run(sql, params as never[]);
    const changes = this.db.getRowsModified();
    const lastIdRes = this.db.exec("SELECT last_insert_rowid() AS id");
    const lastId = Number(lastIdRes[0]?.values[0]?.[0] ?? 0);
    this.schedulePersist();
    return { changes, ...(lastId > 0 ? { lastId } : {}) };
  }

  async query<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never[]);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const result = await runInTransaction(
      this,
      (sql) => {
        this.db.run(sql);
      },
      this.depth,
      fn,
    );
    this.schedulePersist();
    return result;
  }

  async close(): Promise<void> {
    if (this.persistTimer !== undefined) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
      await this.persistNow();
    }
    await this.pendingPersist;
    this.db.close();
  }

  /** Flush any pending persistence immediately (used on close + tests). */
  async flush(): Promise<void> {
    if (this.persistTimer !== undefined) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
      await this.persistNow();
    }
    await this.pendingPersist;
  }

  private schedulePersist(): void {
    if (!this.store || this.depth.value > 0) return;
    if (this.persistTimer !== undefined) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      void this.persistNow();
    }, this.debounceMs);
  }

  private async persistNow(): Promise<void> {
    if (!this.store) return;
    const bytes = this.db.export();
    const prev = this.pendingPersist;
    this.pendingPersist = (async () => {
      await prev.catch(() => undefined);
      await this.store!.save(bytes);
    })();
    await this.pendingPersist;
  }
}

let sqlJsModule: Promise<SqlJsStatic> | undefined;

function loadSqlJs(wasmUrl?: string): Promise<SqlJsStatic> {
  sqlJsModule ??= initSqlJs(
    wasmUrl ? { locateFile: () => wasmUrl } : undefined,
  );
  return sqlJsModule;
}

export interface SqlJsFlushable extends DatabaseAdapter {
  flush(): Promise<void>;
}

export async function createSqlJsAdapter(
  options: SqlJsAdapterOptions = {},
): Promise<SqlJsFlushable> {
  const SQL = await loadSqlJs(options.wasmUrl);
  const existing = (await options.store?.load()) ?? null;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  return new SqlJsAdapter(db, options.store, options.persistDebounceMs ?? 150);
}
