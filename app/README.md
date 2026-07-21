# ShotCoach

Mobile basketball shooting-form training app (SvelteKit 2 + Svelte 5 SPA in a
Capacitor 7 shell) built on the `basketball-shot-analysis` library at the repo
root. Design: `../docs/design-training-app.md`. Implementation plan:
`../docs/implementation-plan-training-app.md`.

Record your shot (upload or live camera) → MediaPipe pose analysis → scored
against a benchmark profile → top issues diagnosed → a 2-week training plan of
drills and focused live-practice sessions → re-assess and adapt.

Deep dive on how it all fits together (with diagrams):
[`../docs/architecture.md`](../docs/architecture.md).

## The two processes

The product is **two deployables**, and you always run both:

This is **one SvelteKit workspace** with two build targets from the same
codebase (see [`docs/server-migration-plan.md`](../docs/server-migration-plan.md)
and [`docs/hosting-and-deployment.md`](../docs/hosting-and-deployment.md)):

- **Server build** (`BUILD_TARGET=node`, `adapter-node`) — the web app **and**
  the backend API (`/api/auth`, `/api/health`, … over a single server-side
  SQLite). Auth is [better-auth] email/password with the **bearer plugin** (one
  mechanism for web and native). This is the thing you host.
- **Static SPA build** (`BUILD_TARGET=static`, default, `adapter-static`) — a
  client bundle wrapped by Capacitor for iOS/Android that calls the hosted API
  at `VITE_API_URL`.

Config is `app/.env` (copy `app/.env.example`); every value has a working local
default, so for local dev you can skip it. Server secrets (`AUTH_SECRET`,
`DATABASE_PATH`) come from the process environment — see
[`docs/hosting-and-deployment.md`](../docs/hosting-and-deployment.md).

## Running locally

```bash
# from the repo root (npm workspaces)
npm install
npm run build                       # build the library the app depends on

# app + API on one origin (http://localhost:5173)
AUTH_SECRET=dev-only npm run dev --workspace shotcoach
```

Open http://localhost:5173, create an account, and you're in — auth, data, and
analysis are all served under `/api/*` by the same dev server. Sanity check:
`curl http://localhost:5173/api/health` → `{"ok":true}`.

- All routes except `/auth/*` require a session; sign-up flows straight
  into onboarding. Player data is scoped per account.
- Password-reset links are **logged to the server console** in dev (no SMTP);
  wire a real sender for production (`app/src/lib/server/auth.ts`).
- Prefer working on UI without a camera/MediaPipe? Append `?e2e=replay` to
  any URL (see [Replay / e2e mode](#replay--e2e-mode)).

## Running in production

Full deployment details (web server + Capacitor) live in
[`docs/hosting-and-deployment.md`](../docs/hosting-and-deployment.md). In short:

**Web + API (server build).** Run the adapter-node server on a host with a
persistent disk for its SQLite file, behind TLS:

```bash
npm run build --workspace basketball-shot-analysis   # the library (repo root)
BUILD_TARGET=node npm run build --workspace shotcoach # → app/build/ (node server)

AUTH_SECRET=<openssl rand -base64 32> \
DATABASE_PATH=/var/lib/shotcoach/shotcoach.sqlite \
AUTH_TRUSTED_ORIGINS=https://app.example.com,capacitor://localhost,http://localhost \
ORIGIN=https://app.example.com \
  node app/build                                     # serves app + /api/*
```

**Native app (static build).** `VITE_`-prefixed vars are baked in at build
time; point the app at the hosted API and sync into the shells:

```bash
VITE_API_URL=https://app.example.com BUILD_TARGET=static \
  npm run build --workspace shotcoach
npm run cap:sync --workspace shotcoach               # → android/ , ios/
```

Production checklist:

- **Set `AUTH_SECRET`** to a strong random value (the dev fallback is
  insecure) and keep `DATABASE_PATH` on a persistent volume.
- **`AUTH_TRUSTED_ORIGINS` must list every app origin** exactly (scheme +
  host + port, no trailing slash) — the web origin plus `capacitor://localhost`
  and `http://localhost` for the mobile shells. A missing origin is the #1
  cause of production CORS failures.
- **`VITE_API_URL` must be the public API URL** for the native build, set at
  build time. Serve over HTTPS (bearer tokens travel in the Authorization
  header).
- **Replace the reset-email transport** (`app/src/lib/server/auth.ts`) with a
  real email sender.
- **Never set `AUTH_E2E` or `VITE_E2E`** in production — they expose test
  hooks. `npm run check:stripped` verifies the app build contains no debug
  surfaces.

Playwright starts the single server automatically for `npm run test:e2e`, so
no manual setup is needed to run the e2e suite.

[better-auth]: https://better-auth.com

## Scripts (run in app/ or with --workspace=shotcoach from root)

| Script                   | What                                                |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Vite dev server                                     |
| `npm run build`          | Production SPA build → `build/`                     |
| `npm run preview`        | Serve the production build                          |
| `npm run check`          | `svelte-kit sync` + `svelte-check` (tsc strict)     |
| `npm run lint`           | prettier --check + eslint                           |
| `npm run test`           | Vitest: unit (node) + component (jsdom) projects    |
| `npm run test:e2e`       | Playwright against the built app (`vite preview`)   |
| `npm run cap:sync`       | Build + `npx cap sync` (android + ios)              |
| `npm run check:size`     | Initial-JS gzip budget (≤ 350 KB) on `build/`       |
| `npm run check:stripped` | Debug surfaces absent from the production build     |
| `npm run verify`         | **The gate**: check + lint + test + build + budgets |

Every implementation step keeps `npm run verify` green; steps that touch UI
flows also keep `npm run test:e2e` green. `src-tests/e2e/journey.spec.ts` is
the app's contract test (the full onboarding → re-assessment loop).

## Replay / e2e mode

Loading any page with `?e2e=replay` (or building with
`VITE_ANALYSIS_BACKEND=replay`) swaps the MediaPipe worker for a
deterministic replay backend that produces real analysis results from
recorded pose fixtures (`src-tests/fixtures/poses/`) — no camera needed.
E2E builds (`VITE_E2E=1`) additionally enable the `/__debug/*` routes and DB
test hooks; `npm run check:stripped` proves production builds contain none
of it.

- Chromium is expected preinstalled via `PLAYWRIGHT_BROWSERS_PATH`. If the
  revision mismatches, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a compatible
  binary (e.g. `/opt/pw-browsers/chromium`).

## Native shells

`npm run cap:sync` copies the web build into `android/` and `ios/`.
Placeholder icons/splash screens are generated by
`npx tsx scripts/make-placeholder-app-icons.ts` (regenerate real ones with
`npx @capacitor/assets generate` from `assets/` on a machine where sharp
installs). Android debug build: `cd android && ./gradlew assembleDebug`
(requires an Android SDK). iOS requires macOS (`npx cap sync ios` re-run
there for CocoaPods). Manual device checks: `docs/device-testing.md`.

## Content needed before real users (placeholder inventory)

| Placeholder                              | Where                                        | Replace with                            |
| ---------------------------------------- | -------------------------------------------- | --------------------------------------- |
| Benchmark profile `elite-placeholder-v1` | `src/lib/features/benchmarks/data/`          | Real elite-shooter metric distributions |
| 12 drill entries (copy + coaching cues)  | `src/lib/features/drills/data/drills.json`   | Coach-reviewed drill programming        |
| Drill video `placeholder.webm`           | `static/drills/`                             | Real per-drill footage                  |
| App icon / splash                        | `assets/`, `android/`, `ios/`                | Brand design                            |
| "Why it matters" issue copy              | `src/lib/features/diagnosis/issue-groups.ts` | Coach-reviewed copy                     |

Everything placeholder-derived renders with a `PlaceholderBadge` in the UI.

## Architecture

Full system + algorithm walkthrough with diagrams:
[`../docs/architecture.md`](../docs/architecture.md) — deployment topology,
the two-stage analysis pipeline, the shot-detection algorithm, live vs.
uploaded flows, auth, and the data model.

Feature-first code layout: see `src/lib/features/README.md` for the import
rules. Deviations from the implementation plan (with reasons) are logged in
`docs/deviations.md`; environment-limited follow-ups are listed at the
bottom of that file.
