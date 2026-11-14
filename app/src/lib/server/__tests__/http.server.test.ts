import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { RequestEvent } from "@sveltejs/kit";
import { errorResponse, withUser } from "../http";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { resetDbSingletonForTests } from "../db";

function eventWithUser(user: unknown): RequestEvent {
  return { locals: { user, session: null } } as unknown as RequestEvent;
}

describe("errorResponse", () => {
  it("maps typed errors to status codes", async () => {
    expect(errorResponse(new UnauthorizedError()).status).toBe(401);
    expect(errorResponse(new ForbiddenError()).status).toBe(403);
    expect(errorResponse(z.string().safeParse(1).error!).status).toBe(400);
    expect(errorResponse(new Error("boom")).status).toBe(500);
  });
});

describe("withUser", () => {
  beforeEach(() => {
    process.env.DATABASE_PATH = ":memory:";
    resetDbSingletonForTests();
  });
  afterEach(() => {
    delete process.env.DATABASE_PATH;
    resetDbSingletonForTests();
  });

  it("401s when there is no authenticated user", async () => {
    const handler = withUser(async () => new Response("ok"));
    const res = await handler(eventWithUser(null));
    expect(res.status).toBe(401);
  });

  it("passes scoped repos to the handler when authenticated", async () => {
    const handler = withUser(async (ctx) => {
      expect(ctx.userId).toBe("user-1");
      expect(typeof ctx.repos.player.getFirst).toBe("function");
      // The repos actually work against the (migrated) DB.
      expect(await ctx.repos.player.getFirst()).toBeNull();
      return new Response("ok");
    });
    const res = await handler(
      eventWithUser({ id: "user-1", email: "a@b.c", name: "A" }),
    );
    expect(res.status).toBe(200);
  });

  it("maps a handler's ForbiddenError to 403", async () => {
    const handler = withUser(async () => {
      throw new ForbiddenError("nope");
    });
    const res = await handler(
      eventWithUser({ id: "user-1", email: "a@b.c", name: "A" }),
    );
    expect(res.status).toBe(403);
  });
});
