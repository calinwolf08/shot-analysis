/**
 * The single better-auth instance for the app server.
 *
 * Email + password, with the **bearer plugin** so every client (web and
 * native) authenticates the same way — an `Authorization: Bearer <token>`
 * header, no cookies (see docs/server-migration-plan.md). It runs on the SAME
 * Kysely connection as the app repos — SQLite or Postgres, whichever the
 * server is configured for (docs/database-abstraction-plan.md Phase 4).
 * better-auth owns the `user`, `session`, `account`, `verification` tables;
 * the app owns the rest.
 *
 * Server-only: never import from client code.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { getConnection } from "./db";
import type { AppDatabase } from "./database/kysely";

/** Signing secret. Required outside dev; a fixed dev fallback keeps `npm run dev` frictionless. */
function authSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "shotcoach-dev-only-secret-change-me"
  );
}

function baseURL(): string {
  return (
    process.env.AUTH_BASE_URL ?? process.env.ORIGIN ?? "http://localhost:5173"
  );
}

function trustedOrigins(): string[] {
  const fromEnv = process.env.AUTH_TRUSTED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    fromEnv ?? [
      "http://localhost:5173", // vite dev
      "http://localhost:4173", // preview / e2e
      "capacitor://localhost", // iOS shell
      "http://localhost", // Android shell
    ]
  );
}

/** The resolved trusted-origin allow-list (also used for CORS in hooks.server). */
export const TRUSTED_ORIGINS: readonly string[] = trustedOrigins();

/**
 * Dev/test "email transport": remembers the latest reset link per email and
 * logs it. Production replaces this with a real mailer. Exported so tests and
 * the e2e reset endpoint can read the captured link.
 */
export const resetUrls = new Map<string, string>();

function createAuth(conn: AppDatabase) {
  return betterAuth({
    // The server's shared Kysely instance (one connection / pool).
    database: { db: conn.db, type: conn.kind },
    baseURL: baseURL(),
    basePath: "/api/auth",
    secret: authSecret(),
    trustedOrigins: trustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        // TODO(mailer): wire a real transport in production.
        console.log(`[auth] password reset for ${user.email}: ${url}`);
        resetUrls.set(user.email, url);
      },
      // Changing the password signs out every other session.
      revokeSessionsOnPasswordReset: true,
    },
    plugins: [bearer()],
  });
}

/** The concrete better-auth instance type (used for App.Locals typing). */
export type Auth = ReturnType<typeof createAuth>;

// Lazily constructed so importing this module (e.g. during the SvelteKit build
// analyse step) never opens the database — the handle is created on first use.
let _auth: Auth | null = null;
/** The connection `_auth` was built on (tests swap databases). */
let _authConn: AppDatabase | null = null;
let migrated: Promise<void> | null = null;

/** The process-wide better-auth instance (created on first call). */
export function getAuth(): Auth {
  const conn = getConnection();
  if (!_auth || _authConn !== conn) {
    _auth = createAuth(conn);
    _authConn = conn;
    migrated = null;
  }
  return _auth;
}

/** Creates/updates better-auth's tables on the shared connection (once per process). */
export function ensureAuthMigrated(): Promise<void> {
  const auth = getAuth(); // (re)builds for the current connection first
  if (!migrated) {
    migrated = getMigrations(auth.options)
      .then(({ runMigrations }) => runMigrations())
      .catch((err) => {
        migrated = null;
        throw err;
      });
  }
  return migrated;
}
