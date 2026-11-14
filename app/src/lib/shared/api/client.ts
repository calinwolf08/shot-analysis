/**
 * The client-side HTTP transport for the `/api/*` data endpoints.
 *
 * Every request carries the bearer token (same token better-auth mints and
 * {@link TokenStore} persists — see docs/server-migration-plan.md) so the
 * server can scope it to the signed-in user. Web talks to the same origin;
 * native talks to `VITE_API_URL` (resolved by {@link apiBaseUrl}).
 *
 * `request()` throws {@link ApiError} on any non-2xx response so callers (the
 * remote repos/services) can stay terse.
 */
import { apiBaseUrl } from "$lib/shared/auth/better-auth-api";
import {
  createTokenStore,
  type TokenStore,
} from "$lib/shared/auth/token-store";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClient {
  /** GET `path`, parsed as JSON. */
  get<T>(path: string): Promise<T>;
  /** Send a JSON body (default POST), parsed as JSON. */
  send<T>(path: string, body: unknown, method?: string): Promise<T>;
}

export interface ApiClientDeps {
  /** Injectable for tests (in-process handler) and native (custom origin). */
  fetch?: typeof fetch;
  baseUrl?: string;
  tokens?: TokenStore;
}

export function createApiClient(deps: ApiClientDeps = {}): ApiClient {
  const doFetch = deps.fetch ?? fetch;
  const baseUrl = deps.baseUrl ?? apiBaseUrl();
  const tokens = deps.tokens ?? createTokenStore();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = tokens.get();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await doFetch(baseUrl + path, { ...init, headers });
    const text = await res.text();
    const parsed = text ? safeJson(text) : null;
    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : res.statusText) || `HTTP ${res.status}`;
      throw new ApiError(res.status, message, parsed);
    }
    return parsed as T;
  }

  return {
    get: (path) => request(path),
    send: (path, body, method = "POST") =>
      request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
