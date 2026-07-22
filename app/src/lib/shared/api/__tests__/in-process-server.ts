/**
 * A tiny in-process router that dispatches `fetch(url, init)` to the real
 * `/api/*` SvelteKit handlers, so the remote repos/services can be exercised
 * end-to-end against the actual endpoints + a real (temp) database — no HTTP
 * server required. `user` stands in for what `hooks.server.ts` resolves from
 * the bearer token. Test-only.
 */
import type { RequestEvent } from "@sveltejs/kit";

import { POST as playersPost } from "../../../../routes/api/players/+server";
import { GET as playersCurrent } from "../../../../routes/api/players/current/+server";
import {
  GET as playerGet,
  PATCH as playerPatch,
} from "../../../../routes/api/players/[id]/+server";
import { POST as videosPost } from "../../../../routes/api/videos/+server";
import { GET as videoGet } from "../../../../routes/api/videos/[id]/+server";
import {
  GET as sessionsGet,
  POST as sessionsPost,
} from "../../../../routes/api/sessions/+server";
import {
  GET as sessionGet,
  PATCH as sessionPatch,
} from "../../../../routes/api/sessions/[id]/+server";
import {
  GET as shotsGet,
  POST as shotsPost,
} from "../../../../routes/api/shots/+server";
import {
  GET as shotGet,
  PATCH as shotPatch,
} from "../../../../routes/api/shots/[id]/+server";
import { GET as scoresGet, POST as scoresPost } from "../../../../routes/api/scores/+server";
import { POST as latestForRefs } from "../../../../routes/api/scores/latest-for-refs/+server";
import { GET as repsGet, POST as repsPost } from "../../../../routes/api/reps/+server";
import {
  GET as settingGet,
  PUT as settingPut,
} from "../../../../routes/api/settings/[key]/+server";
import { GET as benchmarksActive } from "../../../../routes/api/benchmarks/active/+server";
import { GET as drillsList } from "../../../../routes/api/drills/+server";
import { GET as drillGet } from "../../../../routes/api/drills/[id]/+server";
import { GET as progressGet } from "../../../../routes/api/progress/+server";
import { GET as diagnosisGet } from "../../../../routes/api/diagnosis/+server";
import { GET as plansGet, POST as plansPost } from "../../../../routes/api/plans/+server";
import { GET as planGet } from "../../../../routes/api/plans/[id]/+server";
import { PATCH as planItemPatch } from "../../../../routes/api/plans/items/[id]/+server";
import { POST as plansReassess } from "../../../../routes/api/plans/reassess/+server";
import { POST as analysisShot } from "../../../../routes/api/analysis/shot/+server";
import { POST as analysisSession } from "../../../../routes/api/analysis/session/+server";
import { POST as sessionRescore } from "../../../../routes/api/sessions/[id]/rescore/+server";

type Handler = (event: RequestEvent) => Promise<Response>;
interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

/** Ordered most-specific-first; `:param` groups become `event.params`. */
const routes: Route[] = [
  ["GET", "/api/players/current", playersCurrent],
  ["POST", "/api/players", playersPost],
  ["GET", "/api/players/:id", playerGet],
  ["PATCH", "/api/players/:id", playerPatch],
  ["POST", "/api/videos", videosPost],
  ["GET", "/api/videos/:id", videoGet],
  ["GET", "/api/sessions", sessionsGet],
  ["POST", "/api/sessions", sessionsPost],
  ["POST", "/api/sessions/:id/rescore", sessionRescore],
  ["GET", "/api/sessions/:id", sessionGet],
  ["PATCH", "/api/sessions/:id", sessionPatch],
  ["GET", "/api/shots", shotsGet],
  ["POST", "/api/shots", shotsPost],
  ["GET", "/api/shots/:id", shotGet],
  ["PATCH", "/api/shots/:id", shotPatch],
  ["GET", "/api/scores/latest-for-refs", () => notFound()],
  ["POST", "/api/scores/latest-for-refs", latestForRefs],
  ["GET", "/api/scores", scoresGet],
  ["POST", "/api/scores", scoresPost],
  ["GET", "/api/reps", repsGet],
  ["POST", "/api/reps", repsPost],
  ["GET", "/api/settings/:key", settingGet],
  ["PUT", "/api/settings/:key", settingPut],
  ["GET", "/api/benchmarks/active", benchmarksActive],
  ["GET", "/api/drills/:id", drillGet],
  ["GET", "/api/drills", drillsList],
  ["GET", "/api/progress", progressGet],
  ["GET", "/api/diagnosis", diagnosisGet],
  ["GET", "/api/plans/items/:id", () => notFound()],
  ["PATCH", "/api/plans/items/:id", planItemPatch],
  ["POST", "/api/plans/reassess", plansReassess],
  ["GET", "/api/plans/:id", planGet],
  ["GET", "/api/plans", plansGet],
  ["POST", "/api/plans", plansPost],
  ["POST", "/api/analysis/shot", analysisShot],
  ["POST", "/api/analysis/session", analysisSession],
].map(([method, path, handler]) => ({
  method: method as string,
  pattern: toPattern(path as string),
  handler: handler as Handler,
}));

function toPattern(path: string): RegExp {
  const src = path.replace(/:[^/]+/g, (m) => `(?<${m.slice(1)}>[^/]+)`);
  return new RegExp(`^${src}$`);
}

function notFound(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
  );
}

export type SessionUser = { id: string; email: string; name: string };

/**
 * Builds a `fetch` bound to `user`, dispatching to the real endpoints. Pass it
 * (with `baseUrl: "http://localhost"`) to {@link createApiClient}.
 */
export function inProcessFetch(user: SessionUser | null): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(raw);
    const method = (init?.method ?? "GET").toUpperCase();
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(url.pathname);
      if (!m) continue;
      const event = {
        locals: { user, session: null },
        request: new Request(url, {
          method,
          headers: init?.headers,
          body: init?.body as BodyInit | undefined,
        }),
        url,
        params: m.groups ?? {},
      } as unknown as RequestEvent;
      return r.handler(event);
    }
    return notFound();
  }) as typeof fetch;
}
