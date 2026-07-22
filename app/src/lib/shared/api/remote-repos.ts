/**
 * Remote {@link AppRepos}: the client's data layer, implemented as typed calls
 * to the Phase 4 `/api/*` endpoints instead of an on-device database.
 *
 * These satisfy the exact same repo interfaces the domain services expect, so
 * the services are agnostic to whether data lives locally (server/tests) or
 * across the network (production client). Ownership scoping happens on the
 * server; the client sends the bearer token and trusts the scoped results.
 */
import type { ApiClient } from "./client";
import type { AppRepos } from "$lib/shared/config/services";
import type {
  PlayerRepo,
  RepRecord,
  RepRepo,
  ScoreRecord,
  ScoreRepo,
  ScoreScope,
  SessionRepo,
  SessionStatus,
  SessionType,
  SettingKey,
  SettingValue,
  SettingsRepo,
  ShotRecord,
  ShotRepo,
  VideoRepo,
} from "$lib/shared/db/repos";

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function createRemoteRepos(api: ApiClient): AppRepos {
  const player: PlayerRepo = {
    create: (input) => api.send("/api/players", input),
    get: (id) => api.get(`/api/players/${id}`),
    getFirst: () => api.get("/api/players/current"),
    update: (id, patch) => api.send(`/api/players/${id}`, patch, "PATCH"),
    // Scoping is server-side now; these on-device concepts are no-ops.
    setCurrentUser() {},
    async claimUnowned() {},
  };

  const video: VideoRepo = {
    create: (input) => api.send("/api/videos", input),
    get: (id) => api.get(`/api/videos/${id}`),
  };

  const session: SessionRepo = {
    create: (input) => api.send("/api/sessions", input),
    get: (id) => api.get(`/api/sessions/${id}`),
    async complete(id) {
      await api.send(`/api/sessions/${id}`, { action: "complete" }, "PATCH");
    },
    async abort(id) {
      await api.send(`/api/sessions/${id}`, { action: "abort" }, "PATCH");
    },
    listByPlayer: (playerId, filter) =>
      api.get(
        "/api/sessions" +
          qs({
            playerId,
            type: filter?.type as SessionType | undefined,
            status: filter?.status as SessionStatus | undefined,
          }),
      ),
  };

  const shot: ShotRepo = {
    saveAnalysis: (input) => api.send("/api/shots", input),
    get: (id) => api.get(`/api/shots/${id}`),
    listBySession: (sessionId, opts) =>
      api.get<ShotRecord[]>(
        "/api/shots" +
          qs({
            sessionId,
            includeExcluded: opts?.includeExcluded ? "true" : undefined,
          }),
      ),
    async setExcluded(id, excluded) {
      await api.send(`/api/shots/${id}`, { excluded }, "PATCH");
    },
  };

  const score: ScoreRepo = {
    insert: (input) => api.send("/api/scores", input),
    latestForRef: (scope, refId) =>
      api.get<ScoreRecord | null>(
        "/api/scores" + qs({ scope, refId, mode: "latest" }),
      ),
    listForRef: (scope, refId) =>
      api.get("/api/scores" + qs({ scope, refId, mode: "list" })),
    async latestForRefs(scope, refIds) {
      const obj = await api.send<Record<string, ScoreRecord>>(
        "/api/scores/latest-for-refs",
        { scope, refIds },
      );
      return new Map(Object.entries(obj));
    },
  };

  const rep: RepRepo = {
    create: (input) => api.send("/api/reps", input),
    listBySession: (sessionId) =>
      api.get<RepRecord[]>("/api/reps" + qs({ sessionId })),
  };

  const settings: SettingsRepo = {
    get: <K extends SettingKey>(key: K) =>
      api.get<SettingValue<K>>(`/api/settings/${key}`),
    async set<K extends SettingKey>(key: K, value: SettingValue<K>) {
      await api.send(`/api/settings/${key}`, { value }, "PUT");
    },
  };

  return { player, video, session, shot, score, rep, settings };
}

// Re-exported for callers building over a single client instance.
export type { ScoreScope };
