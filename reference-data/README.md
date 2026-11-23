# Reference data (pro shooters)

Pro shot clips, reviewed by a person, that the app's targets are built from
(docs/pro-targets-plan.md). Layout:

    reference-data/
      players/
        <player>/
          player.json           # { "name": "...", "shootingHand": "right" }
          <clip>/
            poses.json          # pose data per video (committed)
            labels.json         # attempts, key frames, camera angle,
                                #   approve / flag / exclude, metric flags (v2)
            video.mp4           # local only (gitignored)
      out/                      # generated — do not edit (gitignored)

Folders starting with `_` (like `_example`) are ignored.

## Reviewing clips

    npm run validate              # builds the bundles, starts the server
    open http://localhost:3000/pros

1. **+ Player**, then **+ Clip** under the player.
2. **Video…** uploads the clip's video (kept on this machine), then
   **Extract poses** runs MediaPipe in the browser and saves `poses.json`.
3. **Detect shots** adds an attempt per detected shot (or **+ Attempt** around
   the current frame). Adjust each attempt's window on the Key frames tab.
4. Per attempt:
   - **Key frames** — label each one at the current frame; the app's detected
     frame is shown beside it, with the difference (blue marks = labels, amber
     = detection on the timeline).
   - **Camera** — the estimated angle off side-on (shoulder / hip width over
     the dip → set point); adjust it if it looks wrong, mark "standing open",
     and **Confirm**.
   - **Metrics** — the app's scorecard for this attempt, corrected for the
     camera angle and measured from your key frames. Click a metric to see the
     highlighted body part and target zone at its frame; **Flag** one that's
     wrong (it's left out of the targets for this attempt). Badges show metrics
     over their angle limit and values far from the player's other shots.
   - **Decision** — approve (`A`), flag (`F`) or exclude (`X`, with a reason).

Everything saves to the clip's `labels.json` as you go. Commit `poses.json`,
`labels.json` and `player.json`; videos stay local.

Prefer near-side-on clips (within ~20°), several clips per player, and some
frames where the player turns toward the camera (it calibrates their
proportions for the angle estimate).

    npm run test:pro-review       # smoke test of the review page

## Calibrating a player (recommended)

**Calibrate** (next to the player's name) measures the player's own body
proportions from a photo or a few seconds of video of them standing
straight, whole body in the picture, camera level at about chest height:

- **Front-on** (camera square to the chest, arms slightly out): true shoulder
  and hip width. The camera-angle estimate uses these instead of population
  averages — the biggest accuracy gain (roughly ±5° → ±2–3°).
- **Side-on** (camera square to the side, legs straight): true thigh, shin,
  upper-arm and forearm length. Knee and elbow angles are then measured in 3D
  wherever a limb looks clearly shorter than it is (tipped toward / away from
  the camera: knees pushing out, elbow flaring). Elsewhere the normal
  camera-angle correction applies. The review page shows the value "without
  3D limbs" where this changed anything.

Check the skeleton on the preview before saving; warnings flag a photo that
doesn't look front-on / side-on.

## Building the app's targets

    npm run targets:build:pros            # writes the app's targets + profiles
    npm run targets:build:pros -- --dry-run   # report only

Uses approved attempts only (see `reference-data/out/report.md` after a run):

- each attempt is measured from your labelled key frames, corrected for its
  confirmed camera angle; flagged metrics and metrics beyond their camera-angle
  limit (25° in-plane / timing, 15° arm and head, guide hand never) are left
  out;
- each pro's value is a weighted mean of their attempts (near-side-on shots
  count more); every pro counts equally in the pooled targets;
- band = the 20th–80th percentile of pooled pro shots, so pros can score
  above 0; metrics where pros disagree far more than any one varies are
  marked **style** and left unscored.

It writes `app/static/reference/live-targets-v3.json`,
`app/static/reference/pro-profiles.json` and each player's proportions (in
`player.json`). Nothing is written while no pro has enough usable attempts.

Optional `reference-data/targets-config.json` (all keys optional;
`perSegment: false` turns off the 3D knee / elbow angles):

```json
{
  "percentiles": {
    "default": [0.2, 0.8],
    "byMetric": { "load.knee_depth": [0.25, 0.75] }
  },
  "minShotsPerPlayer": 5,
  "styleRatio": 2,
  "styleScored": false,
  "includeFlagged": false,
  "angleLimits": { "setPoint.elbow_angle": 20 },
  "perSegment": true
}
```
