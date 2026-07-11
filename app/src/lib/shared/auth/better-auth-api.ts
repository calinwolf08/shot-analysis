/**
 * AuthApi implementation over the real better-auth client. The server is
 * the standalone auth-server workspace; its base URL comes from
 * VITE_AUTH_URL (dev/e2e default: the local auth server).
 */
import { createAuthClient } from "better-auth/client";
import type { AuthApi, AuthUser } from "./types";

export const AUTH_BASE_URL: string =
  (import.meta.env.VITE_AUTH_URL as string | undefined) ??
  "http://localhost:5174";

type Client = ReturnType<typeof createAuthClient>;

function errorOf(result: {
  error?: { message?: string } | null;
}): string | null {
  return result.error ? (result.error.message ?? "Something went wrong") : null;
}

export function createBetterAuthApi(
  client: Client = createAuthClient({ baseURL: AUTH_BASE_URL }),
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
