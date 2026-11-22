import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import {
  resetDbSingletonForTests,
  useDatabaseForTests,
  getKysely,
} from "../db";
import type { AppDatabase } from "../database/kysely";
import {
  TEST_DATABASES,
  disposeTestDatabase,
} from "../database/__tests__/dialects";

/**
 * Sign-in runs on the server's shared connection — the same flows on SQLite
 * and Postgres — and accounts created before Phase 4 (when better-auth opened
 * the SQLite file itself) keep working.
 */
const dir = mkdtempSync(join(tmpdir(), "auth-dialects-"));
const SECRET = "auth-dialects-secret-000000000000000000";

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
});
afterAll(() => {
  delete process.env.AUTH_SECRET;
  delete process.env.DATABASE_PATH;
  resetDbSingletonForTests();
  rmSync(dir, { recursive: true, force: true });
});

/** SQLite on a real file (the server's own path), then each Postgres. */
const CASES: [string, (() => Promise<AppDatabase>) | null][] = [
  ["sqlite (file)", null],
  ...TEST_DATABASES.filter(([n]) => n.startsWith("postgres")),
];

describe.each(CASES)("auth on %s", (_name, makePg) => {
  let pg: AppDatabase | null = null;
  beforeEach(async () => {
    resetDbSingletonForTests();
    if (makePg) {
      delete process.env.DATABASE_PATH;
      pg = await makePg();
      useDatabaseForTests(pg);
    } else {
      process.env.DATABASE_PATH = join(dir, `auth-${Date.now()}.sqlite`);
    }
  });
  afterEach(async () => {
    if (pg) await disposeTestDatabase(pg);
    pg = null;
  });

  it("sign up → sign in again; duplicate email rejected in any case; reset revokes sessions", async () => {
    const { getAuth, ensureAuthMigrated, resetUrls } = await import("../auth");
    await getKysely();
    await ensureAuthMigrated();
    const auth = getAuth();
    const email = "Player.One@Example.com";

    const up = await auth.api.signUpEmail({
      body: { email, password: "password-123", name: "P" },
      asResponse: true,
    });
    expect(up.status).toBe(200);
    for (const e of [email, email.toLowerCase()]) {
      const dup = await auth.api.signUpEmail({
        body: { email: e, password: "password-999", name: "Q" },
        asResponse: true,
      });
      expect(dup.status).toBe(422);
    }
    for (const e of [email, email.toLowerCase()]) {
      const r = await auth.api.signInEmail({
        body: { email: e, password: "password-123" },
        asResponse: true,
      });
      expect(r.status).toBe(200);
    }
    const bad = await auth.api.signInEmail({
      body: { email, password: "wrong-pass-1" },
      asResponse: true,
    });
    expect(bad.status).toBe(401);

    // A session token works, then a password reset revokes it.
    const signedIn = await auth.api.signInEmail({
      body: { email, password: "password-123" },
      asResponse: true,
    });
    const token = signedIn.headers.get("set-auth-token")!;
    const authed = { authorization: `Bearer ${token}` };
    expect(
      (await auth.api.getSession({ headers: new Headers(authed) }))?.user.email,
    ).toBe(email.toLowerCase());
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "http://localhost/auth/reset" },
    });
    const url = resetUrls.get(email.toLowerCase())!;
    const resetToken = new URL(url).pathname.split("/").pop()!;
    await auth.api.resetPassword({
      body: { newPassword: "new-password-456", token: resetToken },
    });
    expect(
      await auth.api.getSession({ headers: new Headers(authed) }),
    ).toBeNull();
    const again = await auth.api.signInEmail({
      body: { email, password: "new-password-456" },
      asResponse: true,
    });
    expect(again.status).toBe(200);
  });
});

describe("existing SQLite accounts (created before Phase 4)", () => {
  it("still sign in after better-auth moves onto the shared connection", async () => {
    resetDbSingletonForTests();
    const path = join(dir, "legacy-auth.sqlite");
    // Old setup: better-auth opening the file itself.
    const legacyDb = new Database(path);
    const legacy = betterAuth({
      database: legacyDb,
      secret: SECRET,
      baseURL: "http://localhost:5173",
      basePath: "/api/auth",
      emailAndPassword: { enabled: true, minPasswordLength: 8 },
      plugins: [bearer()],
    });
    await (await getMigrations(legacy.options)).runMigrations();
    const r0 = await legacy.api.signUpEmail({
      body: { email: "old@example.com", password: "password-123", name: "Old" },
      asResponse: true,
    });
    expect(r0.status).toBe(200);
    legacyDb.close();

    // New setup on the same file.
    process.env.DATABASE_PATH = path;
    const { getAuth, ensureAuthMigrated } = await import("../auth");
    await getKysely();
    await ensureAuthMigrated();
    const r = await getAuth().api.signInEmail({
      body: { email: "old@example.com", password: "password-123" },
      asResponse: true,
    });
    expect(r.status).toBe(200);
    const dup = await getAuth().api.signUpEmail({
      body: { email: "old@example.com", password: "password-999", name: "X" },
      asResponse: true,
    });
    expect(dup.status).toBe(422);
  });
});
