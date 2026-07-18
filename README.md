# ShotCoach

Basketball shooting-form analysis from pose data. A TypeScript **library** turns
MediaPipe pose landmarks into detected shots, keyframes, metrics, and scores; a
SvelteKit **app** records/uploads video, runs the analysis in the browser, and
coaches the player.

- **Library** — `src/` (published as `basketball-shot-analysis`, built to `dist/`)
- **App** — `app/` (`shotcoach`, static SPA + Capacitor shell)
- **Auth server** — `auth-server/` (identity only)
- **Validator** — `validate-metrics.html` + `server.ts` (a local tuning tool)

## Documentation map

| Doc                                                                          | What it covers                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)                               | System topology, analysis stack, scoring, auth, persistence (with diagrams) |
| [`docs/shot-detection-and-analysis.md`](docs/shot-detection-and-analysis.md) | The detection & analysis algorithm in plain language (granular diagrams)    |
| [`docs/metrics-by-phase.md`](docs/metrics-by-phase.md)                       | Every metric, organized by shot phase                                       |
| [`docs/follow-up-work.md`](docs/follow-up-work.md)                           | Production-readiness recommendations                                        |
| [`docs/test-plan.md`](docs/test-plan.md)                                     | Test-coverage audit and hardening plan                                      |
| [`app/README.md`](app/README.md)                                             | Running the app                                                             |
| [`app/docs/VALIDATION.md`](app/docs/VALIDATION.md)                           | Manual validation                                                           |

---

## Quick start

```bash
npm install            # root install (workspaces: app, auth-server)
npm run build          # build the library to dist/ (the app imports the built package)
npm test               # run the library test suite
```

Run the app (see [`app/README.md`](app/README.md) for details):

```bash
cd app && npm run dev
```

---

## Library commands (root `package.json`)

| Command                                               | What it does                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                       | Compile the library to `dist/` (`tsc`). **The app imports the built `dist/`, so run this after changing `src/`.** |
| `npm run build:browser`                               | Bundle the browser build (`dist/shot-analysis.browser.js`) used by the validator and the app worker.              |
| `npm run check`                                       | Type-check only (`tsc --noEmit`).                                                                                 |
| `npm test`                                            | Run all unit/integration tests once (`vitest run`).                                                               |
| `npm run test:unit` / `test:integration` / `test:e2e` | Watch/targeted test configs.                                                                                      |
| `npm run lint` / `npm run format`                     | Prettier check / write.                                                                                           |

### Detection tuning

| Command                             | What it does                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:labels [-- <filter>]` | Runs detection against every labeled `test-data/` clip and prints detected-vs-labeled keyframes, per-keyframe pass rates, the start→downstream cascade, and a P/F grid. The fast loop for tuning detectors. Tool: `src/testing/tolerance-report.ts`.    |
| `npm run validate`                  | Builds the browser bundle and starts the **validator** at `http://localhost:3000` — load a clip's `poses.json` + `labels.json` and compare detected keyframes/metrics to your labels, with a pose-skeleton and you-vs-pro overlay. Server: `server.ts`. |

### Reference-metrics pipeline

The Sequencing/Structure scoring is built from reference (ideally NBA) clips.
The commands below share one format, so the same pipeline works for placeholder
`test-data` clips today and real clips later. See
[`docs/shot-detection-and-analysis.md`](docs/shot-detection-and-analysis.md#6-from-metrics-to-a-score).

| Command                                 | What it does                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run metrics:extract [-- <player>]` | Extract v2 metrics for every clip under `reference-data/players/<player>/clip-N/poses.json`; writes per-clip metrics + per-player summaries and prints a reliability-aware table. Scaffolds `reference-data/` on first run. Tool: `src/testing/extract-reference-metrics.ts`.                                        |
| `npm run metrics:thresholds`            | Derive consensus bands + tightness-based weights from the summaries; writes `reference-data/out/thresholds.json` and a review `report.md`. Never clobbers a hand-tuned `thresholds.json`. Tool: `src/testing/derive-thresholds.ts`.                                                                                  |
| `npm run metrics:reference`             | Build **placeholder** `thresholds.json` + `reference-poses.json` (pro skeletons per keyframe) from `test-data` side-view clips, into `reference/` and `app/static/reference/`. Replace with real `metrics:extract`/`metrics:thresholds` output once clips exist. Tool: `src/testing/build-placeholder-reference.ts`. |
| `npm run metrics:golden`                | Regenerate the metrics regression golden file (`src/testing/__fixtures__/metrics-golden.json`). The golden test diffs extraction against it. Tool: `src/testing/build-metrics-golden.ts`.                                                                                                                            |

### Standalone scripts (`scripts/`, run with `npx tsx`)

| Script                                   | What it does                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `scripts/convert-video-tagger-labels.ts` | Convert external video-tagger label exports into the repo's `labels.json` format. |
| `scripts/validate-labels.ts`             | Validate `labels.json` files against the schema.                                  |
| `scripts/test-profile-comparison.ts`     | Compare scoring profiles on the corpus.                                           |

---

## App commands (`app/package.json`)

| Command                             | What it does                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev` / `build` / `preview` | Vite dev / production build / preview.                                  |
| `npm run check`                     | `svelte-check` type-check.                                              |
| `npm run lint` / `format`           | Prettier + ESLint / write.                                              |
| `npm test`                          | Component/unit tests (`vitest`).                                        |
| `npm run test:e2e`                  | Playwright end-to-end specs (`app/src-tests/e2e/`).                     |
| `npm run verify`                    | Full gate: `check → lint → test → build → check:size → check:stripped`. |
| `npm run cap:sync`                  | Build + sync the Capacitor native shells.                               |

---

## Data layout

```
test-data/<clip>/poses.json      # extracted MediaPipe landmarks (input)
test-data/<clip>/labels.json     # human keyframe/boundary labels (ground truth)
test-data/videos/                # source videos (validator can serve them)

reference-data/players/<p>/clip-N/poses.json   # reference (pro) clips you add
reference-data/out/              # generated summaries/thresholds (git-ignored)
reference/                       # committed placeholder thresholds + pro skeletons
```

## Repository conventions

- The library `dist/` is git-ignored; build it before the app consumes it.
- Two detector files (`shot-detector.ts`, `phase-detector.ts`) use 4-space
  indent from an earlier merge and fail root Prettier — pre-existing; don't
  reformat blindly.
- `test-data/`, `app/`, `dist/`, `coverage/` are Prettier-ignored at the root
  (the app has its own Prettier config).
