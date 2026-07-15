# Implementation plan: unify the keyframe algorithm with the phase system

Goal (from the user): the runtime should identify the **same frames as the
self-labeled data** (`test-data/*/labels.json`) and derive the phases the
metric calculators need from those keyframes — decoupling the arm timeline
from the leg timeline, since their sequence varies between shooters.

## What exists today

- **Two detectors, one wired in.** `phase-detector.ts` (6 phase _ranges_)
  runs in the pipeline (`integrated-shot-detector.ts` →
  `MetricOrchestrator`). `keyframe-detector.ts` (10 discrete keyframes)
  runs **only** in the offline test harness (`src/testing/`), scored
  against `labels.json`.
- **The keyframes already match the labels** and are already decoupled into
  two tracks:
  - **Ball/arm track:** `ball_low_point`, `ball_starts_upward`,
    `set_point`, `release`, `arms_fully_extended`
  - **Leg track:** `legs_start_bending`, `leg_bend_low_point`,
    `legs_start_extending`, `feet_leave_ground`, `feet_land`
- **Baseline accuracy** (offline harness vs labels): 8/12 shots pass.
  `set_point` now uses elbow-extension onset (committed separately).
- **Metric calculators depend heavily on the 6 phases** (`Release` 72×,
  `SetPoint` 59×, `Rise` 33×, `Load` 24×, `FollowThrough` 20×, `Gather`
  18×). Changing the `ShotPhases` shape is a very large blast radius.

## Design decision: keyframe-derived phases (keep the metric interface)

Keep `ShotPhases` (the 6 ranges) as the **stable contract** the metrics,
benchmarks and scoring consume. Change how those ranges are _produced_:
detect the 10 keyframes on the runtime pose stream and **map keyframes →
phase ranges**. The arm/leg decoupling lives in the keyframe layer (each
boundary comes from its own keyframe, not the coupled "rise = wrist-up +
knee-extension" heuristic), so a shooter whose wrist reaches set point
before the knees extend is handled correctly.

This achieves the stated goal (same frames as labels, phases for metrics)
with far less risk than expanding the phase model. Expanding `ShotPhases`
into explicit parallel arm/leg timelines (the "separate phases" idea) is a
larger follow-up and is **out of scope for this pass**.

### Keyframe → phase mapping

| Phase         | Start keyframe            | End keyframe                            |
| ------------- | ------------------------- | --------------------------------------- |
| Gather        | shot start                | `legs_start_bending` − 1                |
| Load          | `legs_start_bending`      | `leg_bend_low_point` / `ball_low_point` |
| Rise          | `ball_starts_upward`      | `set_point` − 1                         |
| SetPoint      | `set_point`               | `set_point`                             |
| Release       | `set_point` + 1           | `arms_fully_extended`                   |
| FollowThrough | `arms_fully_extended` + 1 | shot end (`feet_land` within)           |

Decoupling note: Load/Rise boundaries take the **ball** keyframes for the
arm-relevant metrics and the **leg** keyframes (`legs_start_extending`,
`feet_leave_ground`) are carried through for leg metrics, even when the two
tracks overlap in time. Where a phase range would be empty/degenerate
(missing keyframe, e.g. occluded elbow in a behind view), fall back to the
current `phase-detector` heuristic for that boundary only.

## Steps

1. **Adapter: run keyframe detectors on runtime poses.** `keyframe-detector`
   consumes `testing` `Frame`/`TestLandmark`; the pipeline has
   `PoseLandmarks`. Add a thin adapter (`PoseLandmarks[]` → `Frame[]`) so the
   `KeyframeDetector` class runs in the pipeline. No detector logic changes.

2. **Keyframe → ShotPhases mapper.** A pure function
   `phasesFromKeyframes(keyframes, frameRange) → ShotPhases`, implementing the
   table above with degenerate-range fallbacks. Unit-tested directly.

3. **Wire into `integrated-shot-detector.ts`.** Behind a flag, derive phases
   from keyframes; keep `phase-detector` as the fallback for any boundary the
   keyframes don't yield. Default the flag on once accuracy is confirmed.

4. **Validate.**
   - Offline: `run-tests.ts` keyframe accuracy vs `labels.json` must not
     regress (target: ≥ baseline, improve `set_point`/`release`).
   - Metrics: regenerate the fixture score/diagnosis snapshots (they shift
     because phase boundaries move to the labeled frames — that is the point).
   - `npm run check` + app `npm run verify` green; rebuild `dist` + browser
     bundle so the app **and** the validator use the unified detection.

5. **Debug surface.** Show the detected keyframes in the validator (they
   already render labels) so tuning against labeled data is one loop:
   edit detector → `npm run validate` / `run-tests.ts` → compare to labels.

## Open item to confirm

- **Set point still slightly early on one shot (−16).** Band width
  (`SET_POINT_EXTENSION_BAND_DEG`) trades early-vs-late across the corpus;
  more labeled shots or a per-shot-duration band may help. Tunable in the
  loop above.
- **"Separate arm/leg phases" (larger model change)** deferred; revisit if
  the derived-range approach can't express a needed leg metric.
