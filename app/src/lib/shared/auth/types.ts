/** Authenticated user as the app sees it. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * The slice of the better-auth client the app uses — injectable so the
 * store is unit-testable without a server. Methods resolve with an error
 * message (null on success) instead of throwing for expected failures
 * (wrong password, unknown token, …).
 */
export interface AuthApi {
  getSession(): Promise<AuthUser | null>;
  signUp(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<string | null>;
  signIn(input: { email: string; password: string }): Promise<string | null>;
  signOut(): Promise<void>;
  /** Sends the reset link for `email`; redirectTo is the app reset page. */
  requestPasswordReset(
    email: string,
    redirectTo: string,
  ): Promise<string | null>;
  /** Completes a reset started from an emailed token link. */
  resetPassword(newPassword: string, token: string): Promise<string | null>;
  /** Requires the current password; revokes other sessions. */
  changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<string | null>;
}
