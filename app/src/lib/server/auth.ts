/**
 * The single better-auth instance for the app server.
 *
 * Email + password, with the **bearer plugin** so every client (web and
 * native) authenticates the same way — an `Authorization: Bearer <token>`
 * header, no cookies (see docs/server-migration-plan.md). It shares the one
 * server database file with the app repos (better-auth owns the `user`,
 * `session`, `account`, `verification` tables; the app owns the rest).
 *
 * Server-only: never import from client code.
 */
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { databasePath } from "./db";

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

/**
 * Dev/test "email transport": remembers the latest reset link per email and
 * logs it. Production replaces this with a real mailer. Exported so tests and
 * the e2e reset endpoint can read the captured link.
 */
export const resetUrls = new Map<string, string>();

export const auth = betterAuth({
  database: new Database(databasePath()),
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

let migrated: Promise<void> | null = null;

/** Creates/updates better-auth's tables in the shared DB file (once per process). */
export function ensureAuthMigrated(): Promise<void> {
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
