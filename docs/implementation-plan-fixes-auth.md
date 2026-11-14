# Implementation plan: analysis-UX fixes, live-practice observability, auth

Follow-up to `implementation-plan-training-app.md` (all 24 steps shipped) and
the master merge that settled the MediaPipe worker fix (the `self.import`
shim in `analysis.worker.ts`). Branch: `claude/shotcoach-implementation`.

Working agreement stays the same: one commit per step, `npm run verify` and
`npm run test:e2e` green per step, deviations recorded in
`app/docs/deviations.md`.

---

## Step 1 — /assess: progress bar that actually moves + activity spinner

**Problem.** `AnalyzeStep.svelte` computes `fraction` as
`framesProcessed / totalFrames`, but the real worker's progress events never
carry `totalFrames` — the worker only sees frames streamed in batches and
cannot know the total. Only the replay pipeline fills it in, so with real
videos the bar sits at 0 forever. There is also no indeterminate motion, so
the screen looks frozen even while frames are being processed.

**Fix.**

- `worker-analysis-service.ts`: the main thread _does_ know the video length —
  `provider.getMetadata().duration` (ms) × `provider.getFps()`. Compute
  `estimatedTotalFrames` once per video and enrich every worker progress
  event with it (worker value wins if it ever sets one). Clamp
  `framesProcessed` to the estimate so rounding never shows >100%.
- `AnalyzeStep.svelte`: add an animated spinner that runs whenever analysis
  is in flight, independent of the fraction — so even a stalled/unknown
  fraction visibly means "working". Keep the percentage text only when a
  total is known. Pure CSS animation (no new deps), honors
  `prefers-reduced-motion`.
- Tests: unit test that the service injects `totalFrames` into progress
  events (extend `worker-analysis-service.test.ts` — its fake worker already
  emits totals-less progress); component test that AnalyzeStep shows the
  spinner while `progress` is non-null.

## Step 2 — /assess: show start/end frames per detected shot in Review

**Problem.** `ReviewStep.svelte` lists detected shots but gives the user no
way to judge whether a detection is real — no temporal anchor.

**Fix.**

- Each review row shows the shot's frame range (`startFrame`–`endFrame`) and
  the equivalent time range (`mm:ss.t`, derived from the video fps stored on
  the analysis) so a user can scrub their source video and check.
- Data already exists: `ShotRecord.startFrame` / `endFrame` and the analysis
  fps travel with each saved shot.
- Tests: extend the ReviewStep component/e2e assertions to check the range
  renders for each `review-shot-*` row.

## Step 3 — /practice/live: truthful "player in frame" indicator + pose overlay

**Problem.** The border indicator merged from master derives from the
coordinator _phase_ (`ready|active|analyzing|feedback` → green). Once the
session leaves IDLE it stays green regardless of whether the player is
still visible — phase is not pose presence.

**Fix.**

- `PracticeLoopScreen.svelte` subscribes to the live `session.onFrame`
  stream directly (prop passed from the route, like SetupScreen does) and
  derives presence from the frames themselves:
  - **tracked** = a pose landmark frame arrived within the last ~700 ms;
  - **fully in frame** = `isFullBodyVisible(frame)` (reuse
    `setup/checks.ts`) held over a short recent window.
  - Border: green when fully in frame, amber when tracked but partial,
    red/neutral when no pose. Badge text follows the same three states.
- **Pose overlay**: draw the live skeleton over the camera preview so the
  player can see they're being tracked. Reuse the connection topology from
  `progress/components/SkeletonOverlay.svelte` by extracting the pure
  drawing helper into a shared module, then render the latest frame's
  landmarks onto a canvas positioned over the `<video>` (mirroring the
  preview's object-fit).
- Tests: replay live e2e asserts the indicator goes green during reps and
  reflects `isFullBodyVisible`; unit-test the presence reducer (frame
  recency window → state).

## Step 4 — /practice/live: gated debug HUD + console diagnostics

**Problem.** When live detection misbehaves there is zero visibility: no way
to tell if frames flow, what the wrist velocity is doing relative to the
trigger threshold, or how close a rep came to firing.

**Fix.**

- Gate: enabled when `import.meta.env.VITE_LIVE_DEBUG === "1"` **or**
  `?debug=live` is in the URL _in dev builds_. Production builds strip the
  HUD entirely unless built with `VITE_LIVE_DEBUG=1` (compile-time constant
  → dead-code elimination), keeping `check:stripped` green.
- Coordinator: add a `debug` event to `CoordinatorEvents` emitting per-frame
  diagnostics (state, smoothed wrist velocity, rise/settle thresholds,
  settle timer progress, buffer frames/span, pose present). Emission is
  no-op unless a listener subscribes, so the hot path stays clean.
- "Almost detected" signal: while READY, track the max smoothed upward
  velocity per second; when it exceeds ~60% of `riseVelocity` without
  triggering, emit a `nearTrigger` diagnostic. Same for reps that reach
  ACTIVE but end in `noShot`.
- HUD overlay (`LiveDebugHud.svelte`): fixed-position translucent panel
  showing state machine state, velocity vs `riseVelocity` (small live bar),
  settle progress, buffer stats, last event log (repStarted / repAnalyzing /
  repResult / noShot / nearTrigger with timestamps). Everything also goes to
  `console.debug("[live]", …)`.
- Tests: coordinator unit tests for the `debug`/`nearTrigger` events; e2e
  replay run with `?debug=live` asserting the HUD renders and updates.

## Step 5 — Authentication & authorization (better-auth, email + password)

**Architecture decision.** better-auth is a _server_ library; the app is an
adapter-static SPA whose only database is client-side sql.js. Neither can
host auth. Rather than swapping the SvelteKit adapter (which would break the
Capacitor static build and every e2e assumption), auth gets its own tiny
server workspace, and the SPA talks to it with better-auth's client:

- `auth-server/` workspace: Node + Hono, `better-auth` configured with
  `emailAndPassword`, backed by its own server-side SQLite file via
  `better-sqlite3` (better-auth's native kysely dialect). CORS restricted to
  the app origin; cookie-based sessions. Password reset emails: pluggable
  sender — dev/test transport logs the reset URL to the server console
  (documented; SMTP is a deployment concern).
- App side: `better-auth/svelte` client in `shared/auth/`, an auth store
  (session, user, pending state) wired into the composition root, base URL
  from `VITE_AUTH_URL`.

**User flows** (all under `/auth/…`, unauthenticated-only layout):

- Sign up (email, password, confirm) → lands in onboarding.
- Sign in → home (or wherever the guard bounced from).
- Sign out (from settings) → `/auth/sign-in`.
- Forgot password → request reset → reset page consumed from the emailed
  token link → sign in with the new password.
- Change password (settings, requires current password; revokes other
  sessions).
- Session persistence across reloads; expiry falls back to sign-in.

**Authorization / data scoping.**

- Route guard in the root layout: no session → redirect to `/auth/sign-in`
  (auth routes and static assets excepted).
- Migration 002: add `userId` to the player table; player lookups become
  user-scoped, so two accounts on one device see separate data. Existing
  rows are claimed by the first signed-in user (single-user upgrade path).
- The client sql.js DB stays the system of record for app data; auth's
  SQLite holds only identity/session tables. (Deviation from "our current
  database" recorded — the current DB lives in the browser and cannot hold
  server-verified credentials.)

**Testing.**

- Playwright `webServer` gains the auth server (port 5174) next to the app
  preview; `VITE_AUTH_URL` points at it in e2e builds.
- New `auth.spec.ts`: full flow — sign up, sign out, sign in, wrong
  password, forgot/reset (reset link read from the dev transport via a test
  endpoint exposed only when `AUTH_E2E=1`), change password.
- Existing specs: a shared helper signs up/in a fresh user per test profile
  before onboarding. `?e2e` keeps meaning "hooks on"; it does **not** bypass
  auth — specs authenticate for real so guards stay covered.
- Unit tests: auth store transitions, route-guard logic, migration 002.

**Sub-steps (one commit each):**

1. `auth-server` workspace + better-auth config + smoke test (sign-up via
   HTTP against a temp DB).
2. App auth client + store + route guards + sign-in/sign-up pages; e2e
   infra (webServer, shared sign-in helper) so the suite stays green.
3. Remaining flows: forgot/reset password, change password, sign out UI,
   settings surface.
4. Migration 002 user-scoping + multi-account behavior + docs
   (README/device-testing notes for running the auth server).

## Ordering & risk

1 and 2 are small, independent UI fixes — first. 3 then 4 share the live
frame plumbing. 5 is the large one, last, split into four commits; its e2e
infrastructure change (webServer array + sign-in helper) is the riskiest
piece and lands in sub-step 2 where the whole suite proves it out.

Environment limits (no SMTP, no camera, headless GPU) are logged per step in
`app/docs/deviations.md` with device-verification instructions.
