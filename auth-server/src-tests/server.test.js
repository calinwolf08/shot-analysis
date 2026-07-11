/**
 * HTTP smoke test for the auth server: sign-up, sign-in (right and wrong
 * password), session lookup via cookie, and the e2e reset-link endpoint.
 * Runs against an ephemeral port and a temp SQLite file.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createAuthServer } from "../src/server.js";

const tmp = mkdtempSync(join(tmpdir(), "shotcoach-auth-"));
let base = "";
let server;

const EMAIL = "smoke@example.com";
const PASSWORD = "correct-horse-9";

before(async () => {
  const started = await createAuthServer({
    port: 0,
    dbPath: join(tmp, "auth.sqlite"),
    trustedOrigins: ["http://localhost:9999"],
    e2e: true,
  });
  server = started.server;
  base = `http://localhost:${started.port}`;
});

after(() => {
  server?.close();
  rmSync(tmp, { recursive: true, force: true });
});

/** POST JSON to an auth endpoint from the trusted app origin. */
function post(path, body, cookie = "") {
  return fetch(base + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:9999",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("health endpoint responds", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
});

test("sign-up creates a user and a session", async () => {
  const res = await post("/api/auth/sign-up/email", {
    name: "Smoke",
    email: EMAIL,
    password: PASSWORD,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.email, EMAIL);
  assert.ok(res.headers.get("set-cookie")?.includes("better-auth"));
});

test("sign-in rejects a wrong password", async () => {
  const res = await post("/api/auth/sign-in/email", {
    email: EMAIL,
    password: "wrong-password-1",
  });
  assert.equal(res.status, 401);
});

test("sign-in issues a session cookie that resolves the user", async () => {
  const res = await post("/api/auth/sign-in/email", {
    email: EMAIL,
    password: PASSWORD,
  });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie").split(";")[0];

  const session = await fetch(`${base}/api/auth/get-session`, {
    headers: { origin: "http://localhost:9999", cookie },
  });
  assert.equal(session.status, 200);
  const data = await session.json();
  assert.equal(data.user.email, EMAIL);
});

test("password reset link is captured for e2e", async () => {
  const res = await post("/api/auth/request-password-reset", {
    email: EMAIL,
    redirectTo: "http://localhost:9999/auth/reset-password",
  });
  assert.equal(res.status, 200);

  const lookup = await fetch(
    `${base}/__test/reset-url?email=${encodeURIComponent(EMAIL)}`,
  );
  const { url } = await lookup.json();
  assert.ok(url, "reset URL should be recorded");
  // Shape: <base>/api/auth/reset-password/<token>?callbackURL=<app page>
  assert.ok(url.includes("/reset-password/"), `unexpected reset url: ${url}`);

  // Following the link verifies the token and redirects to the app's
  // reset page with ?token=. (The recorded URL uses the configured
  // baseURL port; the test server listens on an ephemeral one.)
  const reachable = new URL(url);
  reachable.host = new URL(base).host;
  const follow = await fetch(reachable, { redirect: "manual" });
  assert.equal(follow.status, 302);
  const location = follow.headers.get("location");
  assert.ok(
    location.startsWith("http://localhost:9999/auth/reset-password"),
    `unexpected redirect: ${location}`,
  );
  assert.ok(location.includes("token="), `redirect lacks token: ${location}`);
});
