> **Superseded for scoring.** The app now scores shots on the keyframe checks
> (body positions at Setup, Load, Rise, Set point and Release) — see
> [`keyframe-review-plan.md`](keyframe-review-plan.md). The v3 catalog below
> is still in the library (`src/metrics/v3/`), and its signals and events are
> what the keyframe checks are measured on, but the app no longer stores,
> scores or shows v3 metrics.

# Shot Metrics by Phase

This is the **v3 metric catalog** that live practice scores every shot with
(Load → Rise → Set point → Release, 0–10+ scale). It's implemented in
`src/metrics/v3/` (`signals.ts` → `events.ts` → `metrics.ts`). Shots are
scored in the app by `app/src/lib/features/scoring/v3/score.ts`, against
`app/static/reference/live-targets-v3.json`. The older v1/v2 metrics, still
used by the hidden assessment/upload path, are kept in the
[appendix](#appendix-v1v2-metrics-assessment--upload-path).

- [How a shot is measured](#how-a-shot-is-measured)
- [Events and phases](#events-and-phases)
- [Scoring: the 0–10+ scale](#scoring-the-010-scale)
- [Catalog: Load](#load) · [Rise](#rise) · [Set point](#set-point) ·
  [Release](#release) · [Details (not scored)](#details-not-scored)
- [Changing targets and wording](#changing-targets-and-wording)

---

## How a shot is measured

**Input:** the shot's stored pose track. It covers the detected shot plus 15
frames before and 10 after, and holds MediaPipe's 33 landmarks per frame
(x, y normalized 0–1 on each axis, plus visibility) with a capture time.
Live capture runs at 30 fps. Every frame keeps its real timestamp, so dropped
frames don't distort timing.

**Signals** (`signals.ts`), per frame:

| Signal             | Definition                                                                                                    | Landmarks                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Knee angle         | Interior angle hip–knee–ankle                                                                                 | near side 23/24, 25/26, 27/28     |
| Hip angle          | Interior angle shoulder–hip–knee                                                                              | near side 11/12, 23/24, 25/26     |
| Elbow angle        | Interior angle shoulder–elbow–wrist                                                                           | shooting side 11/12, 13/14, 15/16 |
| Wrist angle        | Interior angle elbow–wrist–index finger                                                                       | shooting side 13/14, 15/16, 19/20 |
| Spine lean         | Angle of hip→shoulder from vertical; **+ = leaning toward the direction the player faces**                    | near hip, near shoulder           |
| Head pitch         | Ear → nose line from horizontal; **+ = chin down**, − = chin up (head tilted back). Independent of torso lean | near ear, nose (both needed)      |
| Wrist / hip height | Screen y of the shooting wrist / near hip                                                                     | 15/16, 23/24                      |
| Joint positions    | Wrist, elbow, hip, knee, ankle, head, guide wrist                                                             | as above                          |

- **True proportions:** x is multiplied by the frame's width ÷ height before
  any angle or distance is computed. Raw normalized coordinates stretch angles
  on any non-square video.
- **Near side** is the body side nearest the camera: the side whose
  shoulder, hip, knee and ankle are more visible over the shot.
  Legs, hips and torso are read there. Arm signals always use the shooting
  arm.
- **Facing** (+x or −x) is read from the nose relative to the near ear. It
  signs every horizontal offset so "forward" means toward the direction the
  player faces. The metrics come out the same for a right- or left-hander and
  from either side of the court.
- **Body-relative distances:** each distance is divided by the player's own
  median segment length for the shot: thigh (hip–knee), shin (knee–ankle),
  torso (near shoulder–hip), forearm (elbow–wrist), or leg (thigh + shin). So
  "12% of your torso" means the same on a child, an adult, a phone held close
  or far away.
- **Cleaning:** a joint below visibility 0.3 is treated as missing. Gaps of up
  to 3 frames are bridged linearly, then each signal is smoothed with a
  5-point Savitzky–Golay filter. Joint angles are clamped to 0–180°.

## Events and phases

Events (`events.ts`) are located **between frames**, not rounded to whole
frames:

- **Extrema** (lowest, deepest): a parabola through the extreme frame and its
  neighbours.
- **Onsets** (movement starts): where the speed toward the coming extremum
  first passes 20% of its peak.
- **Completions** (straight): where the signal crosses a fraction of its
  excursion.

At 30 fps a rise lasts only ~4 frames, so whole-frame timing would be far too
coarse.

| Event                     | How it's found                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Release anchor            | First arrival of the shooting wrist at (near) its highest point                                   |
| Ball drop start           | Onset of the wrist moving down into its lowest point                                              |
| Ball lowest               | The wrist's lowest point just before the release anchor                                           |
| Ball rise start           | The wrist's upward speed reaches 10% of its peak                                                  |
| Elbow bend start          | Onset of the elbow bending toward its most-bent point in the load                                 |
| Hips drop start           | Onset of the hips moving down into their lowest point                                             |
| Hips lowest               | Lowest hip point, searched from 10 frames before the ball's lowest point up to the set point      |
| Knees deepest             | Smallest knee angle, searched from 5 frames before the hips' lowest point to the set point        |
| Knees start straightening | Onset of knee extension after the deepest bend (deepest bend searched around the hips' low point) |
| Knees straight            | Knees 80% of the way from deepest bend to full extension                                          |
| **Set point**             | Onset of the elbow's extension, after its most-bent point in the rise                             |
| Arm extended              | Elbow 90% of the way from most bent to fully extended                                             |

Phase windows:

| Phase         | From                                             | To                                     |
| ------------- | ------------------------------------------------ | -------------------------------------- |
| **Load**      | the earlier of ball drop start / hips drop start | the later of ball lowest / hips lowest |
| **Rise**      | end of the load                                  | set point                              |
| **Set point** | the set-point moment (a snapshot)                |                                        |
| **Release**   | set point                                        | arm extended                           |

If an event isn't found, the metrics that need it are **not measured**. They
are never guessed and never scored.

## Scoring: the 0–10+ scale

Each scored metric has a target band from the reference shots
(`live-targets-v3.json`):

- **Inside the band → 0** (on target). An excess under 5% of a step also
  counts as 0.
- **Outside → +1 point per `rampSd`** beyond the nearest band edge. `rampSd`
  is the reference spread: the sample SD of the reference values; or range ÷ 4
  if that's 0; or 5% of the mean if both are 0.
- **Shown as whole numbers, rounded up**, so anything off target shows at
  least 1 (2.1 → 3) and only a truly on-target value shows 0. This applies to
  every score on every screen (items, phases, overall, averages). The display
  caps at "10+". The stored value keeps its decimals and isn't capped.
- **Phase score** = mean of its measured, scored metrics. **Overall** = mean of
  the phase scores. Overall is withheld when fewer than half the scored
  metrics could be measured.
- **Bands** (on the shown whole numbers, the chip colors): 0 on target ·
  1–3 close · 4–6 off · 7–10+ way off.

**Feedback after a shot** is the 3 worst scored metrics, re-ordered into shot
order:

- **Voice and card** (plus the review's "off target" chips and the Shots
  list) use the same short wording: the body part, which way it's off (the
  fault), and the whole-number score, grouped by phase, e.g. "Load: Spine
  forward by 3. Knees deep by 4." The number is how far that metric is from 0
  (on target).
- **Wording is editable without a rebuild** in
  `app/static/config/feedback-wording.json`. Each metric has a `low` phrase
  (value below target) and a `high` phrase (value above target), and one
  `format` builds each item (`{phrase} by {n}`). A metric missing from the file
  falls back to its scorecard wording (or, for the voice, its coaching cue).
- **Measured amounts** (degrees, % of a limb) only appear in the full
  scorecard rows, with the target range.
- **Focus:** with a focus area set (Load / Rise / Set point / Release, or
  Rhythm & timing = every timing metric), the 3 worst within the focus are
  used instead.

**Timing metrics** are `(time of event B − time of event A) ÷ the phase's real
duration`:

- **Negative** means B came first; the size is the gap as a share of the
  phase.
- One number therefore captures both **order** and **gap**.
- A phase shorter than 6 frames is flagged "low resolution". It's still
  measured, but the reference bands for such metrics are loose.

## Catalog

Unit key:

| Unit                                  | Meaning                                           |
| ------------------------------------- | ------------------------------------------------- |
| °                                     | Degrees                                           |
| % phase                               | Timing as a share of the phase                    |
| ×torso, ×thigh, ×shin, ×forearm, ×leg | Distance in multiples of the player's own segment |
| s                                     | Seconds                                           |

Sign conventions:

- **Forward:** toward the direction the player faces.
- **Up:** higher on screen.

"Frame" is where the value is read, which is also where review and the Curry
viewer seek and draw the geometry.

### Load

| Id                     | Label                      | Definition                                          | Unit   | Frame           | Needs                  |
| ---------------------- | -------------------------- | --------------------------------------------------- | ------ | --------------- | ---------------------- |
| `load.spine_angle`     | Torso lean                 | Spine lean (+ forward)                              | °      | hips lowest     | hip, shoulder          |
| `load.head_pitch`      | Head position              | Head pitch (+ chin down)                            | °      | hips lowest     | ear, nose              |
| `load.knee_depth`      | Knee bend                  | Smallest knee angle in the load (smaller = deeper)  | °      | deepest bend    | hip, knee, ankle       |
| `load.hip_over_knee`   | Hips over knees            | Hip x − knee x (+ hips ahead) ÷ thigh               | ×thigh | hips lowest     | hip, knee              |
| `load.knee_over_ankle` | Knees over feet            | Knee x − ankle x (+ knees ahead) ÷ shin             | ×shin  | hips lowest     | knee, ankle            |
| `load.ball_drop`       | Ball dip                   | Wrist height above the hip (+ above) ÷ torso        | ×torso | ball lowest     | wrist, hip             |
| `load.elbow_angle`     | Elbow at the dip           | Elbow angle                                         | °      | ball lowest     | shoulder, elbow, wrist |
| `load.elbow_change`    | Elbow loading              | Elbow angle at load end − at load start (− = folds) | °      | load start, end | arm                    |
| `load.ball_close`      | Ball distance from body    | Wrist–hip distance ÷ torso                          | ×torso | ball lowest     | wrist, hip             |
| `load.t_drop_start`    | Ball vs hips going down    | Ball drop start − hips drop start                   | % load | both events     | —                      |
| `load.t_drop_end`      | Ball vs hips at the bottom | Ball lowest − hips lowest                           | % load | both events     | —                      |
| `load.t_elbow_bend`    | Elbow bend timing          | Elbow bend start − ball drop start                  | % load | both events     | —                      |

### Rise

| Id                           | Label                    | Definition                                                                   | Unit   | Frame       | Needs                      |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------------- | ------ | ----------- | -------------------------- |
| `rise.t_start`               | Ball vs legs starting up | Ball rise start − knees start straightening                                  | % rise | both events | —                          |
| `rise.t_ball_vs_knee_bottom` | Ball up vs knee bend     | Ball rise start − knees deepest (− = ball rising while the knees still bend) | % rise | both events | —                          |
| `rise.t_end`                 | Set point vs legs        | Set point − knees straight                                                   | % rise | both events | —                          |
| `rise.elbow_change_1`        | Elbow, early rise        | Elbow angle change, rise start → rise midpoint                               | °      | start, mid  | arm                        |
| `rise.elbow_change_2`        | Elbow, late rise         | Elbow angle change, rise midpoint → set point                                | °      | mid, end    | arm                        |
| `rise.wrist_hinge_change_1`  | Wrist cock, early rise   | Wrist angle change, start → mid                                              | °      | start, mid  | index finger visible ≥ 0.5 |
| `rise.wrist_hinge_change_2`  | Wrist cock, late rise    | Wrist angle change, mid → set point                                          | °      | mid, end    | index finger visible ≥ 0.5 |
| `rise.spine_change`          | Torso as you rise        | Spine lean change across the rise                                            | °      | start, end  | hip, shoulder              |
| `rise.t_spine_vs_knees`      | Torso vs legs timing     | Torso 90% straightened − knees straight                                      | % rise | both        | —                          |
| `rise.head_pitch_change`     | Head as you rise         | Head pitch change across the rise (+ = drops)                                | °      | start, end  | ear, nose                  |

### Set point

All read at the set-point moment.

| Id                         | Label                        | Definition                                | Unit   |
| -------------------------- | ---------------------------- | ----------------------------------------- | ------ |
| `setPoint.wrist_vs_head`   | Set point height             | Wrist height above the head (ear) ÷ torso | ×torso |
| `setPoint.elbow_angle`     | Elbow at set point           | Elbow angle                               | °      |
| `setPoint.spine_angle`     | Torso at set point           | Spine lean (+ forward)                    | °      |
| `setPoint.knee_angle`      | Knees at set point           | Knee angle                                | °      |
| `setPoint.hip_angle`       | Hips at set point            | Hip angle (shoulder–hip–knee)             | °      |
| `setPoint.hip_over_knee`   | Hips over knees at set point | Hip x − knee x ÷ thigh                    | ×thigh |
| `setPoint.knee_over_ankle` | Knees over feet at set point | Knee x − ankle x ÷ shin                   | ×shin  |
| `setPoint.head_pitch`      | Head at set point            | Head pitch (+ chin down)                  | °      |

### Release

| Id                          | Label                   | Definition                                                                            | Unit      | Frame                 | Needs                      |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------- | --------- | --------------------- | -------------------------- |
| `release.elbow_path`        | Elbow path              | Direction the elbow travels from set point to arm extended, from vertical (+ forward) | °         | set point → extended  | elbow                      |
| `release.wrist_vs_head_end` | Release height          | Wrist height above the head ÷ torso                                                   | ×torso    | arm extended          | wrist, ear                 |
| `release.guide_hand_dx`     | Guide hand (front/back) | Guide wrist x − shooting wrist x (+ ahead) ÷ forearm                                  | ×forearm  | arm extended          | guide wrist visible ≥ 0.5  |
| `release.guide_hand_dy`     | Guide hand (height)     | Guide wrist height above shooting wrist ÷ forearm                                     | ×forearm  | arm extended          | guide wrist visible ≥ 0.5  |
| `release.knee_change`       | Leg drive at release    | Knee angle change across the release                                                  | °         | start, end            | leg                        |
| `release.spine_change`      | Torso at release        | Spine lean change across the release                                                  | °         | start, end            | torso                      |
| `release.wrist_snap`        | Wrist snap              | Most wrist flexion (180° − wrist angle) within 0.3 s after arm extended               | °         | snap frame            | index finger visible ≥ 0.5 |
| `release.forward_drift`     | Forward drift           | Hip+head midpoint x, load end → release end (+ forward) ÷ leg                         | ×leg      | load end, release end | hip, head                  |
| `release.t_legs_vs_arm`     | Legs vs arm finishing   | Knees straight − arm extended                                                         | % release | both                  | —                          |

### Details (not scored)

Measured and shown, never scored or spoken.

| Id                                | Label                    | Definition                                                                         | Unit   |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- | ------ |
| `detail.wrist_path_deviation`     | Ball path straightness   | Largest sideways deviation of the wrist from a straight line over the rise ÷ torso | ×torso |
| `detail.elbow_height_vs_head`     | Elbow height at release  | Highest elbow-above-head during the release ÷ torso                                | ×torso |
| `detail.release_vs_takeoff`       | Release vs take-off      | Arm extended − take-off (onset of the ankle rising)                                | s      |
| `detail.follow_through_elbow_max` | Follow-through extension | Largest elbow angle within 0.3 s after arm extended                                | °      |

## Changing targets and wording

- **Rebuild the targets** from the reference shots (Curry's 7 labeled
  side-on shots today) with `npm run targets:build:v3`, then `npm run build`
  for `dist/`:
  - Band = the observed **min–max** of the reference values; `ideal` = their
    mean; `rampSd` as above.
  - A metric needs at least 3 reference values to be scored.
- **Hand edits survive rebuilds.** In `live-targets-v3.json`, edit a metric's
  `label`, `wording` (`low` / `high` → `phrase` for the card, `cue` for the
  voice), or `override` (`passMin`, `passMax`, `scored`).
- **New metrics** get their default wording from `src/metrics/v3/wording.ts`.
  Their drawing geometry lives in
  `app/src/lib/features/reference/metric-geometry.ts`; a unit test fails if
  a worded metric has no geometry.
- **Audit the targets** in the dev **Curry model viewer**
  (`/__debug/reference`, linked from Profile → Debug tools in dev/E2E builds).
  It shows every metric for every reference shot with the band, flags
  outliers, draws each metric's geometry on the pose, and compares one of your
  shots side by side, phase-aligned.

---

## Appendix: v1/v2 metrics (assessment / upload path)

The metrics below predate v3. The hidden assessment/upload flow still uses
them (and `v2Metrics` is still computed on every analysis), but live practice
no longer scores with them.

This document organizes all metrics by when they occur during a basketball shot. Each metric is classified as either:

- **Find frame** - Algorithm must detect WHEN this happens
- **Measure @ frame** - Read value from pose data AT a specific frame
- **Derived** - Computed from frame timings or across multiple frames

---

### Phase 1: LOAD (Dip)

_Player catches ball, bends knees, ball may dip_

| Type                             | Metric               | What to tag/find                  |
| -------------------------------- | -------------------- | --------------------------------- |
| **Find frame**                   | `leg_bend_low_point` | Deepest knee bend                 |
| **Find frame**                   | `ball_low_point`     | Lowest ball position              |
| **Measure @ leg_bend_low_point** | `kneeFlexion`        | Knee angle (degrees)              |
| **Measure @ leg_bend_low_point** | `hipDrop`            | How far hips dropped (normalized) |
| **Measure @ ball_low_point**     | `ballDip`            | How far ball dropped (normalized) |
| **Measure @ leg_bend_low_point** | `backPostureLoad`    | Spine angle during load (degrees) |

---

### Phase 2: RISE

_Legs extend, ball moves upward toward set point_

| Type                               | Metric                 | What to tag/find                                       |
| ---------------------------------- | ---------------------- | ------------------------------------------------------ |
| **Find frame**                     | `legs_start_extending` | First frame legs push up                               |
| **Find frame**                     | `ball_starts_upward`   | First frame ball rises                                 |
| **Derived (%)**                    | `legRiseStart`         | legs_start_extending as % of shot                      |
| **Derived (%)**                    | `ballRiseStart`        | ball_starts_upward as % of shot                        |
| **Derived (diff)**                 | `ballLegSync`          | ballRiseStart - legRiseStart                           |
| **Measure across rise**            | `ballPath`             | Lateral deviation during rise (score)                  |
| **Measure @ legs_start_extending** | `backPostureRise`      | Spine angle during rise (degrees)                      |
| **Measure @ 10% of rise**          | `wristSetEarly`        | Is wrist already in shooting position? (boolean/angle) |

**Wrist Set Check:**

- Measured at 10% between `ball_starts_upward` and `set_point`
- Check if wrist is already cocked into shooting pocket
- Early set = good, late flip = needs work

---

### Phase 3: SET POINT

_Ball at highest pre-release position, arms cocked_

| Type                    | Metric               | What to tag/find                          |
| ----------------------- | -------------------- | ----------------------------------------- |
| **Find frame**          | `set_point`          | Ball at peak, before release motion       |
| **Measure @ set_point** | `shootingElbowAngle` | Elbow bend (degrees)                      |
| **Measure @ set_point** | `shootingElbowFlare` | Elbow out from body (degrees)             |
| **Measure @ set_point** | `setPointHeight`     | Ball height relative to head (normalized) |
| **Measure @ set_point** | `ballBehindHead`     | How far back ball is (normalized)         |
| **Measure @ set_point** | `guideElbowFlare`    | Guide arm elbow angle (degrees)           |
| **Measure @ set_point** | `guideHandPosition`  | side / under / front / thumb-up           |
| **Measure @ set_point** | `shoulderAlignment`  | Shoulder rotation (degrees)               |
| **Measure @ set_point** | `headTilt`           | Head tilt (degrees)                       |
| **Measure @ set_point** | `handCupVsHinge`     | cup / hinge / neutral                     |
| **Derived (duration)**  | `setPointDuration`   | Time at set point (ms)                    |

---

### Phase 4: RELEASE

_Arm extends, wrist snaps, ball leaves hand_

| Type                  | Metric                | What to tag/find                             |
| --------------------- | --------------------- | -------------------------------------------- |
| **Find frame**        | `release`             | Ball leaves shooting hand                    |
| **Derived (%)**       | `releaseStart`        | release frame as % of shot                   |
| **Measure @ release** | `releaseAngle`        | Arm angle at release (degrees)               |
| **Measure @ release** | `releasePoint`        | Position at release (normalized)             |
| **Measure @ release** | `wristSnapAngle`      | Wrist flexion (degrees)                      |
| **Measure @ release** | `backPostureRelease`  | Spine angle at release (degrees)             |
| **Measure @ release** | `guideHandSeparation` | Has guide hand separated? (boolean/distance) |

**Guide Hand Check:**

- Measured at `release` frame
- Check if guide hand has cleanly separated from ball
- Early separation = good, late/thumb interference = needs work

---

### Phase 5: FOLLOW-THROUGH

_Arm fully extended, held_

| Type                              | Metric                | What to tag/find              |
| --------------------------------- | --------------------- | ----------------------------- |
| **Find frame**                    | `arms_fully_extended` | Maximum arm extension         |
| **Find frame**                    | `feet_leave_ground`   | Jump (if any)                 |
| **Find frame**                    | `feet_land`           | Landing / shot end            |
| **Measure @ arms_fully_extended** | `maxArmExtension`     | Arm extension angle (degrees) |
| **Derived (%)**                   | `followThroughHold`   | Duration arm stays extended   |

---

### OVERALL (Shot-level)

| Type           | Metric              | What to tag/find                    |
| -------------- | ------------------- | ----------------------------------- |
| **Find frame** | `shot_start`        | First movement (legs_start_bending) |
| **Derived**    | `totalShotDuration` | End frame - start frame (ms)        |

---

### Summary

#### Frames to Find (10)

| #   | Frame                               | Phase          |
| --- | ----------------------------------- | -------------- |
| 1   | `shot_start` / `legs_start_bending` | Load           |
| 2   | `leg_bend_low_point`                | Load           |
| 3   | `ball_low_point`                    | Load           |
| 4   | `legs_start_extending`              | Rise           |
| 5   | `ball_starts_upward`                | Rise           |
| 6   | `set_point`                         | Set Point      |
| 7   | `release`                           | Release        |
| 8   | `arms_fully_extended`               | Follow-through |
| 9   | `feet_leave_ground`                 | Follow-through |
| 10  | `feet_land`                         | Follow-through |

#### Metrics by Measurement Type

**Angle measurements (12):**

- `kneeFlexion`, `backPostureLoad`, `backPostureRise`, `backPostureRelease`
- `shootingElbowAngle`, `shootingElbowFlare`, `guideElbowFlare`
- `shoulderAlignment`, `headTilt`
- `releaseAngle`, `wristSnapAngle`, `maxArmExtension`

**Position measurements (5):**

- `hipDrop`, `ballDip`, `setPointHeight`, `ballBehindHead`, `releasePoint`

**Categorical measurements (2):**

- `guideHandPosition` (side / under / front / thumb-up)
- `handCupVsHinge` (cup / hinge / neutral)

**Checkpoint measurements (2):**

- `wristSetEarly` - measured at 10% of rise phase (boolean/angle)
- `guideHandSeparation` - measured at release frame (boolean/distance)

**Path/deviation measurements (1):**

- `ballPath`

**Timing/percentage derived (6):**

- `legRiseStart`, `ballRiseStart`, `ballLegSync`
- `releaseStart`
- `setPointDuration`, `followThroughHold`, `totalShotDuration`

---

### Calibration Priority

For real-time feedback, prioritize metrics that are:

1. Reliably detectable from phone camera angles
2. Have clear corrective actions
3. Most impactful for shooting accuracy

**Tier 1 (Most Actionable):**

- `shootingElbowFlare` - "Tuck your elbow"
- `followThroughHold` - "Hold your finish"
- `ballLegSync` - "Push up as you shoot"
- `setPointHeight` - "Higher release point"
- `wristSetEarly` - "Set your wrist early"

**Tier 2 (Important):**

- `kneeFlexion`, `backPostureLoad/Rise/Release`, `wristSnapAngle`

**Tier 3 (Track over time):**

- `totalShotDuration`, `setPointDuration`, `guideHandSeparation`
