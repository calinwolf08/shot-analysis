/**
 * Reactive auth state for the whole app. Wraps an AuthApi (real
 * better-auth client in production, fake in tests): session discovery on
 * boot, sign-up/in/out, and the password flows. Route guarding reads
 * `status`; forms read `pending`/`error`.
 */
import type { AuthApi, AuthUser } from "./types";

export type AuthStatus = "unknown" | "signed-out" | "signed-in";

export class AuthStore {
  status = $state<AuthStatus>("unknown");
  user = $state<AuthUser | null>(null);
  /** A call is in flight (disables form submits). */
  pending = $state(false);
  /** Last expected failure (wrong password, taken email, …). */
  error = $state<string | null>(null);

  constructor(private readonly api: AuthApi) {}

  /** Resolves the current session once at boot (and after auth actions). */
  async init(): Promise<void> {
    try {
      const user = await this.api.getSession();
      this.user = user;
      this.status = user ? "signed-in" : "signed-out";
    } catch {
      // Auth server unreachable → treat as signed out; the sign-in page
      // will surface the connectivity error on submit.
      this.user = null;
      this.status = "signed-out";
    }
  }

  private async run(action: () => Promise<string | null>): Promise<boolean> {
    this.pending = true;
    this.error = null;
    try {
      const error = await action();
      if (error) {
        this.error = error;
        return false;
      }
      return true;
    } catch (err) {
      this.error =
        err instanceof TypeError
          ? "Can't reach the sign-in server. Check your connection."
          : err instanceof Error
            ? err.message
            : String(err);
      return false;
    } finally {
      this.pending = false;
    }
  }

  async signUp(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<boolean> {
    const ok = await this.run(() => this.api.signUp(input));
    if (ok) await this.init();
    return ok;
  }

  async signIn(input: { email: string; password: string }): Promise<boolean> {
    const ok = await this.run(() => this.api.signIn(input));
    if (ok) await this.init();
    return ok;
  }

  async signOut(): Promise<void> {
    await this.run(async () => {
      await this.api.signOut();
      return null;
    });
    this.user = null;
    this.status = "signed-out";
  }

  async requestPasswordReset(
    email: string,
    redirectTo: string,
  ): Promise<boolean> {
    return this.run(() => this.api.requestPasswordReset(email, redirectTo));
  }

  async resetPassword(newPassword: string, token: string): Promise<boolean> {
    return this.run(() => this.api.resetPassword(newPassword, token));
  }

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<boolean> {
    return this.run(() => this.api.changePassword(input));
  }
}
