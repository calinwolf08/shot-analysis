# Follow-up work & production readiness

Recommended work before ShotCoach's Sequencing/Structure scoring is
production-ready, ordered by priority. Companion docs:
[architecture](./architecture.md),
[shot detection & analysis](./shot-detection-and-analysis.md),
[test plan](./test-plan.md), and the root [`README`](../README.md) for the
command reference.

The single biggest unblock is **real NBA side-view clips** — most "placeholder"
caveats below collapse the moment those exist, and the reference/threshold
pipeline just re-runs (see [`README`](../README.md#reference-metrics-pipeline)).

---

## 1. Correctness & data (highest priority)

### 1.1 Gather real, diverse NBA reference clips

The current thresholds and reference skeletons are **placeholders** derived from
`test-data/` side-view clips standing in for pros. With such similar clips,
nearly every metric reads as "tight" (scored) — that is misleading.

- Prefer **side views** (posture/depth metrics need them).
- **3+ clips per player** so per-player spread is measurable.
- Multiple players, varied builds/styles.
- Note each player's shooting hand in `reference-data/players/<player>/player.json`.

Then re-run `npm run metrics:extract && npm run metrics:thresholds` (and
`npm run metrics:reference` for the overlay skeletons). Formats are identical;
no code changes.

### 1.2 Fix the `*.ankles` posture metrics

Ankle posture offset is measured against the **center of the feet**, which _is_
the ankle midpoint — so it's ≈0 by construction and trivially scores 100,
inflating the Structure score with free points.

Options: drop the ankle joint from `POSTURE_JOINTS`
(`src/metrics/v2/structure/posture.ts`); or replace it with **stance width**
(inter-ankle distance, body-scaled) and/or per-ankle offsets. Decide once real
data shows whether stance width discriminates good shooters.

### 1.3 Review and hand-tune thresholds

After 1.1, review `reference-data/out/report.md` (metrics ranked by weight) and
confirm/veto which metrics become _scored_ vs _reported-only_. `metrics:thresholds`
never clobbers a hand-tuned `thresholds.json` — it writes
`thresholds.derived.json` alongside so you can diff and merge.

### 1.4 Validate more keyframe/metric labels

`set_point` is the weakest keyframe (~52% at ±1). Behind/front orientations were
deprioritized. Confirm `legs_fully_extended` accuracy in the validator — it
currently sometimes lands at/after `release`. Use the validator's dropdown +
keyframe view; re-run `npm run test:labels` after label edits.

---

## 2. Engineering hardening

### 2.1 Version + migrate `v2Metrics`

Sessions analyzed before the v2 work carry no `StoredShotAnalysis.v2Metrics`, so
their scorecard is silently hidden. Decide a policy:

- add a `metricsSchemaVersion` to the stored analysis,
- backfill on read (recompute from stored data where possible) or offer a
  re-analyze path,
- invalidate stored metrics when the extraction math changes (the golden test
  catches drift; the app needs a matching bump).

### 2.2 Version `thresholds.json` in the app

It ships as a static asset (`app/static/reference/thresholds.json`). Wire the
`version` field so scores are reproducible, cache-busted on threshold changes,
and stored alongside a shot's score for auditability.

### 2.3 Build ordering for `dist/`

The library's `dist/` is git-ignored and the app imports the **built** package
(`basketball-shot-analysis` → `dist/index.js`). Ensure the app's build/deploy
runs the library `npm run build` first, or the app will resolve stale exports.

### 2.4 Confirm CI is green

`src/testing/reporting.test.ts > returns error on permission issues` fails only
when the suite runs as **root** (file-permission errors don't occur as root) —
it passes as a normal user. Confirm real CI runs non-root, or skip that case
when `process.getuid?.() === 0`.

### 2.5 Low-false-positive gating

Withhold (or clearly caveat) scores for footage the pipeline can't measure well:
behind/front orientations for posture metrics, and low average pose confidence.
The scorecard already reports `measuredFraction` and per-metric `unmeasured`;
consider a shot-level gate that suppresses the headline score below a coverage
threshold.

---

## 3. Product & UX

### 3.1 End-to-end run of the real app

Drive `/assess` → results with a real video and confirm the scorecard renders
live (the CI environment can't run the full Svelte dev server + MediaPipe). See
[`app/README.md`](../app/README.md) and [`app/docs/VALIDATION.md`](../app/docs/VALIDATION.md).

### 3.2 Coaching text per metric

The scorecard shows target bands but no plain-language cue for an off metric.
The v1 scoring feature has a cue system (`app/src/lib/features/scoring/cues.ts`);
add v2 cues keyed by metric id + direction (too high / too low).

### 3.3 Pose data storage strategy

`poses.json` is ~6 MB/clip. Decide whether to persist full poses for
re-analysis and the you-vs-pro overlay at scale, or keep only keyframe
snapshots + `v2Metrics` (current behaviour).

### 3.4 Gate or remove the debug scorecard route

`/__debug/scorecard` is a demo surface — move it behind the existing debug gate
or remove before shipping.

---

## 4. Nice-to-have

- Label `legs_fully_extended` across the corpus and add it to `test:labels`.
- Extend the golden harness to cover **scores**, not just metrics.
- Add direct unit tests for the v2 helpers flagged in the
  [test plan](./test-plan.md) (`normalize`, `stats`, `posture`, `phases`).
- Per-orientation threshold sets (side vs front) once data supports it.
