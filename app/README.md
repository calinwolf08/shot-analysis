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

1. **`shotcoach`** (this workspace) — the SvelteKit **static SPA**
   (`adapter-static`, client-rendered). Analysis (MediaPipe + the
   `basketball-shot-analysis` library) runs entirely in the browser; app
   data lives in a client-side SQLite (sql.js) database. Ships to web and,
   via Capacitor, to iOS/Android.
2. **`shotcoach-auth-server`** (`../auth-server`) — a tiny Node service
   ([better-auth] email/password, its own server-side SQLite). The SPA
   can't host credentials, so identity gets its own process. The app
   reaches it at `VITE_AUTH_URL`.

Config for each is a `.env` file; copy the template and edit:

```bash
cp app/.env.example app/.env                 # VITE_AUTH_URL, backend, debug…
cp auth-server/.env.example auth-server/.env # AUTH_SECRET, DB, origins…
```

Every value has a working local default, so for local dev you can skip the
copy entirely. See each `.env.example` for the full annotated list.

## Running locally

```bash
# from the repo root (npm workspaces)
npm install
npm run build                                 # build the library the app depends on

# terminal 1 — auth server (http://localhost:5174)
npm start --workspace shotcoach-auth-server

# terminal 2 — app dev server (http://localhost:5173)
npm run dev --workspace shotcoach
```

Open http://localhost:5173, create an account, and you're in. Sanity check
that the auth server is up: `curl http://localhost:5174/health` →
`{"ok":true}`. If it isn't running, the app throws a CORS/`(null)` error on
every auth call.

- All routes except `/auth/*` require a session; sign-up flows straight
  into onboarding. Player data is scoped per account (migration 002).
- Password-reset links are **logged to the auth-server console** in dev
  (no SMTP); wire a real sender for production — see `../auth-server/README.md`.
- Prefer working on UI without a camera/MediaPipe? Append `?e2e=replay` to
  any URL (see [Replay / e2e mode](#replay--e2e-mode)).

## Running in production

**App (static SPA).** `VITE_`-prefixed vars are **baked in at build time**,
so set them before building:

```bash
npm run build --workspace basketball-shot-analysis   # the library (repo root)
VITE_AUTH_URL=https://auth.example.com \
  npm run build --workspace shotcoach                # → app/build/ (static files)
```

Serve `app/build/` from any static host / CDN with SPA fallback to
`index.html` (the adapter already emits it). No Node runtime is needed for
the app itself. For the native shells, `npm run cap:sync` copies this build
into `android/`/`ios/` (see [Native shells](#native-shells)).

**Auth server (Node service).** Run it on a host with a persistent disk for
its SQLite file, behind TLS:

```bash
# auth-server/.env (or real environment)
AUTH_SECRET=<openssl rand -base64 32>          # REQUIRED — signs sessions
AUTH_DB=/var/lib/shotcoach/auth.sqlite         # persistent volume
AUTH_TRUSTED_ORIGINS=https://app.example.com,capacitor://localhost,http://localhost
AUTH_PORT=5174

npm start --workspace shotcoach-auth-server
```

Production checklist:

- **Set `AUTH_SECRET`** to a strong random value (the dev fallback is
  insecure).
- **`AUTH_TRUSTED_ORIGINS` must list every app origin** exactly (scheme +
  host + port, no trailing slash) — the web origin plus `capacitor://localhost`
  and `http://localhost` for the mobile shells. A missing origin is the #1
  cause of production CORS failures.
- **`VITE_AUTH_URL` must be the public auth URL** and set at app _build_
  time. Serve both over HTTPS.
- **Replace the reset-email transport** (`../auth-server/src/auth.js`) with
  a real email sender.
- **Never set `AUTH_E2E` or `VITE_E2E`** in production — they expose test
  hooks. `npm run check:stripped` verifies the app build contains no debug
  surfaces.

Playwright starts the auth server automatically for `npm run test:e2e`, so
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
