/**
 * HTTP wrapper: node:http + better-auth's node handler + CORS for the app
 * origins. With AUTH_E2E=1 a test-only endpoint exposes the latest
 * password-reset link so end-to-end tests can complete the reset flow
 * without a mailbox.
 *
 * Env:
 *   AUTH_PORT             port to listen on (default 5174)
 *   AUTH_DB               SQLite file path (default <workspace>/data/auth.sqlite)
 *   AUTH_SECRET           signing secret — REQUIRED outside dev
 *   AUTH_TRUSTED_ORIGINS  comma-separated app origins allowed via CORS
 *   AUTH_E2E              "1" enables the /__test/reset-url endpoint
 */
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import { createAuth, migrate } from "./auth.js";

const DEFAULT_ORIGINS = [
  "http://localhost:5173", // vite dev
  "http://localhost:4173", // vite preview / e2e
  "capacitor://localhost", // iOS shell
  "http://localhost", // Android shell
];

/**
 * Boots an auth server. `port: 0` picks an ephemeral port (tests).
 * @param {{ port?: number, dbPath?: string, secret?: string,
 *           trustedOrigins?: string[], e2e?: boolean }} [options]
 */
export async function createAuthServer(options = {}) {
  const port = options.port ?? Number(process.env.AUTH_PORT ?? 5174);
  const dbPath =
    options.dbPath ??
    process.env.AUTH_DB ??
    fileURLToPath(new URL("../data/auth.sqlite", import.meta.url));
  const secret =
    options.secret ??
    process.env.AUTH_SECRET ??
    "shotcoach-dev-only-secret-change-me";
  const trustedOrigins =
    options.trustedOrigins ??
    process.env.AUTH_TRUSTED_ORIGINS?.split(",") ??
    DEFAULT_ORIGINS;
  const e2e = options.e2e ?? process.env.AUTH_E2E === "1";

  mkdirSync(dirname(dbPath), { recursive: true });
  const { auth, resetUrls } = createAuth({
    dbPath,
    // Cookie/redirect base; with port 0 the real port is only known after
    // listen, so tests pass an explicit port instead.
    baseURL: `http://localhost:${port || 5174}`,
    trustedOrigins,
    secret,
  });
  await migrate(auth);
  const handler = toNodeHandler(auth);

  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && trustedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
      return;
    }
    if (e2e && req.url?.startsWith("/__test/reset-url")) {
      const email = new URL(req.url, "http://localhost").searchParams.get(
        "email",
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ url: (email && resetUrls.get(email)) ?? null }));
      return;
    }
    void handler(req, res);
  });

  await new Promise((resolve) => server.listen(port, resolve));
  const address = /** @type {import("node:net").AddressInfo} */ (
    server.address()
  );
  return { server, auth, port: address.port, dbPath };
}

// Started directly (npm start) — not imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { port, dbPath } = await createAuthServer();
  console.log(`[auth] listening on http://localhost:${port} (db: ${dbPath})`);
}
