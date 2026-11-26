# Keyframe review: implementation plan

Replaces the v3 metric catalog (45 phase/delta/timing metrics) with a small set
of **body-position checks at five keyframes**, and redesigns shot review and the
live practice feedback around it.

Approved mock (real shot, real pose, illustrative targets):
https://claude.ai/artifact/Q5P8N2WmQZKsSQv9W3TsuY

## Decisions

### Keyframes

| Phase | Keyframe | Detection |
|---|---|---|
| Setup | Moment before the ball starts dropping | `ballDropStart` (existing event) |
| Load | Moment before the wrists and ball start rising | `ballRiseStart` (existing event) |
| Rise | The ball reaches set point | **new** `setPointReached`: after the most-bent elbow of the rise, where the wrist's upward speed first drops below a fraction of its rise peak; never after `setPoint` |
| Set point | Last frame before the release starts | `setPoint` (existing: onset of elbow extension) |
| Release | The arm finishes extending | `armExtended` (existing event) |

Follow-through has no checks and no icon; the scrubber still plays through it.

### Checks

| Check (id) | Setup | Load | Rise | Set point | Release | Unit |
|---|---|---|---|---|---|---|
| Hand height (`hand_height`) | vs hip centre | vs hip centre | vs head | vs head | vs head | torso |
| Ball close to body (`ball_close`) | ✓ | ✓ | | | | torso (horizontal, toward facing) |
| Wrist hinge (`wrist_hinge`) | ✓ | ✓ | ✓ | ✓ | ✓ | deg |
| Hold at set point (`hold`) | | | | ✓ (Rise → Set point) | | s |
| Elbow bend (`elbow_bend`) | ✓ | ✓ | ✓ | ✓ | ✓ | deg |
| Knee bend (`knee_bend`) | ✓ | ✓ | ✓ | ✓ | ✓ | deg |
| Back posture (`back`) | ✓ | ✓ | ✓ | ✓ | ✓ | deg, + = leaning forward |
| Hips over knees (`hips_over_knees`) | ✓ | ✓ | ✓ | ✓ | ✓ | thigh, + = hips ahead |

33 checks. Ids are `<keyframe>.<check>` (e.g. `rise.knee_bend`). All positions
are absolute (no deltas between phases).

Body parts (for grouping and help text): Hands (hand height, ball close, wrist
hinge, hold), Elbow, Knees, Back, Hips.

### Scoring and colors

- Unchanged rule: 0 inside the pro band, +1 per reference spread outside, display
  rounds up and caps at 10+.
- Colors: **green = 0**, **yellow = 1–3**, **red = 4+**.
- Phase score = mean of its enabled checks; overall = mean of phase scores.

### Wording (screen and voice)

One phrase per direction, always "<part> too <direction>", followed by "by N":

| Check | Below band | Above band |
|---|---|---|
| Hand height | Hands too low | Hands too high |
| Ball close to body | Ball too close to body | Ball too far from body |
| Wrist hinge | Wrist too bent | Wrist too flat |
| Hold at set point | Hold too short | Hold too long |
| Elbow bend | Elbow too bent | Elbow too straight |
| Knee bend | Knees too bent | Knees too straight |
| Back posture | Leaning too far back | Leaning too far forward |
| Hips over knees | Hips too far back | Hips too far forward |

- Screen: "Knees too bent by 5" (the phase is shown by the selected icon).
- Voice: the same words with a phase lead-in, no coaching cue: "At release:
  hands too low by 1." Checks from the same phase share one lead-in: "When the
  ball reaches set point: knees too bent by 5, hands too low by 3."
- After-shot readback: worst three checks, one per body part, in shot order.

### Review screen

- Clip full-bleed; with no clip, a grey skeleton under the dots.
- Dots on **joints**, colored by severity: wrist (hand height, ball close,
  wrist hinge), elbow, knee, shoulder centre (back), near hip (hips over knees).
- Checks on the same joint draw as overlapping circles with a count badge;
  tapping opens a chooser (header = "Hands too high by 1" or the check name,
  sub = check name or "In range").
- Where the dot should be (blue):
  - hand height / ball close: a box (height band × horizontal band);
  - wrist hinge: a box where the fingertip should point;
  - knee and elbow bend: a box where the joint would be at the target angle,
    **both limb ends fixed** (knee: ankle planted, hip on the same ankle→hip line;
    elbow: shoulder fixed, wrist on the same shoulder→wrist line);
  - back posture: a wedge from the hip centre, plus a thin hip→shoulder line;
  - hips over knees: a vertical band from just above the hip to the ground.
- Selected check: its zone bright with a white outline, a white arrow from the
  dot to the zone (none when inside), the measured limbs in white; other zones
  fade to dashed outlines.
- Callout: severity badge, "Knees too bent by 5", "Needs attention." etc., a
  speaker button, dotted leader to the dot; placed in the free space that covers
  the fewest dots / zone / body points. Opens on the worst enabled check at each
  keyframe.
- Bottom: centered **Feedback** pill (shows "All feedback", a preset name, or
  "Custom"), play button, scrubber with keyframe ticks colored by worst check and
  a hold bracket, five phase icons drawn from the player's own pose.

### Feedback sheet (review **and** live practice)

- Dark app styling (card surfaces, orange accent), title "Feedback", "N of 33
  checks on", Done.
- Two tabs: **Focus areas** (presets) and **Pick checks** (one card per check,
  "i" help, Turn on/off, phase pills).
- Presets: All feedback; Leg drive (knees + hips, Load→Release); Set point
  (hands, wrist, elbow at Rise + Set point, hold); Dip & load (hands, ball close,
  knees, back at Setup + Load); Release (hands, wrist, elbow, back at Release);
  Posture (back + hips, all phases).
- Turned-off checks are hidden everywhere: dots, zones, callouts, icon colors,
  ticks, shot score, practice card and voice.
- Stored as a setting (`feedbackChecks`: list of enabled check ids) shared by
  review and practice; replaces `liveFocusAreas` (old areas map onto presets).

## Phases

Each phase lands as its own commit(s) with tests passing; nothing user-visible
breaks between phases (v3 keeps working until phase 2 switches the app over).

### Phase 1: analysis library (keyframe catalog)

`src/metrics/keyframes/` (alongside v3, reusing its signals and event primitives):
- `setPointReached` event + keyframe resolution (`keyframesFrom(events)`).
- `computeShotKeyframes(frames, opts)` → `ShotKeyframes`: schema version,
  keyframe frames, the 33 checks (`value`, `reliable`, `frame`, `unit`,
  `keyframe`, `check`) and the landmark-derived reference points the UI needs
  (facing, near side).
- Wording table (phrases above) and check/part metadata.
- Targets: `buildKeyframeTargets()` (same statistics and hand-edit preservation
  as v3) and `scoreKeyframeValue()`; build script `targets:build:keyframes`
  writing `app/static/reference/live-targets-keyframes.json` from the Curry
  reference shots; the pro builder gains the same output.
- Tests: event detection on synthetic signals and against the labelled Curry
  set-point frames, every check measured on the fixtures, wording covers every
  check × direction, targets round-trip and keep hand edits.

### Phase 2: app scoring and data

- `scoring/keyframes`: scorecard (per check, per phase, overall, worst),
  enabled-check filtering, screen text and spoken readback builders.
- Stored shots: `keyframes` added to the stored analysis with its schema
  version; older shots recomputed from their pose track on read (existing
  `ensureV3` mechanism, generalised).
- `feedbackChecks` setting + presets + migration from `liveFocusAreas`.
- Switch shot list, insights/progress, practice post-shot card and voice to the
  new scorecard. Unit tests for each.

### Phase 3: review screen

- Overlay renderer (`reference/keyframe-overlay.ts`, pure geometry + paint):
  joint dots and stacks, zones (including ends-fixed joint boxes), selection
  focus, arrow, limbs, callout placement.
- `ShotReviewScreen` rebuilt: phase icon bar, ticks + hold bracket, callout with
  speaker, chooser, grey skeleton without a clip.
- Shared `FeedbackSheet.svelte` (presets + pick checks).
- E2E: review framing/clip specs updated; new specs for keyframe navigation,
  stacked-dot chooser and the sheet.

### Phase 4: live practice

- Feedback pill on the practice screen opens the same `FeedbackSheet`
  (replaces the focus chip + `FocusSheet`).
- Post-shot card and voice use the filtered keyframe scorecard.
- E2E: practice focus specs migrated to the feedback sheet.

### Phase 5: cleanup

- Remove the v3 catalog consumers, `live-targets-v3.json`, `ScoreCardV3`,
  focus areas, timing-band UI; update docs (`metrics-by-phase.md`).

## Open risks

- Targets come from 7 Curry shots: bands may be tight. Review real shots
  against them before tuning (overrides in the targets file survive rebuilds).
- Setup and Rise keyframes have no hand labels; they're detected only.
- Curry shoots in one motion, so the hold band will sit near zero.
