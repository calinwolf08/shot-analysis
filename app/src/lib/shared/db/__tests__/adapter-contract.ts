/**
 * Shared adapter contract: every DatabaseAdapter driver must pass these.
 * Import and invoke from a driver's own test file.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { DatabaseAdapter } from "../adapter";

export function adapterContractTests(
  driverName: string,
  makeDb: () => Promise<DatabaseAdapter>,
): void {
  describe(`DatabaseAdapter contract: ${driverName}`, () => {
    let db: DatabaseAdapter | undefined;

    afterEach(async () => {
      await db?.close();
      db = undefined;
    });

    async function fresh(): Promise<DatabaseAdapter> {
      db = await makeDb();
      await db.run(
        "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n REAL)",
      );
      return db;
    }

    it("runs inserts and reports changes + lastId", async () => {
      const d = await fresh();
      const res = await d.run("INSERT INTO t (name, n) VALUES (?, ?)", [
        "a",
        1.5,
      ]);
      expect(res.changes).toBe(1);
      expect(res.lastId).toBe(1);
    });

    it("queries rows with typed values", async () => {
      const d = await fresh();
      await d.run("INSERT INTO t (name, n) VALUES (?, ?)", ["a", 1.5]);
      await d.run("INSERT INTO t (name, n) VALUES (?, ?)", [null, 2]);
      const rows = await d.query<{
        id: number;
        name: string | null;
        n: number;
      }>("SELECT id, name, n FROM t ORDER BY id");
      expect(rows).toEqual([
        { id: 1, name: "a", n: 1.5 },
        { id: 2, name: null, n: 2 },
      ]);
    });

    it("updates and deletes report changes", async () => {
      const d = await fresh();
      await d.run("INSERT INTO t (name) VALUES ('a'), ('b')");
      const upd = await d.run("UPDATE t SET n = 9 WHERE name = ?", ["a"]);
      expect(upd.changes).toBe(1);
      const del = await d.run("DELETE FROM t");
      expect(del.changes).toBe(2);
    });

    it("commits a successful transaction", async () => {
      const d = await fresh();
      await d.transaction(async (tx) => {
        await tx.run("INSERT INTO t (name) VALUES ('a')");
        await tx.run("INSERT INTO t (name) VALUES ('b')");
      });
      const rows = await d.query("SELECT * FROM t");
      expect(rows).toHaveLength(2);
    });

    it("rolls back when the transaction body throws", async () => {
      const d = await fresh();
      await expect(
        d.transaction(async (tx) => {
          await tx.run("INSERT INTO t (name) VALUES ('a')");
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      const rows = await d.query("SELECT * FROM t");
      expect(rows).toHaveLength(0);
    });

    it("returns the transaction body's value", async () => {
      const d = await fresh();
      const out = await d.transaction(async (tx) => {
        const res = await tx.run("INSERT INTO t (name) VALUES ('a')");
        return res.lastId;
      });
      expect(out).toBe(1);
    });

    it("supports nested transactions via savepoints (inner rollback only)", async () => {
      const d = await fresh();
      await d.transaction(async (tx) => {
        await tx.run("INSERT INTO t (name) VALUES ('outer')");
        await expect(
          tx.transaction(async (inner) => {
            await inner.run("INSERT INTO t (name) VALUES ('inner')");
            throw new Error("inner boom");
          }),
        ).rejects.toThrow("inner boom");
      });
      const rows = await d.query<{ name: string }>("SELECT name FROM t");
      expect(rows.map((r) => r.name)).toEqual(["outer"]);
    });

    it("binds text, integer, real, null and blob parameters", async () => {
      const d = await fresh();
      await d.run("CREATE TABLE b (v BLOB)");
      const blob = new Uint8Array([1, 2, 255]);
      await d.run("INSERT INTO b (v) VALUES (?)", [blob]);
      const rows = await d.query<{ v: Uint8Array }>("SELECT v FROM b");
      expect(rows).toHaveLength(1);
      expect(Array.from(rows[0]!.v)).toEqual([1, 2, 255]);
    });
  });
}
