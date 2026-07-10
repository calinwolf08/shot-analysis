import { describe, expect, it, vi } from "vitest";
import {
  createCapacitorAdapterFromConnection,
  type CapacitorSqliteConnection,
} from "../drivers/capacitor-sqlite";

function makeMockConnection() {
  const executed: string[] = [];
  const conn: CapacitorSqliteConnection = {
    run: vi.fn(async () => ({ changes: { changes: 1, lastId: 7 } })),
    query: vi.fn(async () => ({ values: [{ id: "a" }] })),
    execute: vi.fn(async (sql: string) => {
      executed.push(sql);
      return undefined;
    }),
    close: vi.fn(async () => undefined),
  };
  return { conn, executed };
}

describe("CapacitorSqliteAdapter (mocked connection)", () => {
  it("maps run results (changes + lastId) and disables plugin transactions", async () => {
    const { conn } = makeMockConnection();
    const db = createCapacitorAdapterFromConnection(conn);
    const res = await db.run("INSERT INTO t VALUES (?)", ["x"]);
    expect(res).toEqual({ changes: 1, lastId: 7 });
    expect(conn.run).toHaveBeenCalledWith(
      "INSERT INTO t VALUES (?)",
      ["x"],
      false,
    );
  });

  it("maps query values", async () => {
    const { conn } = makeMockConnection();
    const db = createCapacitorAdapterFromConnection(conn);
    const rows = await db.query("SELECT * FROM t");
    expect(rows).toEqual([{ id: "a" }]);
  });

  it("wraps transactions in BEGIN/COMMIT via execute", async () => {
    const { conn, executed } = makeMockConnection();
    const db = createCapacitorAdapterFromConnection(conn);
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO t VALUES (1)");
    });
    expect(executed).toEqual(["BEGIN", "COMMIT"]);
  });

  it("rolls back on error", async () => {
    const { conn, executed } = makeMockConnection();
    const db = createCapacitorAdapterFromConnection(conn);
    await expect(
      db.transaction(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(executed).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("closes the connection and invokes onClose", async () => {
    const { conn } = makeMockConnection();
    const onClose = vi.fn(async () => undefined);
    const db = createCapacitorAdapterFromConnection(conn, onClose);
    await db.close();
    expect(conn.close).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
