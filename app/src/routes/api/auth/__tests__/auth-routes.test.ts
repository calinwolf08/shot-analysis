import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the real better-auth handler (what /api/auth/[...all] delegates to)
// with the bearer flow. Set the DB path before importing the auth module.
const dir = mkdtempSync(join(tmpdir(), "shotcoach-auth-routes-"));
const ORIGIN = "http://localhost:5173";
const EMAIL = "routes@example.com";
const PASSWORD = "correct-horse-9";

type Auth = typeof import("../../../../lib/server/auth");
let mod: Auth;

beforeAll(async () => {
  process.env.DATABASE_PATH = join(dir, "auth.sqlite");
  process.env.AUTH_SECRET = "test-secret-please-change-000000000000";
  process.env.AUTH_BASE_URL = ORIGIN;
  mod = await import("../../../../lib/server/auth");
  await mod.ensureAuthMigrated();
});

afterAll(() => {
  delete process.env.DATABASE_PATH;
  delete process.env.AUTH_SECRET;
  delete process.env.AUTH_BASE_URL;
  rmSync(dir, { recursive: true, force: true });
});

function post(path: string, body: unknown, token?: string) {
  return mod.getAuth().handler(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function get(path: string, token?: string) {
  return mod.getAuth().handler(
    new Request(`${ORIGIN}${path}`, {
      headers: {
        origin: ORIGIN,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }),
  );
}

describe("/api/auth (bearer)", () => {
  let token = "";

  it("sign-up creates a user and returns a bearer token", async () => {
    const res = await post("/api/auth/sign-up/email", {
      name: "Routes",
      email: EMAIL,
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(EMAIL);
    token = res.headers.get("set-auth-token") ?? "";
    expect(token).not.toBe("");
  });

  it("get-session resolves the user from the bearer token", async () => {
    const res = await get("/api/auth/get-session", token);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(EMAIL);
  });

  it("get-session without a token is anonymous", async () => {
    const res = await get("/api/auth/get-session");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data?.user ?? null).toBeNull();
  });

  it("sign-in rejects a wrong password", async () => {
    const res = await post("/api/auth/sign-in/email", {
      email: EMAIL,
      password: "wrong-password-1",
    });
    expect(res.status).toBe(401);
  });

  it("sign-in issues a fresh bearer token that resolves the user", async () => {
    const res = await post("/api/auth/sign-in/email", {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
    const fresh = res.headers.get("set-auth-token") ?? "";
    expect(fresh).not.toBe("");

    const session = await get("/api/auth/get-session", fresh);
    const data = await session.json();
    expect(data.user.email).toBe(EMAIL);
  });

  it("password reset records a link (dev capture hook)", async () => {
    const res = await post("/api/auth/request-password-reset", {
      email: EMAIL,
      redirectTo: `${ORIGIN}/auth/reset-password`,
    });
    expect(res.status).toBe(200);
    const url = mod.resetUrls.get(EMAIL);
    expect(url).toBeTruthy();
    expect(url).toContain("/reset-password/");
  });
});
