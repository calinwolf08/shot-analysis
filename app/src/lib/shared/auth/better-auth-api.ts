/**
 * AuthApi over the real better-auth client, using **bearer tokens** for every
 * platform (web and native alike — see docs/server-migration-plan.md).
 *
 * The server (SvelteKit `/api/auth/*`) returns the session token in a
 * `set-auth-token` header on sign-in/up; we persist it via {@link TokenStore}
 * and attach it as `Authorization: Bearer` on every request. Web talks to the
 * same origin; the native app talks to `VITE_API_URL`.
 */
import { createAuthClient } from "better-auth/client";
import type { AuthApi, AuthUser } from "./types";
import { createTokenStore, type TokenStore } from "./token-store";
import { isNative } from "$lib/shared/config/platform";

/** API origin: same-origin on web, the configured remote on native. */
export function apiBaseUrl(): string {
  if (isNative()) {
    return (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  }
  if (typeof window !== "undefined") return window.location.origin;
  return ""; // SSR / build: unused (the client only runs in the browser).
}

// Back-compat export (older modules referenced this name).
export const AUTH_BASE_URL: string = apiBaseUrl();

type Client = ReturnType<typeof createAuthClient>;

function errorOf(result: {
  error?: { message?: string } | null;
}): string | null {
  return result.error ? (result.error.message ?? "Something went wrong") : null;
}

/** A better-auth client wired to capture + send the bearer token. */
export function createBearerAuthClient(tokens: TokenStore): Client {
  return createAuthClient({
    baseURL: apiBaseUrl(),
    fetchOptions: {
      // Capture the token the server mints on sign-in/up.
      onSuccess: (ctx) => {
        const token = ctx.response.headers.get("set-auth-token");
        if (token) tokens.set(token);
      },
      // Attach it to every request.
      auth: {
        type: "Bearer",
        token: () => tokens.get() ?? "",
      },
    },
  });
}

export function createBetterAuthApi(
  tokens: TokenStore = createTokenStore(),
  client: Client = createBearerAuthClient(tokens),
): AuthApi {
  return {
    async getSession(): Promise<AuthUser | null> {
      const { data } = await client.getSession();
      if (!data?.user) return null;
      const { id, email, name } = data.user;
      return { id, email, name };
    },

    async signUp(input) {
      return errorOf(await client.signUp.email(input));
    },

    async signIn(input) {
      return errorOf(await client.signIn.email(input));
    },

    async signOut() {
      await client.signOut();
      tokens.clear();
    },

    async requestPasswordReset(email, redirectTo) {
      return errorOf(await client.requestPasswordReset({ email, redirectTo }));
    },

    async resetPassword(newPassword, token) {
      return errorOf(await client.resetPassword({ newPassword, token }));
    },

    async changePassword(input) {
      return errorOf(
        await client.changePassword({ ...input, revokeOtherSessions: true }),
      );
    },
  };
}
