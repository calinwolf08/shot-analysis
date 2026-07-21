/**
 * Where the bearer session token lives on the client.
 *
 * One mechanism for every platform (see docs/server-migration-plan.md): the
 * token is captured from better-auth's `set-auth-token` response header and
 * sent back as `Authorization: Bearer`. It is persisted in `localStorage`,
 * which is available and per-app sandboxed in both the browser and the
 * Capacitor WebView, so a signed-in session survives reloads and app restarts.
 *
 * The interface is deliberately small so a stronger native backend
 * (`@capacitor/preferences` or a secure-storage plugin) can replace the
 * implementation without touching callers.
 */
export interface TokenStore {
  /** The stored token, or null when signed out / unavailable. */
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

const DEFAULT_KEY = "shotcoach.bearer_token";

/** localStorage-backed store (SSR-safe: a no-op when there is no window). */
export function createTokenStore(key: string = DEFAULT_KEY): TokenStore {
  const ls = (): Storage | null =>
    typeof localStorage !== "undefined" ? localStorage : null;
  return {
    get: () => ls()?.getItem(key) ?? null,
    set: (token: string) => ls()?.setItem(key, token),
    clear: () => ls()?.removeItem(key),
  };
}
