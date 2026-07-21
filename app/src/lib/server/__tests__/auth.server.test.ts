import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// auth.ts captures the DB path at import time, so set the env *before* importing
// it. Use a temp file (not :memory:) so a second connection can inspect the
// tables better-auth created.
const dir = mkdtempSync(join(tmpdir(), "shotcoach-auth-test-"));
const dbPath = join(dir, "auth.sqlite");

beforeAll(() => {
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_SECRET = "test-secret-please-change-000000000000";
});

afterAll(() => {
  delete process.env.DATABASE_PATH;
  delete process.env.AUTH_SECRET;
  rmSync(dir, { recursive: true, force: true });
});

describe("server auth instance", () => {
  it("exposes a handler and api", async () => {
    const { getAuth } = await import("../auth");
    const auth = getAuth();
    expect(typeof auth.handler).toBe("function");
    expect(typeof auth.api.getSession).toBe("function");
  });

  it("creates the better-auth tables on migrate", async () => {
    const { ensureAuthMigrated } = await import("../auth");
    await ensureAuthMigrated();

    const inspect = new Database(dbPath);
    try {
      const rows = inspect
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[];
      const tables = new Set(rows.map((r) => r.name));
      for (const t of ["user", "session", "account", "verification"]) {
        expect(tables.has(t)).toBe(true);
      }
    } finally {
      inspect.close();
    }
  });

  it("is idempotent (second migrate is a no-op)", async () => {
    const { ensureAuthMigrated } = await import("../auth");
    await expect(ensureAuthMigrated()).resolves.toBeUndefined();
  });
});
