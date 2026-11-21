import { describe, expect, it } from "vitest";
import {
  DEV_SQLITE_PATH,
  DatabaseConfigError,
  describeDbConfig,
  resolveDbConfig,
} from "../config";

describe("resolveDbConfig", () => {
  it("DATABASE_URL with a postgres scheme → Postgres", () => {
    expect(
      resolveDbConfig({ DATABASE_URL: "postgres://u:p@db:5432/app" }),
    ).toEqual({
      kind: "postgres",
      url: "postgres://u:p@db:5432/app",
    });
    expect(resolveDbConfig({ DATABASE_URL: "postgresql://db/app" }).kind).toBe(
      "postgres",
    );
  });

  it("DATABASE_PATH → SQLite; a non-postgres DATABASE_URL is a SQLite path", () => {
    expect(resolveDbConfig({ DATABASE_PATH: "/data/x.sqlite" })).toEqual({
      kind: "sqlite",
      path: "/data/x.sqlite",
    });
    expect(resolveDbConfig({ DATABASE_URL: "file:/data/y.sqlite" })).toEqual({
      kind: "sqlite",
      path: "/data/y.sqlite",
    });
  });

  it("both Postgres URL and SQLite path set → error", () => {
    expect(() =>
      resolveDbConfig({
        DATABASE_URL: "postgres://db/app",
        DATABASE_PATH: "/x",
      }),
    ).toThrow(DatabaseConfigError);
  });

  it("dev/test without config → the dev SQLite file", () => {
    expect(resolveDbConfig({ NODE_ENV: "development" })).toEqual({
      kind: "sqlite",
      path: DEV_SQLITE_PATH,
    });
    expect(resolveDbConfig({})).toEqual({
      kind: "sqlite",
      path: DEV_SQLITE_PATH,
    });
  });

  it("production without config refuses to start (no data loss on redeploy)", () => {
    expect(() => resolveDbConfig({ NODE_ENV: "production" })).toThrow(
      /Refusing to start/,
    );
    expect(() =>
      resolveDbConfig({ NODE_ENV: "production", DATABASE_PATH: "  " }),
    ).toThrow(DatabaseConfigError);
    expect(
      resolveDbConfig({
        NODE_ENV: "production",
        DATABASE_PATH: "/data/a.sqlite",
      }).kind,
    ).toBe("sqlite");
    // …but the build (SvelteKit renders pages with NODE_ENV=production) is
    // not a running server.
    expect(
      resolveDbConfig({ NODE_ENV: "production" }, { building: true }).kind,
    ).toBe("sqlite");
  });

  it("describe hides credentials", () => {
    const d = describeDbConfig({
      kind: "postgres",
      url: "postgres://user:secret@db.example:5433/shots",
    });
    expect(d).toBe("postgres (db.example:5433/shots)");
    expect(d).not.toContain("secret");
  });
});
