/**
 * better-auth instance for ShotCoach: email + password only, backed by a
 * server-side SQLite file (better-sqlite3 through better-auth's built-in
 * kysely adapter). The app itself keeps its client-side sql.js database;
 * this server owns only identity/session tables.
 */
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import Database from "better-sqlite3";

/**
 * @param {{
 *   dbPath: string,
 *   baseURL: string,
 *   trustedOrigins: string[],
 *   secret: string,
 * }} options
 */
export function createAuth(options) {
  const { dbPath, baseURL, trustedOrigins, secret } = options;

  /**
   * Dev/test "email transport": remembers the latest reset link per email
   * and logs it. Production deployments replace this with a real sender
   * (see README); nothing else changes.
   * @type {Map<string, string>}
   */
  const resetUrls = new Map();

  const auth = betterAuth({
    database: new Database(dbPath),
    baseURL,
    basePath: "/api/auth",
    secret,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        console.log(`[auth] password reset for ${user.email}: ${url}`);
        resetUrls.set(user.email, url);
      },
      // Changing the password signs out every other session.
      revokeSessionsOnPasswordReset: true,
    },
  });

  return { auth, resetUrls };
}

/** Creates/updates better-auth's tables in the SQLite file. */
export async function migrate(auth) {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
