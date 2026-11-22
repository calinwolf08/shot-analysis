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
