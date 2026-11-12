# ShotCoach — setup, run & publish

Practical guide to installing the project, running it locally, building it, and
publishing the iOS/Android apps. For architecture and production web hosting,
see [`docs/architecture.md`](docs/architecture.md) and
[`docs/hosting-and-deployment.md`](docs/hosting-and-deployment.md).

## What's in the repo

One monorepo (npm workspaces) with two pieces built from one codebase:

- **Library** — `src/` → `basketball-shot-analysis` (pose → shots, metrics,
  scores), built to `dist/`.
- **App** — `app/` (`shotcoach`): a SvelteKit 2 / Svelte 5 project with **two
  build targets**:
  - **Server** (`adapter-node`) — the web app **and** the `/api/*` backend
    (auth + a single server-side SQLite). This is the thing you host.
  - **Static SPA** (`adapter-static`, the default) — the client bundle wrapped
    by **Capacitor 7** for iOS/Android, which calls a hosted API at
    `VITE_API_URL`.

---

## 1. Prerequisites

- **Node.js ≥ 22.12** and npm (`node -v`).
- **Git**.
- For the **iOS** app: macOS, **Xcode** (+ command-line tools), and
  **CocoaPods** (`sudo gem install cocoapods`), plus an Apple Developer account
  to publish.
- For the **Android** app: **Android Studio** (SDK + platform tools) and a
  **JDK 17+**, plus a Google Play Console account to publish.

You don't need Xcode/Android Studio to run the app in a browser.

---

## 2. Install & set up

```bash
git clone <this-repo> shot-analysis
cd shot-analysis

npm install            # installs the library + the app workspace
npm run build          # build the library (dist/) the app imports
```

Optional app config (local dev works with **no** config):

```bash
cp app/.env.example app/.env   # then edit if needed
```

`.env` only holds build-time, client-safe `VITE_*` values (notably
`VITE_API_URL` for the mobile build — see §5). **Server secrets**
(`AUTH_SECRET`, `DATABASE_PATH`, …) come from the process environment, never
`.env`.

---

## 3. Run locally (web + API, recommended for development)

The dev server serves the app **and** the API on one origin:

```bash
AUTH_SECRET=dev-only npm run dev --workspace shotcoach
# → http://localhost:5173
```

Open http://localhost:5173, create an account (sign-up flows into onboarding),
and you're in. Sanity check: `curl http://localhost:5173/api/health` →
`{"ok":true}`.

Notes:

- Password-reset links are **printed to the server console** in dev (no email).
- **No camera / MediaPipe?** Two dev-only aids:
  - `/__debug/replay` — load a `poses.json` (anything in `test-data/`, e.g. the
    Curry clips) and see the live deviation scorecard + spoken readback with no
    camera.
  - `/practice/live?liveVideo=<url>` — drive the full live loop from a recorded
    clip instead of the webcam.
  - `?e2e=replay` (or `VITE_ANALYSIS_BACKEND=replay`) forces the deterministic
    replay backend anywhere.

---

## 4. Build & run a local production server

Build the Node server target and run it:

```bash
npm run build:node --workspace shotcoach

AUTH_SECRET="$(openssl rand -base64 32)" \
DATABASE_PATH=./data/app.sqlite \
BODY_SIZE_LIMIT=64M \
ORIGIN=http://localhost:3000 \
PORT=3000 \
npm run start --workspace shotcoach
# → http://localhost:3000
```

- `AUTH_SECRET` — required; the better-auth signing secret.
- `DATABASE_PATH` — a persistent SQLite file (created on first run).
- `BODY_SIZE_LIMIT=64M` — clients POST multi-MB pose payloads to
  `/api/analysis/*`; the adapter-node default (512K) is too small.
- `ORIGIN` / `PORT` — the public origin and port the server binds.

Full hosting guidance (reverse proxy, persistent volume, checklist) is in
[`docs/hosting-and-deployment.md`](docs/hosting-and-deployment.md).

---

## 5. Publish the mobile apps (iOS & Android)

The native apps are the **static SPA** in a Capacitor shell; they do **not**
bundle a backend — they call your **hosted** API. So the order is:

1. **Deploy the server** (§4 / the hosting doc) at a public HTTPS URL, e.g.
   `https://app.example.com`.
2. **Build the SPA with that URL baked in**, then sync it into the native
   projects. `VITE_API_URL` is baked at build time, so it must be set _before_
   the build:

   ```bash
   VITE_API_URL=https://app.example.com \
     npm run build:static --workspace shotcoach

   cd app && npx cap sync      # copies build/ into ios/ and android/ (+ pods)
   ```

   (`npm run cap:sync --workspace shotcoach` runs build + `cap sync` together —
   set `VITE_API_URL` on that command too.)

App identity lives in `app/capacitor.config.ts` (`appId: com.shotcoach.app`,
`appName: ShotCoach`). The live camera + motion checks need platform
permissions — before your first release, confirm:

- **iOS** `app/ios/App/App/Info.plist`: `NSCameraUsageDescription` (and
  `NSMotionUsageDescription` for the stability check).
- **Android** `app/android/app/src/main/AndroidManifest.xml`: the
  `android.permission.CAMERA` entry.

### iOS

```bash
cd app && npx cap open ios      # opens the project in Xcode
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → pick your Team
   (bundle id `com.shotcoach.app`).
2. Bump **Version** / **Build**.
3. Choose **Any iOS Device (arm64)**, then **Product → Archive**.
4. In the Organizer, **Distribute App → App Store Connect** → upload.
5. Finish in **App Store Connect** (TestFlight for testing, then submit for
   review).

### Android

```bash
cd app && npx cap open android  # opens the project in Android Studio
```

In Android Studio:

1. Set `versionCode` / `versionName` in `app/android/app/build.gradle`.
2. **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**,
   creating or selecting an upload **keystore** (keep it safe — Play signing
   depends on it).
3. Upload the `.aab` to the **Google Play Console** (internal testing track
   first, then production).

Re-run `npm run build:static` + `npx cap sync` whenever the web code changes,
then re-archive / re-bundle.

---

## 6. Checks & tests

```bash
# library (repo root)
npm run build          # tsc → dist/
npm test               # library unit tests

# app (workspace)
npm run check --workspace shotcoach    # svelte-check (types)
npm run lint  --workspace shotcoach    # prettier + eslint
npm test      --workspace shotcoach    # vitest
npm run verify --workspace shotcoach   # check + lint + test + build + size/strip gates
```
