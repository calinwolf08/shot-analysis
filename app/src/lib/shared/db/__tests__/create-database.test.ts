import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorFactory = vi.fn(async (_opts?: unknown) => ({
  driver: "capacitor",
}));
const sqlJsFactory = vi.fn(async (_opts?: unknown) => ({ driver: "sqljs" }));

vi.mock("../drivers/capacitor-sqlite", () => ({
  createCapacitorSqliteAdapter: capacitorFactory,
}));
vi.mock("../drivers/sqljs-web", () => ({
  createSqlJsAdapter: sqlJsFactory,
}));
vi.mock("../bytes-store", () => ({
  createIdbBytesStore: () => ({ load: async () => null, save: async () => {} }),
}));

import { createDatabase } from "../create-database";

describe("createDatabase platform selection", () => {
  beforeEach(() => {
    capacitorFactory.mockClear();
    sqlJsFactory.mockClear();
  });

  it("picks the Capacitor driver on ios", async () => {
    const db = await createDatabase("ios");
    expect(capacitorFactory).toHaveBeenCalledOnce();
    expect(sqlJsFactory).not.toHaveBeenCalled();
    expect(db).toEqual({ driver: "capacitor" });
  });

  it("picks the Capacitor driver on android", async () => {
    await createDatabase("android");
    expect(capacitorFactory).toHaveBeenCalledOnce();
  });

  it("picks the sql.js driver on web with idb store + served wasm", async () => {
    const db = await createDatabase("web");
    expect(sqlJsFactory).toHaveBeenCalledOnce();
    const opts = sqlJsFactory.mock.calls[0]?.[0] as
      | { wasmUrl?: string; store?: unknown }
      | undefined;
    expect(opts?.wasmUrl).toBe("/sqljs/sql-wasm.wasm");
    expect(opts?.store).toBeDefined();
    expect(db).toEqual({ driver: "sqljs" });
  });
});
