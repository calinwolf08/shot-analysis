# Metrics & Scoring Overhaul — Development Plan

Goal: rank every shot on two top-level scores — **Sequencing** (event order + timing)
and **Structure** (per-phase body mechanics) — scored against thresholds derived
from NBA shooters' pose data, with a per-metric, per-category breakdown a user
can actually read, plus a "your pose vs. pro target" visual.

The pipeline, end to end:

```
NBA poses.json  ──▶  metrics extraction  ──▶  per-player metric summaries
                                              │
                                              ▼
                                    threshold derivation + analysis
                                    (which metrics do all pros share?)
                                              │
                                              ▼ thresholds.json (versioned asset)
user shot poses ──▶ same metrics extraction ──▶ scoring engine ──▶ Sequencing Score
                                                                   Structure Score
                                                                   (+ pro-pose overlay)
```

The single most important design rule: **the NBA clips and the user's shots run
through the exact same extraction code.** One implementation, two consumers.

---

## Step 0 — Foundations: schema + normalization primitives (S)

New module `src/metrics/v2/` (keep the existing `src/metrics/*` calculators
untouched until Step 9 swaps the app over; the validator and app keep working
throughout).

**`src/metrics/v2/types.ts`** — the versioned `ShotMetricsV2` record (zod
schema, like the rest of the repo):

```ts
{
  schemaVersion: 1,
  shot: { startFrame, endFrame, fps, cameraOrientation },
  reliability: { poseConfidence, sideView: boolean, handLandmarksOk: boolean },
  sequencing: { events: {...}, gaps: {...} },          // Step 2
  structure: { gather: {...}, load: {...}, rise: {...},
               setPoint: {...}, release: {...}, followThrough: {...} }  // Step 3
}
```

Every metric value is stored with its raw value AND the frames it was measured
at, so the UI can later jump to / screenshot the exact frame.

**`src/metrics/v2/normalize.ts`** — the primitives everything else uses:

- **Body-scale unit**: player height estimate = |headY − ankleY| at the shot
  start (standing). All distances divide by this, so camera zoom and player
  size cancel out.
- **Time unit**: shot duration (startFrame → endFrame). All durations are
  expressed as % of it.
- **Center-of-feet reference**: midpoint of the two ankles (X). Posture
  offsets are signed horizontal distances from this line, with the sign
  flipped by camera orientation so "toward the hoop" is always positive.
- **Wrist angle**: angle at the wrist between elbow→wrist and wrist→index
  (landmarks 19/20). Gated on hand-landmark visibility;
  `reliability.handLandmarksOk` records whether it was trustworthy.

**Reliability tagging, not guessing**: posture offsets are only meaningful in
side-ish views. Each structure metric carries `reliable: boolean` derived from
orientation + landmark visibility; unreliable metrics are *excluded from
scoring*, never guessed (this is the "low false positive rate" principle).

Acceptance: schema + normalize helpers unit-tested on synthetic poses.

---

## Step 1 — One new keyframe: `legs_fully_extended` (S)

The sequencing list has 8 events; 7 already exist as keyframes. Missing is
**"legs extend"** (full extension, event #6 — distinct from `legs_start_extending`,
event #4).

- Detector: after `legs_start_extending`, the frame the hip-drop signal
  (`ankleY − hipY`, most-visible side — same signal that fixed
  leg_bend_low_point) reaches its maximum / plateaus. Knee-angle fallback
  behind the same basin-depth gate as the other hip-drop detectors.
- Add to `KeyframeId`, `KEYFRAME_IDS`, keyframe-phases wiring, labels schema
  (optional field, backward compatible), and the validator keyframe list.
- Label it on a handful of side-view test shots; verify with `npm run test:labels`.

Acceptance: detected within ±2 on labeled side shots; no regression on the
existing 10 keyframes.

---

## Step 2 — Sequencing metrics (M)

`src/metrics/v2/sequencing.ts`. Canonical sequence:

| # | event | source keyframe |
|---|---|---|
| 1 | ball low point | ball_low_point |
| 2 | ball starts rising | ball_starts_upward |
| 3 | leg low point | leg_bend_low_point |
| 4 | legs start rising | legs_start_extending |
| 5 | set point reached | set_point |
| 6 | legs extend | legs_fully_extended (Step 1) |
| 7 | release | release |
| 8 | arm extension | arms_fully_extended |

Output per shot:

- `events[i].t` — normalized time of each event (% of shot duration).
- `gaps` — **signed** normalized gap between each canonical consecutive pair
  (and the specific cross-pairs that matter, e.g. `ball_starts_rising →
  leg_low_point`). Signed gaps encode order AND timing in one number: a
  negative gap means the order was violated, a positive-but-too-large gap
  means sluggish sequencing. One thresholdable number per relationship —
  exactly the "must happen before X and within a time range" requirement.
- Missing events (undetected keyframe) → gap marked `unavailable`, excluded
  from scoring, surfaced to the user as "couldn't measure".

Acceptance: unit tests + a printed sequencing table for the labeled corpus
(extend `test:labels` or a sibling report) that you can eyeball.

---

## Step 3 — Structure metrics (L — the biggest coding step)

`src/metrics/v2/structure/` with one file per phase, all built on a shared
**posture core** since "posture, same as in load" repeats across phases.

**`posture-core.ts`** — given a frame range, returns for each of
head / shoulders / hips / knees / ankles: signed horizontal offset from
center-of-feet (normalized), at phase **start**, phase **end**, and the
**delta** — i.e. "as the player drops, how far forward do the hips travel
relative to the feet". One implementation, called by every phase.

Per phase (start value / end value / delta pattern throughout):

- **Gather**: posture snapshot; ball position (wrist midpoint height +
  horizontal offset from body).
- **Load**:
  - *depth*: starting height (hip height, ball height at load start),
    ending depth (min hip height = deepest bend, min ball height).
  - *posture*: posture-core over the Load range.
  - *wrist*: wrist angle, wrist-to-body distance (wrist to hip-center,
    normalized), wrist height — start/end/delta.
- **Rise**:
  - *posture*: posture-core.
  - *wrist cocked*: wrist angle at rise start; normalized time the angle
    peaks within the phase; peak angle value.
  - *wrist path*: straightness of the wrist's rise — fit a line to the wrist
    trajectory, report max lateral deviation (normalized) and its direction
    (toward/away from body). Cheap, robust proxy for "radius of the curve".
- **Set point**: posture-core (single-frame); wrist height relative to head
  (signed, normalized); wrist cock angle; elbow flare = angle of the upper
  arm out of the torso plane (side view: shoulder–elbow vs vertical).
- **Release**: posture-core; **guide-hand duration** = time (as % of shot)
  from release-phase start until inter-wrist distance exceeds a threshold
  (normalized by shoulder width) — needs shooting-hand config, already in
  the analyzer; **elbow height** relative to head at release.
- **Follow-through**: wrist snap angle (wrist angle at/after release —
  flexion past neutral); elbow full-extension angle at arms_fully_extended.

Acceptance: unit tests per phase on synthetic poses + a metrics dump for the
labeled corpus you can sanity-check in the validator.

---

## Step 4 — Single extraction entry point (S)

`extractShotMetrics(frames, shot, config) → ShotMetricsV2` in
`src/metrics/v2/index.ts`: runs boundary/keyframe detection (reusing
`analyzePoses`) then sequencing + structure. Exported from the library and the
browser bundle. This is the one function both the NBA pipeline and the app call.

---

## Step 5 — NBA reference extraction CLI (M)

Data layout (you drop poses in; everything under `out/` is generated):

```
reference-data/
  players/
    curry/clip-01/poses.json        # + optional labels.json when auto-detect misses
    curry/clip-02/poses.json
    booker/clip-01/poses.json
  out/
    metrics/curry/clip-01.metrics.json
    players/curry.summary.json      # per-metric median + spread across clips
    thresholds.json                 # Step 6
    report.md                       # Step 6
```

`npm run metrics:extract [-- player]` (`src/testing/extract-reference-metrics.ts`):

- Auto-detects shot boundaries per clip; if detection misses, falls back to an
  optional `labels.json` (same format as test-data — the validator dropdown
  can point at reference-data too, so you can label NBA clips with the tool
  you already use).
- Writes per-clip `ShotMetricsV2` + per-player summary (median, min/max, IQR
  per metric across that player's clips).
- Prints a table: player × metric × value, flagging unreliable/missing
  metrics so you immediately see which clips need better angles.

Practical notes for clip gathering: **prefer side views** (the posture family
needs them), aim for **3+ clips per player** so per-player spread is
measurable, and note each player's shooting hand in a small
`reference-data/players/<player>/player.json` (hand, name).

---

## Step 6 — Threshold derivation + "what do pros share" analysis (M)

`npm run metrics:thresholds` (`src/testing/derive-thresholds.ts`):

1. Per player per metric: median across clips (within-player noise = IQR).
2. Cross-player per metric: the **consensus band** = [min, max] of player
   medians, padded by pooled within-player IQR.
3. **Key-metric identification** — the analysis you described: rank metrics by
   *tightness*, e.g. consensus-band width relative to the metric's plausible
   range and to within-player noise. Metrics where every pro lands in a
   narrow band (tight + universal) are the "truly key" ones and get high
   weight; metrics where pros legitimately differ (e.g. set-point height
   varies by shooter) get low weight or are reported-not-scored.
4. Output `thresholds.json` (versioned):

```ts
{ version, generatedFrom: [players...],
  metrics: { "<metricId>": { band: [lo, hi], weight, coverage, unit, label } },
  referencePoses: { ... }   // Step 10
}
```

5. Output `report.md`: per-metric table (each player's value, band, tightness
   rank) — this is the artifact you review to confirm/veto thresholds before
   they ship. **Hand-editing thresholds.json is a supported workflow**; the
   derivation script never silently overwrites a hand-tuned file (writes
   `thresholds.derived.json` when one exists).

---

## Step 7 — Scoring engine (M)

`src/scoring/v2/` (library level, shared by app + CLI):

- Per metric: 100 inside the band, falling off (smoothstep) to 0 at
  `k × band-width` outside. Signed gaps score order violations harshly
  (negative gap = steep penalty) and timing drift gently.
- **Sequencing Score** = weighted mean of gap scores (+ an order subscore:
  % of required orderings satisfied — trivially derived from gap signs).
- **Structure Score** = mean of phase-category scores (Gather, Load, Rise,
  Set Point, Release, Follow-through), each the weighted mean of its metrics.
- Unreliable/missing metrics are excluded and their weight redistributed —
  with a `measuredFraction` reported so the UI can say "scored on 14 of 19
  metrics (side view required for the rest)".
- Output schema is UI-ready: every metric carries value, target band, status
  (`good | close | off | unmeasured`), plain-language label, and the frame it
  was measured at.

`npm run metrics:score [-- player|clip|test-data-case]` prints any shot's full
scorecard in the terminal.

## Step 8 — Score the NBA players themselves (S, validation gate)

Run the scorer over every reference clip. Pros should score high **by
construction**; any pro scoring low on a metric exposes a bad threshold, a
noisy metric, or a bad clip — fix before touching the app. Output
`out/players/<player>.scorecard.json` + a summary table. (This also produces
the per-player scores you wanted as a product feature — "Curry: 96".)

---

## Step 9 — App integration (M)

- `thresholds.json` ships as a versioned app asset.
- App's analysis path calls `extractShotMetrics` + scoring v2 (the library
  bundle already runs in the worker); old scoring/diagnosis engines swap to
  consume the new scorecard (`app/src/lib/features/scoring/`).
- **Results UI**: two headline numbers (Sequencing / Structure), each
  expanding to categories → metrics with a target-band bar (your value as a
  dot on the band), plain-language labels, and "unmeasured" states honestly
  displayed. Per-shot and session-aggregate views.

## Step 10 — "You vs. pro" visual (M)

- Step 6 stores **referencePoses**: for each keyframe, the consensus pro
  skeleton (median normalized landmarks across players, aligned to
  center-of-feet, scaled by body height) — plus per-player variants.
- App: on any metric/keyframe, show the user's frame (screenshot from their
  video, which we have) with their skeleton, and the pro skeleton overlaid
  ghost-style (aligned by center-of-feet + height), or side-by-side. Reuses
  `pose-skeleton.ts` renderer. Skeleton overlays keep us clear of NBA footage
  licensing; user-side screenshots are their own video.
- Validator gets the same overlay for tuning.

## Step 11 — Regression harness (S, continuous)

- Golden-file test: extracted metrics for the labeled corpus checked in;
  CI-style diff on algorithm changes (like test:labels but for metrics).
- `npm run test:labels` untouched; keyframes remain the foundation.

---

## Order & dependencies

```
0 → 1 → 2 ──┐
0 → 3 ──────┼→ 4 → 5 → 6 → 7 → 8 → 9 → 10
            └───────────────────↑ (11 runs alongside from Step 4)
```

Steps 5–6 can start with a stub metric set as soon as Step 4 exists — worth
doing so the pipeline is proven while Step 3's metric list fills in.

## What I need from you

1. **NBA pose data** in the Step 5 layout (player folders, 3+ side-view clips
   each ideally) + each player's shooting hand.
2. **Label `legs_fully_extended`** on a few side-view test shots (Step 1
   validation) — or I propose frames and you confirm in the validator.
3. **Review `report.md`** after Step 6 — confirm/veto which metrics become
   scored thresholds vs. reported-only.
4. Any priority reorder — default is the numbered order above.

## Open questions (flagged, not blocking)

- Follow-through has no explicit posture entry in your spec — assumed
  intentional; easy to add since posture-core is shared.
- Wrist angles depend on MediaPipe hand landmarks (17–22) being usable in the
  NBA clips; Step 5's extraction report will show their visibility per clip
  before we commit to wrist-metric thresholds.
- Guide-hand metrics need the shooter's handedness per NBA player
  (player.json covers it).
