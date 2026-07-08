# ShotCoach Training App — Autonomous Implementation Plan

This plan implements the app specified in `docs/design-training-app.md`. It is written to be executed **step by step by an LLM agent without human intervention**. Read the design doc fully before starting; it is the source of truth for schemas, formulas, UX, and architecture. This file is the source of truth for *order* and *validation*.

## Rules for the implementing agent (read first, apply to every step)

1. **One step at a time, in order.** Do not start step N+1 until step N's validation gate passes.
2. **Validation gate** = every command in the step's *Validate* block exits 0, plus the global gate:
   ```bash
   npm run verify --workspace=shotcoach
   ```
   where `verify` = `check` (tsc + svelte-check) + `lint` + `test` (vitest run) + `build`. E2E steps additionally run `npm run test:e2e --workspace=shotcoach`. **Never proceed, commit, or mark a step done with a red gate.** If a gate fails, fix it within the current step.
3. **Commit per step** on the working branch with message `feat(app): step N — <step title>` (or `chore`/`test` where noted). Push after each phase completes.
4. **TDD bias**: for pure modules (scoring, diagnosis, planner, coordinator, db, repos) write the tests specified in the step *before or alongside* the implementation. Tests listed in a step are the *minimum*; add more when behavior is non-obvious.
5. **Feature-first discipline**: all code for a feature goes under `app/src/lib/features/<feature>/` per the design doc layout. Routes stay thin. Cross-feature imports only via feature `index.ts` barrels. Never import `app/src/lib/features/x/internal-file` from feature `y`.
6. **Strict TypeScript**: `"strict": true`, no `any` without a justifying comment, no `@ts-ignore` (use `@ts-expect-error` with reason if truly unavoidable).
7. **Do not modify the library** (`/src`) except where a step explicitly says so. The app consumes the library's public API only.
8. **Determinism**: anything random or time-based takes an injected `Clock`/`IdGenerator` (from `shared/utils`) so tests are deterministic.
9. **Placeholders**: wherever the design doc marks content as placeholder (benchmarks, drill videos), implement the real pipeline with placeholder *data*, set `isPlaceholder: true`, and keep the "Content Needed" table in `docs/design-training-app.md` accurate.
10. If a dependency version conflict or environment problem blocks a prescribed tool, choose the closest working alternative, document the deviation in `app/docs/deviations.md`, and continue. Do not silently change architecture.

## Environment assumptions

- Node ≥ 22.12, npm workspaces available. No device/emulator required: all validation is headless (Vitest + Playwright with bundled Chromium). Capacitor native projects are generated and must `cap sync` cleanly, but Android/iOS compilation is not a CI gate (see step 24).
- The repo root is the existing `basketball-shot-analysis` library. The app is created at `app/`.

---

# Phase 0 — Workspace & Walking Skeleton

## Step 1 — Monorepo workspaces + SvelteKit app scaffold

**Goal**: `app/` exists as a SvelteKit 2 + Svelte 5 SPA workspace with strict TS, Vitest, Prettier/ESLint, and a `verify` script; root package.json declares workspaces without breaking existing library scripts.

**Tasks**:
1. Root `package.json`: add `"workspaces": ["app"]`. Confirm existing library scripts (`npm test`, `npm run build`) still work from root.
2. Scaffold SvelteKit in `app/` (`npx sv create` or manual): Svelte 5, TypeScript strict, `@sveltejs/adapter-static` with `fallback: "index.html"`; `src/routes/+layout.ts` exports `ssr = false`, `csr = true`, `prerender = false`.
3. Add tooling: `vitest` + `@testing-library/svelte` + `jsdom`, `eslint` + svelte plugin, `prettier` (match root config style). Vitest config: two projects — `unit` (node env, `**/*.test.ts`) and `component` (jsdom env, `**/*.svelte.test.ts`).
4. `app/package.json` scripts: `dev`, `build`, `preview`, `check`, `lint`, `format`, `test` (`vitest run`), `test:watch`, `verify` (`npm run check && npm run lint && npm run test && npm run build`).
5. Create the folder skeleton from the design doc (`src/lib/features/…`, `src/lib/shared/…`) with `index.ts` barrels and a `README.md` in `src/lib/features/` stating the feature-first import rules (design doc §Repository layout).
6. Add `shared/utils`: `Clock` interface + `systemClock`, `IdGenerator` (uuid) + `fakeIdGenerator`, with unit tests.
7. Smoke artifacts: `+page.svelte` renders "ShotCoach" heading; one component test asserts it; one unit test for `Clock`.

**Validate**:
```bash
npm run verify --workspace=shotcoach
npm test              # root: library tests still pass
```
Also assert: `app/build/index.html` exists after build (SPA fallback).

## Step 2 — Capacitor shell

**Goal**: Capacitor 7 wraps the built app; native projects committed; `cap sync` clean.

**Tasks**:
1. Add `@capacitor/core`, `@capacitor/cli`, plugins: `@capacitor/filesystem`, `@capacitor/haptics`, `@capacitor/app`, `@capacitor/screen-orientation`, `@capacitor-community/keep-awake`. `capacitor.config.ts`: appId `com.shotcoach.app`, `webDir: "build"`.
2. `npx cap add android && npx cap add ios`; commit generated projects. Add Android camera/storage permissions and iOS `NSCameraUsageDescription` now.
3. `shared/config/platform.ts`: `isNative()`, `isWeb()` helpers wrapping `Capacitor.getPlatform()`, unit-tested via injected platform value.
4. Scripts: `cap:sync` (`npm run build && npx cap sync`).

**Validate**:
```bash
npm run verify --workspace=shotcoach
npm run cap:sync --workspace=shotcoach   # exits 0
git status --porcelain | wc -l           # everything committed after commit step
```

## Step 3 — Playwright e2e harness

**Goal**: e2e infrastructure exists and gates future steps.

**Tasks**:
1. Add `@playwright/test`; `playwright.config.ts`: webServer = `vite preview --port 4173` (after build), Chromium only, `executablePath` honoring the preinstalled browser env (`PLAYWRIGHT_BROWSERS_PATH`), trace on retry.
2. `src-tests/e2e/smoke.spec.ts`: app loads, "ShotCoach" visible, no console errors.
3. Script `test:e2e` = `playwright test`. Document the full gate in `app/README.md`.

**Validate**:
```bash
npm run verify --workspace=shotcoach && npm run test:e2e --workspace=shotcoach
```

---

# Phase 1 — Data Layer

## Step 4 — DatabaseAdapter + Node driver + migration runner

**Goal**: portable SQLite abstraction with a tested migration system.

**Tasks** (`app/src/lib/shared/db/`):
1. `adapter.ts`: 
   ```ts
   interface DatabaseAdapter {
     run(sql: string, params?: SqlValue[]): Promise<{ changes: number; lastId?: number }>;
     query<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
     transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
     close(): Promise<void>;
   }
   ```
2. `drivers/better-sqlite3.ts` (devDependency, test/Node only): in-memory or file-backed implementation incl. nested-transaction guard (savepoints or single-level with error).
3. `migrations/index.ts`: migrations as ordered `{ version, name, up: string[] }` TS modules; `migrate(db)` applies pending in a transaction each, records in `schema_migrations`.
4. Migration `001-initial-schema` containing the **entire schema v1 from the design doc** (all tables + indexes, verbatim semantics).
5. Tests: adapter CRUD + transaction rollback on throw; migrate from empty applies all and is idempotent; partial-failure migration rolls back (inject a bad statement in a test-only migration); every table from the design doc exists with expected columns (introspect `pragma table_info`).

**Validate**: `npm run verify --workspace=shotcoach` (includes the new db test suite; expect ≥ 12 assertions in this area).

## Step 5 — Capacitor & web drivers + startup wiring

**Goal**: real drivers for device (capacitor plugin) and web (sql.js), selected by platform; app boots the DB and runs migrations.

**Tasks**:
1. Add `@capacitor-community/sqlite` + `jeep-sqlite` (web) + `sql.js`. `drivers/capacitor-sqlite.ts` and `drivers/sqljs-web.ts` implementing `DatabaseAdapter` (web persists to IndexedDB via the plugin's web mechanism or manual export; document choice).
2. `createDatabase(platform): Promise<DatabaseAdapter>` factory; called once in `+layout.svelte` boot sequence → runs `migrate` → stores in `AppServices` context. Show a boot error screen on failure.
3. `AppServices` container skeleton (`shared/config/services.ts`) with `createAppServices()` and `createTestServices()` (fakes/in-memory) per design doc §Dependency injection.
4. Unit tests: factory picks correct driver per platform (drivers mocked); sql.js driver passes the same adapter contract test suite as better-sqlite3 (extract a shared `adapterContractTests(makeDb)` helper and run it against both).
5. E2E: `db.spec.ts` — app boots on web, a `data-testid="db-ready"` marker appears; write a setting via a hidden debug hook or the settings repo through UI-less page, reload, value persists.

**Validate**: full gate + `test:e2e`.

## Step 6 — Repositories + settings/player persistence

**Goal**: typed repos for every table; settings + player flows usable.

**Tasks** (repo files live in their owning feature; generic base in `shared/db/repo-base.ts`):
1. Implement repos with interfaces + factories: `PlayerRepo`, `VideoRepo`, `SessionRepo`, `ShotRepo` (writes `shots` + `shot_metrics` in one transaction from a `ShotAnalysis`), `ScoreRepo`, `BenchmarkRepo`, `FocusAreaRepo`, `DrillRepo`, `PlanRepo` (+ items), `RepRepo`, `SettingsRepo` (typed get/set with Zod-parsed values).
2. Mapping helpers: `ShotAnalysis` ⇄ row (JSON source of truth + normalized `shot_metrics` projection) with round-trip tests using a hand-built `ShotAnalysis` fixture (import library types from `basketball-shot-analysis`).
3. Tests (better-sqlite3, in-memory): CRUD per repo; `ShotRepo.saveAnalysis` writes consistent `shots`/`shot_metrics` rows and rolls back atomically on failure; `SettingsRepo` type safety.

**Validate**: full gate; run `npx vitest run src/lib --coverage` and confirm `shared/db` + repos ≥ 85% line coverage (record number in commit message).

---

# Phase 2 — Analysis Engine Integration

## Step 7 — Library consumption + ReplayAnalysisService (the test backbone)

**Goal**: the app can produce real `AnalysisResult`s deterministically from recorded pose fixtures — no MediaPipe needed.

**Tasks**:
1. Add root library as workspace dep: in `app/package.json`, `"basketball-shot-analysis": "*"`. Ensure the library builds (`npm run build` at root) and its ESM output imports cleanly in Vitest and Vite (may require `optimizeDeps`/`ssr.noExternal` tweaks — document in `app/docs/deviations.md` if needed).
2. `features/analysis/types.ts`: `AnalysisService`, `AnalysisProgress`, `LiveAnalysisSession` interfaces per design doc.
3. `features/analysis/replay/replay-analysis-service.ts`: loads pose-sequence JSON (same shape as repo `test-data/*/poses.json`), converts to the library's landmark format, drives `ShotDetector.processFrames` + `MetricOrchestrator.analyzeShot` (both are public exports) to produce a real `AnalysisResult` with progress callbacks. Also implements `createLiveSession` by replaying frames on a timer (injected clock) for live-mode tests.
4. Fixture pipeline: script `scripts/build-fixtures.ts` copies 3 curated pose files from repo `test-data/` (pick: one single-shot, one 3–4 shot, one 7-shot, e.g. `20201212_134104`, `20190103_180930`, `20181219_173607`) into `app/src-tests/fixtures/poses/` with a manifest recording expected shot counts from the adjacent `labels.json`.
5. Integration tests: for each fixture, `ReplayAnalysisService.analyzeVideoFile` (accepting a fixture ref in replay mode) detects the expected shot count (±0 vs manifest), every shot has ≥ 15 metrics with confidence > 0, progress events are monotonic, and the result is stable across two runs (deep-equal).

**Validate**: full gate. This step is the foundation for all later e2e — be rigorous.

## Step 8 — Worker-based real AnalysisService (MediaPipe path)

**Goal**: production path — analyze an uploaded video file via `ShotAnalyzer` in a Web Worker; MediaPipe assets bundled.

**Tasks**:
1. `scripts/fetch-mediapipe-assets.ts`: download the tasks-vision WASM bundle + pose landmarker model into `app/static/mediapipe/` (committed or downloaded in postinstall — prefer committed for offline determinism; document size). Library's browser pose detector must be configurable to load from this local path; if its factory hardcodes CDN URLs, this is an **allowed library touch**: add an optional `assetBasePath` to `PoseDetectorConfig` (root change, with library unit test).
2. `features/analysis/worker/analysis.worker.ts`: owns `ShotAnalyzer` (`createShotAnalyzer`); message protocol (`init`, `analyzeFrames` batches, `finalize`, `progress`, `result`, `error`) with Zod-validated messages in `worker-protocol.ts`.
3. `features/analysis/services/worker-analysis-service.ts`: main-thread side — decodes video via library `createVideoElementProvider`, transfers `ImageData` frames to worker, surfaces progress, returns `AnalysisResult`. `createLiveSession` streams downsampled frames (≤ 640px, ~15 fps) from `createMediaStreamProvider`.
4. Frame downsampling util (`shared/media/downsample.ts`) with unit tests (canvas mocked in jsdom).
5. Tests: worker protocol messages round-trip (Zod), service state machine with a **mocked worker** (init → progress → result; error propagation; cancellation mid-analysis). The real MediaPipe path cannot run headless in CI — mark one `test:e2e`-tagged spec `@manual-device` and add it to `app/docs/device-testing.md` checklist.
6. Wiring: `createAppServices` selects `WorkerAnalysisService`; `?e2e=replay` query flag (or `VITE_ANALYSIS_BACKEND=replay`) selects `ReplayAnalysisService` with fixtures served from `static/fixtures/` in dev/preview builds.

**Validate**: full gate + e2e smoke still green with replay flag: a temporary debug route `/__debug/analyze` (test-build only) runs a replay analysis and renders shot count; `analysis.spec.ts` asserts it.

---

# Phase 3 — Scoring, Benchmarks, Diagnosis

## Step 9 — Benchmark schema + placeholder benchmark

**Goal**: versioned benchmark system seeded with `elite-placeholder-v1`.

**Tasks** (`features/benchmarks/`):
1. Zod schema for `BenchmarkProfile` exactly per design doc (incl. `isPlaceholder`, `populationStats`, `displayName/shortCue/category/explanation` per metric).
2. `data/elite-placeholder-v1.json`: cover **all 26 metrics** (design doc lists them). Derive numeric targets from the library's `pro-form` profile (import it and transform in a generation script `scripts/generate-placeholder-benchmark.ts`, committed output). Write player-friendly `displayName`, `shortCue` (≤ 4 words, imperative: "Tuck your elbow"), and 1–2 sentence `explanation` for every metric.
3. `BenchmarkService`: load + validate JSON, seed/upgrade into `benchmarks` table by version, `getActive()`, `list()`.
4. Tests: JSON validates; all 26 metrics present with feedback + cue copy; seeding idempotent; version bump re-seeds; corrupted JSON → typed error.

**Validate**: full gate.

## Step 10 — Scoring engine (rep-level)

**Goal**: pure `features/scoring/engine.ts` producing per-metric scores + Rep Form Score + category breakdown.

**Tasks**:
1. Implement per-metric scoring exactly per design doc formulas (deadband, in-range linear falloff to 0.5, out-of-range to 0; categorical handling; confidence < 0.4 exclusion; side-specific half-range when ideal isn't centered).
2. `scoreRep(shot: ShotAnalysis, benchmark: BenchmarkProfile): RepScore` → `{ formScore, perMetric, perCategory, excludedMetrics, scoringVersion }`.
3. Cue selection: `selectCues(repScore, focusMetric?)` → primary + up to 2 secondary cues using benchmark `shortCue`/feedback direction (tooLow/tooHigh), focus metric prioritized.
4. Golden tests: hand-computed table of ≥ 12 cases (value at ideal → 1.0; at deadband edge; at acceptable bound → 0.5; at 2× range → 0; below-min vs above-max asymmetric ranges; categorical pass/fail; low-confidence excluded and weights renormalized). Property tests: score monotonically non-increasing as |dev| grows; always in [0,1]; formScore in [0,100].
5. Integration: score every shot from the three replay fixtures against the placeholder benchmark → snapshot the rep scores (assert stable and within (0,100) exclusive; commit snapshot).

**Validate**: full gate; scoring module coverage ≥ 95% branches (`vitest --coverage` check, record in commit).

## Step 11 — Session scoring (consistency, efficiency, overall)

**Goal**: session-level aggregation per design doc.

**Tasks**:
1. `scoreSession(reps: RepScore[], shots: ShotAnalysis[], benchmark): SessionScore` — Form (trimmed mean when N ≥ 8), Consistency (CV-based, angle-metric variant, `null` when N < 3), Efficiency (movement-economy subset), Overall (configurable weights), full `breakdown_json`.
2. `ScoringService` facade: `scoreAndPersistShot`, `scoreAndPersistSession` writing via `ScoreRepo` with `scoring_version`.
3. Tests: identical reps → consistency ≈ 100; injected variance lowers it monotonically; N=2 → consistency null and overall re-weighted; efficiency uses only the subset (mutating a non-subset metric doesn't change it); persistence writes both scopes; re-scoring with a new benchmark version creates new rows (history preserved).

**Validate**: full gate.

## Step 12 — Diagnosis engine

**Goal**: ranked focus areas from a scored assessment.

**Tasks** (`features/diagnosis/`):
1. Static `issue-groups.ts` mapping per design doc (Alignment, Rhythm, Release & follow-through, Lower body, Ball path, Guide hand, Posture — every one of the 26 metrics assigned to exactly one group; unit test enforces total coverage).
2. `diagnose(sessionScore, repScores): FocusArea[]` — severity formula per design doc (0.45 dev / 0.30 variance / 0.25 priority), low-confidence filtered, grouped, ranked, top-3 surfaced flag; player-friendly copy assembled from benchmark metadata.
3. `DiagnosisService` persists via `FocusAreaRepo`.
4. Tests: crafted inputs produce expected ranking (e.g., high-priority badly-failing metric outranks low-priority worse one per weights); grouping collapses correlated metrics; deterministic tie-break (alphabetical group id); fixtures → diagnosis snapshot.

**Validate**: full gate.

---

# Phase 4 — App Shell & Assessment Feature

## Step 13 — Design system + app shell + onboarding

**Goal**: navigable app with tab bar, theme, and first-run onboarding persisting a player.

**Tasks**:
1. `shared/ui/`: tokens (CSS custom properties per design doc palette), components: `Button`, `Card`, `ScoreRing` (SVG, color bands), `MetricChip`, `Sheet`, `ProgressBar`, `EmptyState`, `PlaceholderBadge`, `Toast`. Component tests: ScoreRing band colors at 30/60/80/95; MetricChip statuses; PlaceholderBadge renders when `isPlaceholder`.
2. Tab-bar layout (`+layout.svelte`) with the 4 tabs; route stubs for all routes in the design doc nav map; modal-flow layout (no tab bar) for `/onboarding`, `/assess`, `/practice/live`, `/plan/[id]`, `/drill/[id]`.
3. `features/onboarding`: 3-slide intro, player form (name, handedness, level), camera-tutorial slide (static illustrations now), persists `PlayerRepo` + marks setting `onboarded`. Root route redirects to `/onboarding` when not onboarded.
4. `features/home`: Home shows overall-score ring (empty state when no data) + "Start Assessment" CTA.
5. E2E `onboarding.spec.ts`: fresh app → onboarding → complete form → lands Home → reload stays Home (persisted); handedness visible in Profile.

**Validate**: full gate + e2e.

## Step 14 — Assessment wizard (upload → analyze → review)

**Goal**: full assessment pipeline writing sessions/shots/scores/focus areas.

**Tasks** (`features/assessment/`):
1. `AssessmentService.runAssessment(files, onProgress)`: creates `sessions` row (type `assessment`), per file → `videos` row + `analysis.analyzeVideoFile` → persist shots (`ShotRepo.saveAnalysis`) → score reps + session (`ScoringService`) → diagnose (`DiagnosisService`) → complete session. Cancellation + `aborted` status. In replay mode, "files" are fixture refs exposed by a test-only picker.
2. Wizard UI: Add-shots step (file input; on native, Capacitor file picker; store file to app filesystem via `shared/media`), Analyze step (per-video progress, shots-detected ticker, cancel), Review-detections step (shot cards, exclude toggles → `shots.excluded`, excluded shots trigger session re-score), then navigate to results route.
3. Store as a state machine (`idle → picking → analyzing → reviewing → done|aborted`) — unit-test transitions with fake services.
4. Component tests: analyze step renders progress from emitted events; review step exclusion calls re-score.
5. Integration test (Node): `runAssessment` over the 3 fixtures end-to-end → DB contains consistent session/shots/shot_metrics/scores/focus_areas; excluded-shot re-score changes session score.
6. E2E `assessment.spec.ts` (replay mode): complete wizard with the multi-shot fixture → results route reached; DB persists across reload.

**Validate**: full gate + e2e.

## Step 15 — Assessment results + shot detail screens

**Goal**: results UX per design doc.

**Tasks**:
1. Results screen: hero ScoreRing + 3 sub-score bars, Top-issues cards (from focus areas: name, severity, feedback copy, "why it matters"), all-metrics accordion by category (value vs ideal/range, status chip, σ across shots, confidence dimming), per-shot strip, "Build my training plan" CTA (routes to step 17's generator; disabled with tooltip until then), `PlaceholderBadge` on benchmark-derived numbers.
2. Shot detail screen: metric table with frame refs; video scrubber + phase chips *if the source video file is available* (upload flow keeps file URI); pose-skeleton canvas overlay component fed from stored `analysis_json` landmarks at key frames (works in replay mode without video — skeleton on blank court background).
3. Component tests: top-3 ordering respects diagnosis rank; low-confidence rows render dimmed + excluded-from-score note; accordion groups all 26 metrics under the right categories.
4. E2E: after replay assessment, results show a numeric overall score and exactly 3 top-issue cards; navigate to a shot detail and back.

**Validate**: full gate + e2e.

---

# Phase 5 — Drills & Training Plan

## Step 16 — Drill library (placeholder content)

**Goal**: seeded drill catalog + drill player.

**Tasks** (`features/drills/`):
1. Zod `Drill` schema per design doc; author `data/drills.json` with **12 drills** covering every issue group (≥ 1 drill per group; design doc lists examples) — LLM-drafted `coachingPoints` (flag for coach review in Content Needed table), correct `focusMetrics` from the 26, `isPlaceholder: true`.
2. `scripts/make-placeholder-drill-video.ts`: generate `static/drills/placeholder.mp4` (5 s title card; use canvas + MediaRecorder in a Playwright script or ffmpeg if available — pick what works headless, document).
3. `DrillService`: seed/upgrade by version; query by issue group / focus metric / max difficulty.
4. Drill player screen: video element with placeholder asset + badge, coaching points, "what this fixes" chips, sets/reps, "Mark complete" (updates `plan_items` when launched from a plan; standalone otherwise).
5. Tests: schema validation of all 12; every issue group covered (test iterates groups); service queries; component test for player rendering + complete action.
6. E2E: open a drill from a (temporary) drill-list debug route; video element present; mark complete.

**Validate**: full gate + e2e.

## Step 17 — Training plan generator + plan UI

**Goal**: assessment → 2-week adaptive plan block.

**Tasks** (`features/training-plan/`):
1. `generatePlan(focusAreas, playerLevel, sessionsPerWeek = 4): PlanSpec` per design doc rules (drill/live alternation, hardest focus front-loaded, free-shooting every 2nd live session, terminal reassessment item). Pure + deterministic (seeded ordering).
2. `TrainingPlanService`: persist plan + items; `getActivePlan`; `completeItem`; supersede logic (new assessment plan marks prior `superseded`); adaptation rule (rotate improved focus areas out on re-assessment — compare focus severity vs previous assessment, threshold in config).
3. Plan UI: plan overview screen per design doc (focus chips, day-grouped session cards with locked/today/done states); Home "Today" card shows next pending item; results-screen CTA now live: generates plan and navigates.
4. Tests: generator invariants (ends with reassessment; every focus area gets ≥ 2 items; drill difficulty ≤ level; alternation; determinism); supersede + adaptation unit tests; component tests for item states.
5. E2E: assessment → build plan → plan screen shows items → complete first drill → Home Today card advances.

**Validate**: full gate + e2e.

---

# Phase 6 — Live Practice

## Step 18 — LiveRepCoordinator (pure state machine)

**Goal**: the per-rep engine, fully tested without camera/MediaPipe.

**Tasks** (`features/live-practice/coordinator/`):
1. Implement the state machine per design doc (`IDLE → READY → ACTIVE → ANALYZING → FEEDBACK → READY`), consuming a `LandmarkFrame` stream: rolling buffer (cap ~12 s), cheap signals (pose presence for READY; smoothed wrist vertical velocity threshold for ACTIVE; settle when velocity < ε for `settleMs`; `maxRepDurationMs` bail-out), then analysis callback on the buffered window → `RepResult | NoShotDetected`. Config object with the design-doc defaults; injected clock.
2. Emits typed events: `stateChanged`, `repStarted`, `repAnalyzing`, `repResult`, `noShot`, `bufferStats`.
3. Synthetic-stream test helpers: generate landmark sequences (still pose, shot-like wrist arc from a real fixture's single-shot segment, dribble-like noise, walk-through).
4. Tests: full happy-path rep cycle with fake clock; two reps back-to-back with `minRepGapMs`; dribble noise does not trigger ACTIVE→ANALYZING with a shot (analysis returns no shot → `noShot` event → back to READY); pose lost mid-rep → graceful reset; buffer never exceeds cap; `maxRepDurationMs` triggers analysis. Use the replay fixture's real shot segment through `ReplayAnalysisService` to assert an actual `RepResult` with score.

**Validate**: full gate; coordinator coverage ≥ 90% branches.

## Step 19 — Camera capture + setup screen

**Goal**: real camera pipeline and the framing/readiness UX.

**Tasks**:
1. `CaptureService` interface (`shared/media/capture.ts`): `start(constraints) → { stream, stop }`, permission flow (Capacitor-aware), torch/facing enumeration; `FakeCaptureService` for tests (feeds a canvas/`<video>`-element-based stream or drives replay).
2. Setup screen per design doc: full-screen preview, silhouette guide overlay, live readiness checks — full-body (all key landmarks visible for 2 s, via low-rate pose from the live analysis session or replay), side-view (orientation from buffered pose), lighting (mean luma of downsampled frame), stability (devicemotion variance; auto-pass on web). Checks as small pure functions with unit tests; each check overridable. Start button gates on checks; 3-2-1 countdown with beeps (`shared/audio`); keep-awake + orientation lock engaged.
3. `shared/audio/AudioFeedbackService`: beeps (WebAudio) + `speak(text)` (speechSynthesis) + mute setting; `FakeAudio` for tests recording calls.
4. Component tests: checks flip ticks; start disabled→enabled; countdown fires beeps via FakeAudio.
5. E2E (replay mode): setup screen reaches all-green with replay-driven pose and starts a session.

**Validate**: full gate + e2e.

## Step 20 — Live practice loop + session summary

**Goal**: the complete shoot → instant feedback → next rep experience, persisted.

**Tasks**:
1. Session store binds `LiveRepCoordinator` + `AnalysisService.createLiveSession` + `ScoringService` + `AudioFeedbackService`: on `repResult` → score rep, `selectCues` (plan focus metric if launched from a plan item), persist (`sessions`/`shots`/`reps` rows, async off interaction path), update running average.
2. Practice UI per design doc: idle banner + rep counter + mini average ring; "Analyzing…" pulse; rep feedback card (giant score, delta, primary cue large, ≤ 2 secondary chips) auto-dismiss ~4 s with spoken score+cue; corner controls (pause, end, mute, rep drawer with per-rep list → detail); focus header when applicable; "not a shot?" affordance on feedback → marks shot `excluded` + re-averages.
3. Session summary screen per design doc: session ScoreRing, rep bar chart (in-house SVG chart components in `shared/ui/charts` — build `LineChart`, `BarChart`, `BandChart` now with component tests), focus-metric trend, best/worst jump, improved/appeared issue list (compare first-half vs second-half rep metric means), plan-item completion + re-assess prompt when block finished.
4. Tests: store reacts to coordinator events (fake coordinator) — persistence calls, average math, focus-cue prioritization, exclusion re-average; chart components render expected SVG for known data; summary improved/appeared logic unit-tested.
5. E2E `live-practice.spec.ts` (replay mode, fake capture): start from plan item → 3 replayed reps → three feedback cards appeared (assert via test hooks/data-testids) → end session → summary shows 3 reps + session score → plan item marked done → data persists across reload.

**Validate**: full gate + e2e.

---

# Phase 7 — Progress & Re-assessment

## Step 21 — Progress dashboards

**Goal**: trends and history per design doc.

**Tasks** (`features/progress/`):
1. `ProgressService` queries: score history (session-scope scores over time, per sub-score), per-metric trend (mean ± σ per session from `shot_metrics`), totals/streaks. SQL with tests against seeded in-memory DB (seed helper creating a realistic 6-session history).
2. Progress screens: overall line chart with assessment markers, sub-score toggles; metric explorer (picker → BandChart vs benchmark band); session history list → existing session/shot detail routes; streak + totals header.
3. Component tests with seeded fake service; E2E: after the e2e journey so far (assessment + live session), Progress shows ≥ 2 sessions and a chart with points.

**Validate**: full gate + e2e.

## Step 22 — Re-assessment + plan adaptation loop

**Goal**: close the loop: reassessment item → new assessment → compared results → adapted plan.

**Tasks**:
1. Reassessment plan item launches the assessment wizard tagged with `plan_item_id`; on completion: marks item done, computes deltas vs the plan's source assessment (overall + per focus area), generates the next plan block via the step-17 adaptation rule, supersedes the old plan.
2. Results screen gains a "since last assessment" delta strip (▲/▼ per sub-score and per previous focus area) when a prior assessment exists.
3. Tests: service-level loop test (assessment A → plan → fake improvement in fixture-scored assessment B → adapted plan rotates focus; deltas correct sign); component test for delta strip.
4. E2E: run second replay assessment via the plan's reassessment item → new plan exists, old superseded, deltas visible.

**Validate**: full gate + e2e.

---

# Phase 8 — Hardening & Release Readiness

## Step 23 — Full journey e2e, error paths, accessibility, budgets

**Tasks**:
1. `journey.spec.ts`: single spec covering onboarding → assessment → results → plan → drill → live practice → summary → progress → re-assessment (replay mode). This is the app's contract test.
2. Error-path e2e/unit: zero-shots video → coaching empty state; analysis worker error → retry affordance; DB boot failure screen; low-confidence session warning banner (< 0.5 avg) per design doc.
3. Accessibility pass: `@axe-core/playwright` on all main screens — no serious/critical violations; focus management in modal flows; `prefers-reduced-motion` respected (disable pulse animations).
4. Performance budgets in CI: `vite build` bundle report — initial JS ≤ 350 KB gzip (MediaPipe + worker lazy-loaded, enforce via a size-check script); Lighthouse-style TTI proxy optional.
5. Ensure `PlaceholderBadge` appears wherever benchmark/drill placeholder data is shown (grep-driven audit + e2e assertions).

**Validate**: full gate + complete e2e suite + size-check script exit 0.

## Step 24 — Native packaging + docs + handoff

**Tasks**:
1. `npm run cap:sync` clean; app icons/splash from a generated placeholder set (`@capacitor/assets`); verify Android debug build **if** SDK present (`cd android && ./gradlew assembleDebug`) — otherwise document as manual step. iOS documented as manual (macOS required).
2. `app/docs/device-testing.md`: manual checklist — real camera live session, MediaPipe fps measurement vs budget, iOS camera permission flow, filesystem persistence, TTS voices.
3. `app/README.md` final: setup, scripts, architecture pointer, replay/e2e modes, content-needed table copied from design doc, deviations log link.
4. Final sweep: `npm run verify` at root (library) and app; every route reachable; remove debug routes from production build (`import.meta.env` guard verified by a build-output grep test).

**Validate**:
```bash
npm test                                   # root library
npm run verify --workspace=shotcoach
npm run test:e2e --workspace=shotcoach
npm run cap:sync --workspace=shotcoach
```
All green → the implementation is complete. Push the branch.

---

## Step dependency graph (parallelization hints for multi-agent execution)

```
1 → 2 → 3
1 → 4 → 5 → 6
1 → 7 → 8
{6,7} → 9 → 10 → 11 → 12
{3,6} → 13 → 14 → 15
{9,13} → 16 → 17
{7,10} → 18 ; {13,18} → 19 → 20
{11,14,20} → 21 → 22 → 23 → 24
```

## Definition of Done (whole project)

- All 24 steps committed, every validation gate green, branch pushed.
- `journey.spec.ts` passes: a user can assess, get a score + diagnosis, follow a generated plan, do live practice with per-rep feedback, re-assess, and see progress — entirely on-device.
- All placeholder content flagged in-app and inventoried in the design doc's Content Needed table.
