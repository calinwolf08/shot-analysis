/**
 * Which database the server uses, from the environment
 * (docs/database-abstraction-plan.md):
 *
 *   DATABASE_URL=postgres://… (or postgresql://…)  → Postgres
 *   DATABASE_PATH=/data/shotcoach.sqlite            → SQLite file
 *
 * For backward compatibility a DATABASE_URL that isn't a Postgres URL is
 * treated as a SQLite path (`file:` prefix allowed).
 *
 * Production guard: with NODE_ENV=production the server refuses to start
 * unless one of them is set explicitly — otherwise it would silently write to
 * a throwaway file inside the container and lose every account and shot on
 * redeploy.
 *
 * Server-only.
 */

export type DbConfig =
  | { readonly kind: "sqlite"; readonly path: string }
  | { readonly kind: "postgres"; readonly url: string };

export type DbKind = DbConfig["kind"];

/** Dev default (never used in production — see the guard). */
export const DEV_SQLITE_PATH = "./data/shotcoach.sqlite";

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

const isPostgresUrl = (v: string) => /^postgres(ql)?:\/\//i.test(v);

export function resolveDbConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  opts: {
    /**
     * True while `vite build` renders pages (SvelteKit's `building`): the
     * production guard is for a RUNNING server, not the build.
     */
    building?: boolean;
  } = {},
): DbConfig {
  const url = env.DATABASE_URL?.trim() || undefined;
  const path = env.DATABASE_PATH?.trim() || undefined;

  if (url && isPostgresUrl(url)) {
    if (path) {
      throw new DatabaseConfigError(
        "Both DATABASE_URL (Postgres) and DATABASE_PATH (SQLite) are set — set only one.",
      );
    }
    return { kind: "postgres", url };
  }
  const sqlitePath = path ?? url?.replace(/^file:/i, "");
  if (sqlitePath) return { kind: "sqlite", path: sqlitePath };

  if (env.NODE_ENV === "production" && !opts.building) {
    throw new DatabaseConfigError(
      "No database configured. Set DATABASE_PATH to a SQLite file on a persistent volume " +
        "(e.g. /data/shotcoach.sqlite) or DATABASE_URL to a Postgres URL. " +
        "Refusing to start: without one, all data would be lost on redeploy.",
    );
  }
  return { kind: "sqlite", path: DEV_SQLITE_PATH };
}

/** For logs: the kind and a credential-free location. */
export function describeDbConfig(c: DbConfig): string {
  if (c.kind === "sqlite") return `sqlite (${c.path})`;
  try {
    const u = new URL(c.url);
    return `postgres (${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname})`;
  } catch {
    return "postgres";
  }
}
