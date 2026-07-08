# ShotCoach — Basketball Shooting Form Training App: Design Document

## Executive Summary

ShotCoach is a mobile-first training app (SvelteKit + Capacitor + TypeScript + SQLite) that turns the existing `basketball-shot-analysis` TypeScript library into a complete training aid. Players record their shots — either by uploading videos for a full assessment or by shooting live in front of their phone camera — and receive immediate, metric-driven feedback on their form. The app scores form against benchmark profiles (placeholder data until real elite-shooter data is collected), diagnoses the highest-impact issues based on **consistency, simplicity, and efficiency of movement**, generates a personalized training plan combining video drills and live practice sessions, and tracks progress over time through re-assessments.

Everything runs **on-device**: pose detection (MediaPipe WASM in the webview), analysis (existing library), storage (SQLite). There is no required server. The architecture is **feature-first** so all code for a feature lives in one folder tree — optimized for LLM-driven development.

## Product Vision

> The ultimate shooting form training aid: a pocket shooting coach that sees every rep, tells you the one thing to fix right now, and proves you're improving.

Core loop:

```
Assess (upload shots) → Understand (score + diagnosis) → Train (drills + live practice
with instant per-rep feedback) → Re-assess (upload again) → See progress → repeat
```

## Target Users

- **Primary**: Youth → high-school basketball players (ages 8–18) practicing alone or with a parent.
- **Secondary**: Coaches/trainers reviewing player assessments.
- **Environment**: Driveway/gym, phone on a tripod or leaned against an object, side-view of the shooter, possibly noisy lighting. Sessions of 10–50 reps.

## Relationship to the Existing Library

The app consumes the library in this repo (`basketball-shot-analysis`) as a workspace package. What the library already provides (do **not** reimplement in the app):

| Capability | Library API |
|---|---|
| Pose detection (browser, MediaPipe WASM) | `createPoseDetector` via `ShotAnalyzer` |
| Frame providers | `createVideoElementProvider` (uploaded files), `createMediaStreamProvider` (live camera) |
| Batch video analysis | `ShotAnalyzer.analyzeVideo(provider)` → `AnalysisResult` |
| Live incremental analysis | `ShotAnalyzer.processFrame(frame)` / `finalizeLiveSession()` |
| Shot/phase detection | `ShotDetector` (gather → load → rise → setPoint → release → followThrough) |
| 26 metrics in 6 categories | shooting arm, guide arm, ball, lower body, posture, timing |
| Form profiles + feedback text | `FormProfile`, `ProfileComparisonEngine`, built-ins: `youth-fundamentals`, `high-school`, `pro-form` |
| Orientation detection | per-shot `orientation` on `ShotAnalysis` |

The 26 metric names the app builds on:

`shootingElbowFlare, shootingElbowAngle, maxArmExtension, wristSnapAngle, followThroughHold, guideElbowFlare, guideHandPosition, guideHandRelease, ballDip, ballPath, setPointHeight, setPointDuration, releasePoint, releaseAngle, ballBehindHead, handCupVsHinge, hipDrop, kneeFlexion, legExtensionStart, backPosture, headTilt, shoulderAlignment, ballRiseStart, legRiseStart, ballLegSync, releaseStart, totalShotDuration`

What the app adds on top:

1. **Scoring engine** — converts `ShotAnalysis` + benchmark into a 0–100 Form Score, plus Consistency / Simplicity / Efficiency sub-scores.
2. **Benchmark system** — versioned benchmark profiles with population statistics (placeholder until real elite-shooter data exists).
3. **Diagnosis + training-plan engine** — ranks issues, maps them to drills and live-practice focus.
4. **Live rep coordinator** — wraps the library's live API into a robust per-rep state machine with instant feedback.
5. **Persistence, progress tracking, and all UI/UX.**

### Known library constraint the app must design around

`ShotAnalyzer.processFrame()` re-runs shot detection over the full accumulated frame history on every frame (O(n²) over a session). The app therefore does **not** feed an entire live session through `processFrame`. Instead the app's `LiveRepCoordinator` (see below) buffers landmarks per rep, detects "motion settled" cheaply, then runs finalization on the bounded rep window and resets the analyzer session between reps. If this proves insufficient, a small library enhancement (incremental detection) is an identified follow-up — but the app-side design works without touching the library.

---

## UX / UI Design

### Design principles

1. **One number, one cue.** After every rep the player sees a rep score and at most one primary coaching cue ("Tuck your elbow"). Detail is always one tap away, never in the way.
2. **Hands-free during practice.** During live practice the player is 12+ feet from the phone. Feedback must be legible at distance (huge type, color) and audible (speech synthesis of the cue + score). Auto-advance to the next rep — no touching the phone between reps.
3. **Honest confidence.** Every metric carries a confidence value from the library. Low-confidence measurements are visually de-emphasized and excluded from scoring rather than presented as fact.
4. **Progress is the product.** Every screen reinforces trend: score deltas, streaks, before/after.
5. **Placeholder content is labeled.** Benchmarks and drill videos are placeholders; the UI marks them with a subtle "sample data" badge so nobody mistakes them for real elite data.

### Visual design

- **Theme**: dark-first (gyms, evening driveways), high-contrast. Palette: near-black surface `#0F1115`, card `#1A1E26`, primary orange `#FF7A29` (basketball), success green `#3DDC84`, warn amber `#FFC24B`, fail red `#FF5C5C`, text `#F2F4F8`/`#98A2B3`.
- **Type**: system font stack; score numerals in a heavy weight, tabular numerals for metrics.
- **Score ring**: circular gauge 0–100 used everywhere a score appears (rep, session, overall). Color bands: 0–49 red, 50–69 amber, 70–84 green, 85–100 elite gradient.
- **Metric status chips**: pass ● green / warning ● amber / fail ● red / low-confidence ○ gray outline.
- Components live in `src/lib/shared/ui/` (Button, Card, ScoreRing, MetricChip, Sheet, ProgressBar, VideoPlayer, EmptyState, PlaceholderBadge, Toast).

### Navigation map

Bottom tab bar (4 tabs) + modal flows:

```
├── Home (Train)                    /
│   ├── Active plan "Today" card → session detail
│   ├── Overall Form Score ring + trend sparkline
│   └── CTA: Start Assessment (if no plan) / Continue Training
├── Practice                        /practice
│   ├── Live Practice → /practice/live (full-screen modal flow)
│   └── Upload Shots  → /assess (full-screen modal flow)
├── Progress                        /progress
│   ├── Score history charts (overall + per category)
│   ├── Session list → /progress/session/[id]
│   └── Shot detail  → /progress/shot/[id]
└── Profile                         /profile
    ├── Player settings (handedness, level profile)
    ├── Benchmark info (with placeholder badge)
    └── Data management (export/delete)

Modal flows (no tab bar):
/onboarding            first-run: name, handedness, level, camera-setup tutorial
/assess                multi-video upload assessment wizard
/assess/results/[id]   assessment results + diagnosis
/plan/[id]             training plan overview
/drill/[id]            drill player (video + instructions)
/practice/live         live practice session
/practice/summary/[id] live session summary
```

### Screen-by-screen

#### Onboarding (`/onboarding`)
1. Welcome → value proposition (3 slides).
2. Player profile: name, shooting hand (L/R), level (youth / high-school / advanced → maps to library profile and starting benchmark).
3. Camera setup tutorial: illustrated guide — phone at hip-to-chest height, ~10–15 ft to the side of the shooter, full body + arc apex in frame. Interactive framing check reused from live practice setup.
4. Ends at Home with the "Start your first assessment" CTA.

#### Assessment wizard (`/assess`)
Step 1 — *Add shots*: pick 1–10 videos from library/files (each may contain multiple shots). Shows per-file thumbnail, duration, and a running "detected shots" count as analysis completes.
Step 2 — *Analyze*: sequential on-device analysis with per-video progress bar (frames processed / total), cancellable. Runs in a Web Worker; UI shows live phase ticker ("Detecting pose… 42%").
Step 3 — *Review detections*: list of detected shots with key-frame thumbnails; user can exclude false positives (e.g., passes) before scoring.
Step 4 — *Results* → routes to `/assess/results/[id]`.

Empty/edge states: video with 0 shots detected → coaching card about camera placement; low-confidence session (< 0.5 average) → warn and suggest re-record rather than presenting garbage numbers.

#### Assessment results (`/assess/results/[id]`)
- Hero: overall **Form Score** ring + sub-score bars (Form / Consistency / Efficiency-Simplicity).
- **Top issues** (max 3): card per issue — metric plain-English name, severity, mini-diagram, the library's feedback string, and "why it matters" copy. Ordered by the diagnosis engine.
- **All metrics** accordion grouped by category (Shooting Arm, Guide Arm, Ball Path, Lower Body, Posture, Timing) — each row: name, your value vs benchmark ideal/range, status chip, consistency (σ across shots), confidence.
- **Per-shot strip**: horizontal cards per detected shot (score, orientation, confidence) → shot detail.
- Primary CTA: **"Build my training plan"** → generates plan → `/plan/[id]`.

#### Shot detail (`/progress/shot/[id]`)
- Video scrubber pinned to key frames (phase chips: Gather / Dip / Rise / Set / Release / Follow-through jump the scrubber).
- Pose-skeleton overlay toggle (landmarks rendered on canvas above the video at the analyzed frames).
- Full metric table for this shot with frame references (tapping a metric seeks video to its frame).

#### Training plan (`/plan/[id]`)
- Plan header: focus areas (chips), duration (e.g., "2-week block, 8 sessions"), progress bar.
- Session list grouped by day: each session = warm-up drill(s) + focused live practice (target rep count + focus metric) or drill-only day; final item is always **Re-assessment**.
- Session card states: locked / today / done (with session score).

#### Drill player (`/drill/[id]`)
- Video player (placeholder video asset + `PlaceholderBadge`), title, coaching points list, "what this fixes" (linked metrics), sets/reps, "Mark complete" (optionally followed by a quick live-practice block to verify).

#### Live practice (`/practice/live`) — the heart of the app
Three sub-states in one full-screen flow:

1. **Setup**: full-screen camera preview with framing overlay — a human silhouette guide box; live checks with green ticks: *full body visible*, *side view detected* (orientation from a few seconds of pose), *good lighting* (mean luma), *phone stable* (devicemotion variance). "Start" enables when checks pass (overridable). Countdown 3-2-1 with beeps.
2. **Practice loop** (landscape or portrait, distance-legible):
   - Idle banner: "Take your shot" + rep counter (`Rep 7`) + session running average ring (small).
   - The coordinator detects the shot automatically. During analysis (~1–2 s): "Analyzing…" pulse.
   - **Rep feedback** (auto-shown ~4 s, spoken aloud): giant rep score (e.g., **78**), delta vs session average (▲ +4), ONE primary cue in large text ("Hold your follow-through"), plus up to two secondary chips. Then auto-returns to idle for the next rep. Every metric of every rep is persisted regardless of what's surfaced.
   - Persistent controls (small, corner): pause, end session, mute voice, rep list drawer (swipe up: per-rep scores, tap for detail).
   - If the session has a plan focus metric, feedback prioritizes that metric's cue and the header reads "Focus: Elbow alignment".
3. **Session summary** (`/practice/summary/[id]`): session score ring, rep-score bar chart, focus-metric trend across reps, best/worst rep quick-jump, "issues that improved / appeared", CTA "Done" (marks plan item complete) and "Re-assess with full video" prompt when the plan block is finished.

#### Progress (`/progress`)
- Overall score line chart over time with assessment markers; toggle per sub-score and per metric-category.
- Per-metric trend explorer: choose a metric → chart of mean ± σ per session vs benchmark band.
- Session history list (assessments and practices), streak counter, totals (reps analyzed, sessions).

#### Profile (`/profile`)
- Player settings (name, handedness — re-runs config), level/profile selection, benchmark selection (only placeholder available; labeled), voice feedback toggle, units, data export (JSON), delete data.

### Audio & haptics

- Rep feedback spoken via Web Speech API (`speechSynthesis`) — score + primary cue. Toggleable.
- Beeps for countdown and shot-detected acknowledgment; haptics (Capacitor Haptics) on rep detection when in hand.

---

## System Architecture

### High-level

```
┌────────────────────────────── Capacitor Shell (iOS / Android) ─────────────────────────────┐
│  ┌──────────────────────────── WebView: SvelteKit SPA (adapter-static, ssr=false) ───────┐ │
│  │  Routes (thin) → Feature modules (UI + stores + services + repos)                     │ │
│  │        │                                                                              │ │
│  │        ├── Analysis Worker (Web Worker)                                               │ │
│  │        │     └── basketball-shot-analysis lib → MediaPipe WASM (bundled in static/)   │ │
│  │        ├── SQLite (via DatabaseAdapter)                                               │ │
│  │        │     ├── native: @capacitor-community/sqlite                                  │ │
│  │        │     └── web dev/test: sql.js (jeep-sqlite) / better-sqlite3 (Node tests)     │ │
│  │        └── Filesystem (Capacitor Filesystem): recorded/uploaded videos                │ │
│  └────────────────────────────────────────────────────────────────────────────────────── │ │
│  Native plugins: Camera permissions, Filesystem, Haptics, KeepAwake, ScreenOrientation    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Local-first, no server.** All inference and data stay on device. A future sync backend (accounts, coach sharing, cloud benchmark updates) is accommodated by the repository pattern: every repo is an interface, so a `RemoteSyncDecorator` can be layered in later without touching features. The only "backend" contracts defined now are (a) the SQLite schema and (b) the benchmark/drill content JSON schemas, which double as the future API payload shapes.

### Stack decisions

| Concern | Choice | Rationale |
|---|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes), `adapter-static`, `ssr=false` | SPA required by Capacitor; runes give simple typed reactive stores |
| Native shell | Capacitor 7 | Required; plugins: sqlite, filesystem, haptics, keep-awake, screen-orientation, app |
| Language | TypeScript strict everywhere | Matches library |
| DB | SQLite via `@capacitor-community/sqlite`; `better-sqlite3` in Node tests; `sql.js`/jeep-sqlite on web | One `DatabaseAdapter` interface, three drivers |
| Camera | `getUserMedia` in webview + library `MediaStreamProvider` | Library already supports it; works on iOS ≥14.3 / Android webview |
| Video upload | `<input type="file">` / Capacitor FilePicker + library `VideoElementProvider` | Library already supports it |
| Pose/analysis | Library in a **Web Worker** (OffscreenCanvas frame transfer) | Keeps UI responsive during heavy inference |
| Charts | Lightweight in-house SVG chart components | Avoid heavy deps; needs are simple (line, bar, band) |
| Unit/component tests | Vitest + @testing-library/svelte + jsdom | Matches library tooling |
| E2E | Playwright (web build, Chromium preinstalled), fake camera via launch flags | Deterministic with fixtures |
| Lint/format | Prettier + eslint (svelte plugin) | Matches repo |

### Repository layout (monorepo via npm workspaces)

```
/ (repo root — existing library, becomes workspace "basketball-shot-analysis")
├── package.json               # workspaces: ["app"], scripts proxying to app
├── src/ …                     # existing library (unchanged)
└── app/                       # NEW: SvelteKit + Capacitor app, workspace "shotcoach"
    ├── package.json
    ├── svelte.config.js / vite.config.ts / capacitor.config.ts / tsconfig.json
    ├── playwright.config.ts / vitest.config.ts
    ├── static/
    │   ├── mediapipe/         # WASM + pose model assets (bundled, offline-first)
    │   └── drills/            # placeholder drill thumbnails/videos
    ├── src/
    │   ├── routes/            # THIN — compose feature components only, no logic
    │   │   ├── +layout.ts     (ssr=false, csr=true)
    │   │   ├── +layout.svelte (tab bar, providers/context init)
    │   │   ├── +page.svelte               → features/home
    │   │   ├── onboarding/+page.svelte    → features/onboarding
    │   │   ├── assess/…                   → features/assessment
    │   │   ├── practice/…                 → features/live-practice
    │   │   ├── plan/[id]/…                → features/training-plan
    │   │   ├── drill/[id]/…               → features/drills
    │   │   ├── progress/…                 → features/progress
    │   │   └── profile/+page.svelte       → features/profile
    │   ├── lib/
    │   │   ├── features/      # FEATURE-FIRST: everything for a feature in one tree
    │   │   │   ├── onboarding/
    │   │   │   ├── home/
    │   │   │   ├── assessment/
    │   │   │   │   ├── components/   (UploadStep.svelte, AnalyzeStep.svelte, …)
    │   │   │   │   ├── services/     (assessment-service.ts)
    │   │   │   │   ├── repo/         (assessment-repo.ts)
    │   │   │   │   ├── stores/       (assessment-store.svelte.ts)
    │   │   │   │   ├── types.ts
    │   │   │   │   └── __tests__/
    │   │   │   ├── analysis/         # analyzer wrapper: worker, providers, replay
    │   │   │   ├── scoring/          # pure scoring engine + types
    │   │   │   ├── benchmarks/       # schema, loader, data/ (placeholder JSON)
    │   │   │   ├── diagnosis/        # issue ranking engine
    │   │   │   ├── training-plan/    # plan generator + plan UI
    │   │   │   ├── drills/           # drill library + player, data/drills.json
    │   │   │   ├── live-practice/    # LiveRepCoordinator, setup checks, session UI
    │   │   │   ├── progress/
    │   │   │   └── profile/
    │   │   └── shared/
    │   │       ├── db/        # DatabaseAdapter, drivers, migrations/, migrate.ts
    │   │       ├── ui/        # design-system components
    │   │       ├── media/     # file storage helpers, video thumbnailing
    │   │       ├── audio/     # speech + beeps
    │   │       ├── config/    # app config, feature flags
    │   │       └── utils/
    │   └── app.css / app.d.ts / app.html
    ├── src-tests/e2e/         # Playwright specs + fixtures
    ├── android/  ios/         # Capacitor projects (generated, committed)
    └── scripts/               # asset download, fixture generation
```

**Feature-first rules** (enforced by convention + lint):
1. A feature folder contains *all* of its components, stores, services, repos, types, and tests.
2. Features may import from `shared/` and from other features **only via that feature's `index.ts` public barrel** — never deep paths.
3. Routes contain zero business logic; they mount feature components and pass route params.
4. Every service/repo is exported as an interface + factory so tests can substitute fakes.
5. Cross-cutting orchestration (e.g., "assessment complete → generate plan") lives in the *initiating* feature's service, calling the other feature's public API.

### Dependency injection / composition

A single `AppServices` container is built at startup in `+layout.svelte` (and in tests by `createTestServices()`), exposed via Svelte context:

```ts
interface AppServices {
  db: DatabaseAdapter;
  analysis: AnalysisService;        // features/analysis
  scoring: ScoringService;          // features/scoring
  benchmarks: BenchmarkService;
  diagnosis: DiagnosisService;
  planner: TrainingPlanService;
  drills: DrillService;
  media: MediaStorageService;
  audio: AudioFeedbackService;
  repos: { player; session; shot; score; plan; drill; rep; settings };
  clock: Clock;                     // injectable time for tests
}
```

---

## Analysis Integration Design (`features/analysis`)

### AnalysisService

```ts
interface AnalysisService {
  /** Analyze an uploaded/recorded video file end-to-end (runs in worker). */
  analyzeVideoFile(file: Blob, opts: AnalyzeOptions, onProgress?: (p: AnalysisProgress) => void): Promise<AnalysisResult>;
  /** Create a live session bound to a MediaStream (worker-backed). */
  createLiveSession(opts: AnalyzeOptions): LiveAnalysisSession;
}

interface AnalyzeOptions { shootingHand: "left" | "right"; profile: string; }
interface AnalysisProgress { framesProcessed: number; totalFrames?: number; shotsDetected: number; phase: "loading" | "detecting" | "extracting"; }
```

Implementation details:
- The worker (`analysis.worker.ts`) owns the `ShotAnalyzer`. Frames are decoded on the main thread by the library providers? No — for uploads, the worker receives the `File`, uses an `OffscreenCanvas` + `VideoDecoder`/`<video>` fallback… **Decision:** to stay on the library's proven path, uploads decode on the main thread with `createVideoElementProvider`, and each frame's `ImageData` is transferred to the worker for `detect()`. The worker batches pose detection + shot detection + metrics. If transfer overhead is a problem, revisit with WebCodecs later. Live mode sends downsampled frames (~15 fps, max 640px long edge) — pose quality is sufficient and battery/latency improve.
- **Replay backend for tests**: `AnalysisService` has a second implementation, `ReplayAnalysisService`, driven by the repo's `test-data/*/poses.json` fixtures (recorded MediaPipe landmark sequences). It skips pose detection and drives `ShotDetector.processFrames` + `MetricOrchestrator` directly. This gives byte-deterministic analysis results in unit/component/e2e tests without MediaPipe or real videos. Selected via `AppServices` wiring (`?e2e=replay` query flag in test builds / injected in unit tests).

### LiveRepCoordinator (`features/live-practice`)

State machine wrapping the analyzer for the shoot–feedback–shoot loop:

```
      pose stable            upward wrist motion          motion settled ≥ settleMs
IDLE ───────────────► READY ────────────────────► ACTIVE ─────────────────────► ANALYZING
  ▲                                                                                 │
  │                 feedback shown (auto-dismiss)              rep result / no-shot │
  └────────────────────────────── FEEDBACK ◄────────────────────────────────────────┘
```

- Maintains a rolling landmark buffer (max ~12 s). Cheap per-frame signals (wrist vertical velocity, pose presence) drive READY→ACTIVE→settled transitions — no full shot detection per frame.
- On settle, runs the library's shot detection + metrics on the buffered window only (bounded cost per rep), emits `RepResult { shotAnalysis, repScore, cues }` or `NoShotDetected`.
- Emits typed events consumed by the UI store; fully unit-testable with synthetic landmark streams and a fake clock (no camera, no MediaPipe).
- Config: `settleMs` (default 900), `minRepGapMs`, `maxRepDurationMs`, buffer caps.

---

## Scoring System (`features/scoring`) — pure, deterministic, heavily tested

### Per-metric score (0–1)

For numeric metric *m* with benchmark target `{ideal, acceptable: {min,max}}`:

```
halfRange = (max − min) / 2                       (use side-specific half-range if ideal isn't centered)
dev       = |value − ideal|
score(m)  = 1                                if dev ≤ deadband (10% of halfRange)
          = 1 − 0.5·(dev − deadband)/(halfRange − deadband)   while inside acceptable   → [0.5, 1]
          = 0.5·max(0, 1 − (dev − halfRange)/halfRange)       outside acceptable        → [0, 0.5)
```

Categorical metrics (`guideHandPosition`, `handCupVsHinge`): 1 if in accepted set, else 0.25.
Metrics with `confidence < 0.4` are **excluded** (not zeroed) and flagged `lowConfidence`.

### Rep Form Score (0–100)

Weighted mean of per-metric scores × 100. Weight = priority weight (high 3, medium 2, low 1) × confidence. Also produces a per-category breakdown (the 6 metric categories) for the results UI.

### Session scores (across N reps)

- **Form** = mean of rep form scores (trimmed 10% if N ≥ 8).
- **Consistency** = 100 × weighted mean over metrics of `exp(−k·CV_m)` where `CV_m` is the coefficient of variation of metric *m* across reps (angle metrics use σ/halfRange instead of σ/μ; k calibrated so CV of 0.05 → ≈95, CV of 0.25 → ≈55). Requires N ≥ 3, else `null`.
- **Efficiency & Simplicity** = 100 × weighted mean of the per-metric scores of the *movement-economy subset*: `ballPath` (straightness), `ballDip` (excess dip), `setPointDuration` (no hitch), `totalShotDuration` (compact), `ballLegSync` (kinetic chain timing), `legExtensionStart`, `guideHandRelease` (clean separation).
- **Overall** = `0.5·Form + 0.3·Consistency + 0.2·Efficiency` (weights in config, not hardcoded).

All formulas live in `features/scoring/engine.ts` with golden-value unit tests; a `ScoreBreakdown` JSON blob is persisted so historical scores remain explainable even if formulas evolve (breakdowns are versioned with `scoringVersion`).

## Benchmarks (`features/benchmarks`) — PLACEHOLDER DATA

```ts
interface BenchmarkProfile {
  id: string;                 // "elite-placeholder-v1"
  name: string;               // "Elite Shooter (sample data)"
  version: number;
  isPlaceholder: boolean;     // true until real data lands — drives UI badge
  basedOn: string;            // provenance note
  targets: Record<MetricName, {
    ideal: number | string;
    acceptable: { min: number; max: number } | string[];
    priority: "high" | "medium" | "low";
    populationStats?: { mean: number; std: number; n: number };  // for future percentile scoring — null in placeholder
    feedback: { tooLow?: string; tooHigh?: string; incorrect?: string };
    displayName: string; shortCue: string; category: MetricCategory; explanation: string;
  }>;
}
```

- Ships as JSON in `features/benchmarks/data/`, validated by a Zod schema at load, seeded into the `benchmarks` table on first run (re-seeded when `version` increases).
- **Placeholder v1** derives its numbers from the library's `pro-form` profile targets, plus `displayName/shortCue/explanation` copy written for players. `populationStats` left null.
- When real elite-shooter data arrives: compute per-metric mean/std → new JSON with `isPlaceholder:false`, bump version; scoring can then switch to percentile-based scoring (`score = f(z-score)`) behind the same interface — this is the only file that changes.

## Diagnosis Engine (`features/diagnosis`)

Ranks what to fix first from an assessment:

```
severity(m) = w_dev·(1 − formScore_m)            // how wrong
            + w_var·(1 − consistencyScore_m)     // how erratic
            + w_pri·priorityWeight(m)            // how much it matters
            weighted defaults: 0.45 / 0.30 / 0.25
```

- Filters out low-confidence metrics; collapses correlated metrics into **issue groups** via a static mapping (e.g., `shootingElbowFlare` + `shoulderAlignment` → "Alignment"; `ballLegSync` + `legRiseStart` + `ballRiseStart` → "Rhythm"; `wristSnapAngle` + `followThroughHold` + `maxArmExtension` → "Release & follow-through") so the player gets themes, not 26 numbers.
- Output: ranked `FocusArea[]` (top 3 surfaced) with severity, contributing metrics, and player-friendly copy. Persisted per assessment for plan generation and progress comparison.

## Training Plan Engine (`features/training-plan`)

Rule-based generator (deterministic, unit-testable):

Inputs: ranked `FocusArea[]`, player level, sessions/week preference (default 4).
Output: a 2-week **plan block**:

- Each focus area gets drill sessions (from drill library, matched by `focusMetrics` overlap and difficulty ≤ player level) and **focused live-practice sessions** (target reps, focus metric for feedback prioritization).
- Ordering: alternate drill / live-practice; hardest focus area front-loaded; every 2nd live session includes a "free shooting" block (no focus) to measure transfer.
- Block always ends with a **Re-assessment** item (upload videos → new assessment → new plan generated, previous plan marked `superseded`).
- Adaptation rule on re-assessment: focus areas that improved ≥ threshold rotate out; regressed/new issues rotate in.

## Drill Library (`features/drills`) — PLACEHOLDER CONTENT

`data/drills.json` (Zod-validated), seeded to DB. ~12 placeholder drills covering the issue groups, e.g. Form Shooting Close Range (alignment), One-Hand Form Shots (release), Wall Sits + Shot Pocket (rhythm/legs), Guide-Hand Discipline drill, Follow-Through Freeze drill. Each entry:

```ts
interface Drill {
  id: string; slug: string; title: string; description: string;
  coachingPoints: string[]; focusMetrics: MetricName[]; issueGroups: string[];
  difficulty: 1 | 2 | 3; durationMin: number; equipment: string[];
  videoUri: string;        // PLACEHOLDER: points to static/drills/placeholder.mp4
  thumbnailUri: string; isPlaceholder: boolean;
}
```

Placeholder video = a generated 5-second MP4 title card ("Drill video coming soon") produced by a build script, so the video player pipeline is fully exercised.

---

## Data Model (SQLite)

Migrations are ordered SQL files in `shared/db/migrations/` applied by a tested runner (`schema_migrations` table). Schema v1:

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  shooting_hand TEXT NOT NULL CHECK (shooting_hand IN ('left','right')),
  level TEXT NOT NULL,                      -- youth | high-school | advanced
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE videos (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
  source TEXT NOT NULL CHECK (source IN ('upload','live')),
  file_uri TEXT, duration_ms INTEGER, fps REAL, width INTEGER, height INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (                     -- one assessment or live-practice occurrence
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
  type TEXT NOT NULL CHECK (type IN ('assessment','live_practice')),
  status TEXT NOT NULL CHECK (status IN ('in_progress','completed','aborted')),
  plan_item_id TEXT REFERENCES plan_items(id),
  focus_metric TEXT, started_at INTEGER NOT NULL, completed_at INTEGER, notes TEXT
);

CREATE TABLE shots (                        -- one analyzed shot/rep
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  video_id TEXT REFERENCES videos(id),
  shot_index INTEGER NOT NULL, orientation TEXT,
  start_frame INTEGER, end_frame INTEGER, overall_confidence REAL,
  excluded INTEGER NOT NULL DEFAULT 0,      -- user-excluded false positive
  analysis_json TEXT NOT NULL,              -- full ShotAnalysis (source of truth)
  created_at INTEGER NOT NULL
);

CREATE TABLE shot_metrics (                 -- normalized for trend queries
  shot_id TEXT NOT NULL REFERENCES shots(id),
  metric_name TEXT NOT NULL,
  value_num REAL, value_text TEXT, unit TEXT, frame INTEGER, confidence REAL,
  PRIMARY KEY (shot_id, metric_name)
);

CREATE TABLE benchmarks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL,
  is_placeholder INTEGER NOT NULL, data_json TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE scores (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('shot','session')),
  ref_id TEXT NOT NULL,                     -- shots.id or sessions.id
  benchmark_id TEXT NOT NULL REFERENCES benchmarks(id),
  scoring_version INTEGER NOT NULL,
  form_score REAL, consistency_score REAL, efficiency_score REAL, overall_score REAL,
  breakdown_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX idx_scores_ref ON scores(scope, ref_id);

CREATE TABLE focus_areas (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  rank INTEGER NOT NULL, issue_group TEXT NOT NULL, severity REAL NOT NULL,
  metrics_json TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE drills (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, version INTEGER NOT NULL,
  is_placeholder INTEGER NOT NULL, data_json TEXT NOT NULL
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
  source_session_id TEXT NOT NULL REFERENCES sessions(id),
  status TEXT NOT NULL CHECK (status IN ('active','completed','superseded')),
  focus_json TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE plan_items (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id),
  day_index INTEGER NOT NULL, position INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('drill','live_practice','reassessment')),
  drill_id TEXT REFERENCES drills(id),
  focus_metric TEXT, target_reps INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending','done','skipped')),
  completed_at INTEGER
);

CREATE TABLE reps (                         -- live-practice rep results
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  rep_index INTEGER NOT NULL, shot_id TEXT REFERENCES shots(id),
  rep_score REAL, primary_cue TEXT, feedback_json TEXT, created_at INTEGER NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
```

Notes: full `ShotAnalysis` JSON is the source of truth (re-scoreable when formulas/benchmarks change); `shot_metrics` is a queryable projection written in the same transaction. Video files live in the Capacitor Filesystem data directory; DB stores URIs. Raw live-practice video is **not** kept by default (storage), only per-rep analysis; a setting can enable keeping rep clips later.

---

## Testing Strategy

Test pyramid, all runnable headlessly in CI (no device, no camera, no MediaPipe):

1. **Unit (Vitest, Node)** — scoring engine (golden values), diagnosis ranking, plan generator, LiveRepCoordinator (synthetic landmark streams + fake clock), migration runner, repos (against `better-sqlite3` in-memory driver), benchmark/drill schema validation. Target: every pure module ≥ 90% branch coverage.
2. **Component (Vitest + @testing-library/svelte, jsdom)** — feature components with fake `AppServices` (score ring renders bands, assessment wizard step transitions, live practice UI reacts to coordinator events, plan list states).
3. **Integration (Vitest, Node)** — `ReplayAnalysisService` over `test-data/*/poses.json` fixtures through scoring + diagnosis + persistence: asserts stable shot counts, score ranges, and full write-path integrity (`analysis → shots → shot_metrics → scores` rows consistent).
4. **E2E (Playwright, Chromium, web build)** — app served via `vite preview` with `?e2e=replay` wiring: onboarding → assessment (fixture) → results → plan generation → drill player → live practice (replay-driven fake camera) → summary → progress. Plus DB persistence across reload (sql.js + IndexedDB).
5. **Native smoke (CI-buildable)** — `npx cap sync` succeeds; Android project assembles in CI when SDK available (documented, optional gate). Real-device camera/perf testing is a manual checklist (documented in `app/docs/device-testing.md`).

Global quality gates (every implementation step must pass): `npm run check` (svelte-check + tsc), `npm run lint`, `npm run test` (unit+component+integration), `npm run test:e2e`, `npm run build`.

---

## Performance Budgets

- Live loop: pose detection ≥ 12 fps sustained on a 2021 mid-range phone (downsample to 640px, worker isolation); rep feedback latency (settle → score on screen) ≤ 2.5 s.
- Upload analysis: ≥ 0.5× realtime (a 60 s video analyzes in ≤ 2 min) with progress UI.
- Cold start ≤ 3 s to Home (MediaPipe loads lazily on first analysis need).
- DB writes off the interaction path (rep persistence is async, batched per rep).

## Privacy

All video and biometric-adjacent pose data stays on device. Explicit copy in onboarding. Data export/delete in Profile. No analytics SDK in v1.

## Content & Data Needed (currently placeholder) — OWNER TODO

| Item | Placeholder now | Needed |
|---|---|---|
| Benchmark metric targets | `elite-placeholder-v1` derived from library `pro-form` profile | Real metrics from footage of elite shooters, run through this same pipeline → per-metric mean/std/n |
| Population stats for percentile scoring | `null` | Same dataset as above |
| Drill videos (~12) | Generated 5 s title-card MP4 | Professionally recorded drill videos matching `drills.json` entries |
| Drill copy review | LLM-drafted coaching points | Coach review/rewrite |
| Sample shot videos for e2e/device testing | Pose-replay fixtures (`test-data/*/poses.json`) | A few real recorded shot videos cleared for repo/CI use |
| Score formula calibration | Reasonable defaults documented above | Tune weights/deadbands against real player data + coach judgment |
| App icon / splash / branding | Generated placeholder | Design assets |

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MediaPipe perf on low-end devices | Downsampling, worker, fps target adaptive; lite model variant configurable |
| Live rep segmentation false positives (passes, dribbles) | Coordinator thresholds + "not a shot?" dismiss affordance; every rep stores full analysis for later exclusion |
| iOS webview camera quirks | Library `MediaStreamProvider` already browser-based; device-testing checklist; Capacitor camera-preview plugin as fallback path (isolated behind `CaptureService`) |
| O(n²) live API in library | App-side per-rep windowing (designed above); optional library enhancement later |
| Placeholder benchmarks mistaken for real | `isPlaceholder` flag drives visible badges everywhere scores appear |
