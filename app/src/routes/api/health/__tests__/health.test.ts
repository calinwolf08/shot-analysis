import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../+server";
import { resetDbSingletonForTests } from "$lib/server/db";

// The handler ignores its event; build a minimal stub of its exact param type.
const event = {} as unknown as Parameters<typeof GET>[0];

describe("GET /api/health", () => {
  let prevPath: string | undefined;

  beforeEach(() => {
    prevPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = ":memory:";
    resetDbSingletonForTests();
  });

  afterEach(() => {
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    resetDbSingletonForTests();
  });

  it("returns 200 { ok: true } when the DB opens", async () => {
    const res = await GET(event);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
