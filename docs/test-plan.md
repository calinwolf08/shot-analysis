# Test coverage audit & hardening plan

Where the test suite is strong, where the gaps are, and a concrete plan to
harden the codebase before production. Companion:
[follow-up work](./follow-up-work.md).

## Current state (facts)

- **Library:** 56 test files, ~1,616 test cases (`vitest`).
- **App:** 55 component/unit test files + 16 Playwright e2e specs.
- **Regression harnesses:**
  - `npm run test:labels` — detection vs human labels on the whole corpus.
  - `npm run metrics:golden` + `metrics-golden.test.ts` — v2 metric drift guard.
- **Known failure:** `src/testing/reporting.test.ts` fails **only** when run as
  root (permission errors don't occur as root); passes as a normal user.

### Coverage of the core algorithm modules

Measured with `vitest --coverage` scoped to the detection/metrics/scoring tests
(the numbers that matter for correctness):

| Module             | Statements | Functions | Notes                                      |
| ------------------ | ---------: | --------: | ------------------------------------------ |
| `src/detection`    |       ~87% |      ~97% | shot + keyframe detection well covered     |
| `src/metrics` (v1) |       ~90% |      ~96% | mature                                     |
| `src/metrics/v2`   |       ~83% |      ~85% | new work; helpers tested mostly indirectly |
| `src/scoring/v2`   |       high |      high | direct unit tests for every scoring rule   |

> The full-repo statement % is lower because CLI tools and browser-only
> providers are intentionally not unit-tested (see gaps below). Core algorithm
> coverage is the meaningful figure.

## Gaps (source files without direct unit tests)

**Worth adding direct tests (pure logic):**

- `src/metrics/v2/normalize.ts` — body scale, center-of-feet, orientation sign,
  forward offset, height-above-feet. Foundational; currently only exercised
  transitively.
- `src/metrics/v2/stats.ts` — median/quantile/IQR edge cases.
- `src/metrics/v2/structure/posture.ts`, `phases.ts`, `geometry.ts` — covered
  only via `structure.test.ts`; deserve targeted cases (phase-range fallbacks,
  angle/­null handling, side-vs-front reliability).

**Lower priority (thin or environment-bound):**

- `src/testing/*` CLI tools — exercised end-to-end by `metrics:golden` and the
  reference pipeline; a smoke test each would still help.
- `src/browser-entry.ts` — re-exports only.
- `src/providers/video-element.ts` — browser API surface; covered by app e2e.

## Hardening plan

Ordered; each item is independently shippable.

### Tier 1 — lock in the algorithm (highest value)

1. **Direct unit tests for `normalize.ts` and `stats.ts`.** Pure functions,
   trivial to test, currently the biggest "important-but-indirect" gap.
2. **Structure sub-module tests** (`posture`, `phases`, `geometry`): phase-range
   fallbacks when keyframes are missing; posture reliability by orientation;
   angle helpers returning null on occlusion.
3. **Extend the golden harness to scores**, not just metrics — freeze a
   `ShotScore` per corpus shot against the placeholder thresholds so scoring
   changes surface as reviewable drift.
4. **Make `test:labels` a CI gate** with a documented minimum pass rate per
   keyframe, so detection regressions fail the build instead of being noticed by
   eye.

### Tier 2 — pipeline & integration

5. **App: assessment→results integration test** that runs `runReplayAnalysis`
   on a fixture clip, persists, and asserts the results screen renders a
   scorecard with the expected shape (the v2 wiring currently has type-check +
   analysis-unit coverage but no end-to-end assertion).
6. **`v2Metrics` persistence/versioning test** (see follow-up 2.1): a stored
   analysis without `v2Metrics` hides the scorecard gracefully; a version bump
   invalidates stale metrics.
7. **Reference-pipeline smoke tests**: `metrics:extract` → `metrics:thresholds`
   on a tiny fixture produces a well-formed `thresholds.json` and `report.md`.

### Tier 3 — robustness & CI hygiene

8. **Fix the root-only `reporting.test.ts`**: skip when `process.getuid?.() === 0`
   so CI is unambiguously green.
9. **Property/fuzz tests for detectors**: random-but-plausible pose sequences
   should never throw and should keep keyframes in chronological order.
10. **Occlusion/low-confidence fixtures**: assert metrics return `unavailable`
    (never a fabricated number) when landmarks drop out — the "low false
    positive" guarantee.
11. **Orientation matrix**: a fixture per camera orientation asserting which
    metrics are reliable vs suppressed.

### Tier 4 — app UX & device

12. **Playwright e2e for the scorecard**: upload → results → expand a category →
    a metric's target-band bar renders and the frame button seeks.
13. **Bundle-size & debug-stripping gates** already exist (`check:size`,
    `check:stripped`) — keep them in `verify` and CI.

## Suggested CI wiring

```
lint  →  type-check (lib + app)  →  unit tests (lib + app)
      →  test:labels (min pass-rate gate)
      →  metrics:golden (drift gate)
      →  app build + size/stripped gates
      →  e2e (Playwright)
```

Run as a **non-root** user so `reporting.test.ts` passes, and run the library
`npm run build` before the app steps so the app resolves fresh `dist/` exports.
