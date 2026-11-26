# Keyframe review: implementation plan

Replaces the v3 metric catalog (45 phase/delta/timing metrics) with a small set
of **body-position checks at five keyframes**, and redesigns shot review and the
live practice feedback around it.

Approved mock (real shot, real pose, illustrative targets):
https://claude.ai/artifact/Q5P8N2WmQZKsSQv9W3TsuY

## Decisions

### Keyframes

| Phase     | Keyframe                                       | Detection                                                                                                                                                              |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup     | Moment before the ball starts dropping         | `ballDropStart` (existing event)                                                                                                                                       |
| Load      | Moment before the wrists and ball start rising | `ballRiseStart` (existing event)                                                                                                                                       |
| Rise      | The ball reaches set point                     | **new** `setPointReached`: after the most-bent elbow of the rise, where the wrist's upward speed first drops below a fraction of its rise peak; never after `setPoint` |
| Set point | Last frame before the release starts           | `setPoint` (existing: onset of elbow extension)                                                                                                                        |
| Release   | The arm finishes extending                     | `armExtended` (existing event)                                                                                                                                         |

Follow-through has no checks and no icon; the scrubber still plays through it.

### Checks

| Check (id)                          | Setup         | Load          | Rise    | Set point            | Release | Unit                              |
| ----------------------------------- | ------------- | ------------- | ------- | -------------------- | ------- | --------------------------------- |
| Hand height (`hand_height`)         | vs hip centre | vs hip centre | vs head | vs head              | vs head | torso                             |
| Ball close to body (`ball_close`)   | ✓             | ✓             |         |                      |         | torso (horizontal, toward facing) |
| Wrist hinge (`wrist_hinge`)         | ✓             | ✓             | ✓       | ✓                    | ✓       | deg                               |
| Hold at set point (`hold`)          |               |               |         | ✓ (Rise → Set point) |         | s                                 |
| Elbow bend (`elbow_bend`)           | ✓             | ✓             | ✓       | ✓                    | ✓       | deg                               |
| Knee bend (`knee_bend`)             | ✓             | ✓             | ✓       | ✓                    | ✓       | deg                               |
| Back posture (`back`)               | ✓             | ✓             | ✓       | ✓                    | ✓       | deg, + = leaning forward          |
| Hips over knees (`hips_over_knees`) | ✓             | ✓             | ✓       | ✓                    | ✓       | thigh, + = hips ahead             |

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

| Check              | Below band             | Above band              |
| ------------------ | ---------------------- | ----------------------- |
| Hand height        | Hands too low          | Hands too high          |
| Ball close to body | Ball too close to body | Ball too far from body  |
| Wrist hinge        | Wrist too bent         | Wrist too flat          |
| Hold at set point  | Hold too short         | Hold too long           |
| Elbow bend         | Elbow too bent         | Elbow too straight      |
| Knee bend          | Knees too bent         | Knees too straight      |
| Back posture       | Leaning too far back   | Leaning too far forward |
| Hips over knees    | Hips too far back      | Hips too far forward    |

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

### Phase 1: analysis library (keyframe catalog) — done

`src/metrics/keyframes/` (alongside v3, reusing its signals and event primitives):

- `catalog.ts`: keyframes, the 8 checks (name, body part, unit, keyframes,
  help text, below/above phrases), lead-ins, ids (`checkKey` / `parseCheckKey`,
  `ALL_CHECK_KEYS`).
- `measure.ts`: `setPointReached` (after the most-bent elbow of the rise, where
  the wrist's upward speed falls below 35 % of its fastest rise; never after
  set point), `keyframeSamples`, and `computeShotKeyframes(frames, opts)` →
  `ShotKeyframes` (schema version, keyframe frames, the 33 checks with
  `value` / `reliable` / `frame`, facing, near and shooting side).
- `targets.ts`: `buildKeyframeTargets()` (v3 statistics, overrides survive
  rebuilds, spread floored per unit so a check every reference shot does the
  same way can't turn a tiny difference into 10+) and `scoreCheck()` (the shared
  v3 scoring rule; v3's band/score helpers now take any target shape).
- `npm run targets:build:keyframes` writes
  `app/static/reference/live-targets-keyframes.json` from the Curry reference
  shots. Keyframes are **detected**, not taken from the labels: two Curry
  release labels sit 1–3 frames before the arm is straight (elbow 66° and
  117°), while detection places every shot the same way, as it will on a
  user's shot. 31 of 33 checks are scored; Setup elbow bend and wrist hinge
  have one reference value (the shooting arm is hidden behind the ball at
  Setup in 6 of 7 shots).
- Tests (`keyframes.test.ts`): catalog completeness and id parsing; all five
  keyframes found in order on every reference shot; agreement with the set
  point and arm-extension labels (±2 / ±3 frames) and the v3 bar for ball
  rise; checks measured and plausible; canvas size/aspect invariance; targets
  scoring, ramp floor and override preservation.

Checked on a real user clip: detection picks frames 141 / 155 / 163 / 166 /
171, the same keyframes chosen by hand for the mock.

### Phase 2: app scoring and data — done

- Targets: the Curry-built `live-targets-keyframes.json` is the placeholder
  until the pro videos are in (no pro target building yet). Hand override:
  hold at set point 0–2 frames (0–0.067 s at 30 fps). "Score against [pro]"
  is hidden (`PRO_TARGETS_READY = false`) and the insights "Closest pros"
  section is gone; pro work comes back when pro targets exist for the
  keyframe checks.
- `scoring/keyframes` (app): `scoreShotKeyframes(checks, targets, enabled)`
  (per check, per keyframe, overall, worst; coverage gate), 3-color
  `severity`, `checkText` ("Knees too bent by 5"), `headlineIssue`
  ("Rise: Knees too bent by 5"), `feedbackChecks` (worst 3, one per body
  part, in shot order), `spokenReadback` (same words, one lead-in per
  keyframe), `KeyframeScoreCard.svelte`, client/server targets loaders.
- Stored shots: `keyframes` in the stored analysis (schema-versioned);
  `scoreStoredShot(s)` migrates both the keyframe checks and v3 from the pose
  track in one write. The review screen still uses v3 via
  `scoreStoredShotV3` until phase 3.
- Feedback filter: `feedbackChecks` setting (null = never chosen), presets,
  `resolveEnabled` (saved filter → legacy focus areas mapped onto the
  checks at those keyframes → everything). Until phase 4 the practice focus
  chip writes the mapped checks to `feedbackChecks`.
- Switched to keyframe scoring with the filter: live pipeline (device and
  server), practice store (score, card, voice), practice breakdown, shot
  list, insights, debug replay page.

### Phase 3: review screen — done

- Library: `ShotKeyframes` also stores how it was measured (`xScale`, body
  `lengths`, `centreLine`) so the zones are drawn in the same space; schema
  version 2 (stored shots are recomputed once).
- `review/keyframe-overlay.ts` (pure, unit-tested): each check's joint, dot,
  zone and limbs; ends-fixed joint boxes (`jointAt`), fingertip box for the
  wrist hinge (`endAt`), back wedge, hips band down to the ground; dot stacks;
  nearest-edge arrows; free-space callout placement; stick-figure phase icons.
- `ShotReviewScreen` rebuilt: clip full-bleed (grey skeleton without one),
  dots / stacks / chooser, selected zone bright with an arrow and the measured
  limbs, others dashed; callout with speaker; Feedback pill; scrubber with
  keyframe ticks colored by worst check and the hold bracket; five phase
  icons (Rise and Set point can share a frame in a one-motion shot — the
  tapped one is shown). The shot is fitted above the controls.
- `FeedbackSheet.svelte` (shared, for phase 4): Focus areas / Pick checks,
  saved to `feedbackChecks`.
- E2E: review (keyframe nav, chooser, zones, filter + persistence, speaker),
  phone layout per keyframe, keyframe migration, practice → review.

### Phase 4: live practice — done

- The practice camera view's focus chip is replaced by a Feedback pill
  (shows "All feedback", the preset name or "Custom") that opens the same
  `FeedbackSheet` as shot review; the choice is saved to `feedbackChecks`
  and applies to the score, card and voice from the next shot.
- The practice store takes the filter directly (`setEnabled`); the legacy
  focus-area plumbing is gone from practice (old saved areas are still read
  once into the filter by `resolveEnabled`).
- E2E: `feedback.spec.ts` (pill → preset → persisted, Pick checks → Custom;
  Leg drive limits card and voice to knees/hips), per-user filter, phone
  layout of the pill.

### Phase 5: cleanup

- Remove the v3 catalog consumers, `live-targets-v3.json`, `ScoreCardV3`,
  focus areas, timing-band UI; update docs (`metrics-by-phase.md`).

## Open risks

- Targets come from 7 Curry shots: bands may be tight. Review real shots
  against them before tuning (overrides in the targets file survive rebuilds).
- Setup and Rise keyframes have no hand labels; they're detected only.
- Curry shoots in one motion, so the hold band will sit near zero.
