import { describe, expect, it } from "vitest";
import { AuthStore } from "../auth-store.svelte";
import type { AuthApi, AuthUser } from "../types";

const USER: AuthUser = { id: "u1", email: "a@b.c", name: "A" };

function makeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getSession: async () => null,
    signUp: async () => null,
    signIn: async () => null,
    signOut: async () => undefined,
    requestPasswordReset: async () => null,
    resetPassword: async () => null,
    changePassword: async () => null,
    ...overrides,
  };
}

describe("AuthStore", () => {
  it("resolves to signed-out when there is no session", async () => {
    const store = new AuthStore(makeApi());
    expect(store.status).toBe("unknown");
    await store.init();
    expect(store.status).toBe("signed-out");
    expect(store.user).toBeNull();
  });

  it("resolves to signed-in with the session user", async () => {
    const store = new AuthStore(makeApi({ getSession: async () => USER }));
    await store.init();
    expect(store.status).toBe("signed-in");
    expect(store.user).toEqual(USER);
  });

  it("treats an unreachable auth server as signed out", async () => {
    const store = new AuthStore(
      makeApi({
        getSession: async () => {
          throw new TypeError("fetch failed");
        },
      }),
    );
    await store.init();
    expect(store.status).toBe("signed-out");
  });

  it("signIn surfaces expected errors without changing status", async () => {
    const store = new AuthStore(
      makeApi({ signIn: async () => "Invalid email or password" }),
    );
    await store.init();
    const ok = await store.signIn({ email: "a@b.c", password: "nope" });
    expect(ok).toBe(false);
    expect(store.error).toBe("Invalid email or password");
    expect(store.status).toBe("signed-out");
    expect(store.pending).toBe(false);
  });

  it("signIn success refreshes the session", async () => {
    let signedIn = false;
    const store = new AuthStore(
      makeApi({
        getSession: async () => (signedIn ? USER : null),
        signIn: async () => {
          signedIn = true;
          return null;
        },
      }),
    );
    await store.init();
    const ok = await store.signIn({ email: "a@b.c", password: "right" });
    expect(ok).toBe(true);
    expect(store.status).toBe("signed-in");
    expect(store.user).toEqual(USER);
    expect(store.error).toBeNull();
  });

  it("signOut always lands signed-out", async () => {
    const store = new AuthStore(makeApi({ getSession: async () => USER }));
    await store.init();
    await store.signOut();
    expect(store.status).toBe("signed-out");
    expect(store.user).toBeNull();
  });

  it("network failures produce a friendly error", async () => {
    const store = new AuthStore(
      makeApi({
        signIn: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
    );
    const ok = await store.signIn({ email: "a@b.c", password: "x" });
    expect(ok).toBe(false);
    expect(store.error).toMatch(/can't reach/i);
  });
});
