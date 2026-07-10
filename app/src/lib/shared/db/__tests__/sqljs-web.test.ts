import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryBytesStore } from "../bytes-store";
import { createSqlJsAdapter } from "../drivers/sqljs-web";
import { migrate } from "../migrations";
import { adapterContractTests } from "./adapter-contract";

const require = createRequire(import.meta.url);
const wasmPath = join(dirname(require.resolve("sql.js")), "sql-wasm.wasm");

adapterContractTests("sql.js", async () =>
  createSqlJsAdapter({ wasmUrl: wasmPath }),
);

describe("sql.js persistence via BytesStore", () => {
  it("persists writes and reloads them in a fresh adapter", async () => {
    const store = createMemoryBytesStore();
    const db1 = await createSqlJsAdapter({
      store,
      wasmUrl: wasmPath,
      persistDebounceMs: 1,
    });
    await migrate(db1);
    await db1.run("INSERT INTO settings (key, value) VALUES (?, ?)", [
      "hello",
      "world",
    ]);
    await db1.close(); // flushes pending persistence
    expect(store.saves).toBeGreaterThan(0);

    const db2 = await createSqlJsAdapter({ store, wasmUrl: wasmPath });
    const rows = await db2.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      ["hello"],
    );
    expect(rows[0]?.value).toBe("world");
    await db2.close();
  });

  it("does not persist mid-transaction, persists after commit", async () => {
    const store = createMemoryBytesStore();
    const db = await createSqlJsAdapter({
      store,
      wasmUrl: wasmPath,
      persistDebounceMs: 1,
    });
    await db.run("CREATE TABLE t (a TEXT)");
    await db.flush();
    const savesBefore = store.saves;
    await db.transaction(async (tx) => {
      await tx.run("INSERT INTO t (a) VALUES ('x')");
      // No flush inside: schedulePersist is suppressed at depth > 0.
      expect(store.saves).toBe(savesBefore);
    });
    await db.flush();
    expect(store.saves).toBeGreaterThan(savesBefore);
    await db.close();
  });
});
