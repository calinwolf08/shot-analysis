# Live frame rate and full-rate shot analysis

## Problem

Live pose tracking runs at whatever rate the phone manages. An Android
Firefox capture ran at ~10 pose frames/s: the full model needed ~70–100 ms per
frame, and frames were only sent on the next 33 ms capture tick after the
detector freed up. Shots were then detected and scored from those ~10 fps
frames.

## What 10 fps costs (validation)

`FPS_REPORT=1 npx vitest run src/lib/features/live-practice/debug/__tests__/fps-compare.test.ts`
subsamples every recorded pose track (`test-data/`, 13 recordings, 47 shots
detected at 30 fps) to 10 and 15 fps and re-runs detection + v3 metrics. Full
tables below. Summary:

- **Shot detection** misses 18 of 47 shots at 10 fps (38 %; e.g. one
  recording 9 → 1) and 6 at 15 fps. The detector counts frames, not time:
  telling it the true rate changes nothing.
- **Overall score** on matched shots: median |Δ| 0.25, p90 1.46 at 10 fps
  (0.14 / 0.84 at 15 fps).
- **Worst metrics at 10 fps** (median |Δ| / p90): set-point knee angle
  15° / 40°, release knee change 17° / 30°, load elbow change 38° / 102°,
  set-point hip angle 11° / 28°, wrist snap 8.5° / 26°, release elbow path
  4.5° / 50°. Posture-at-a-moment metrics (spine, hip/knee over ankle, ball
  drop) move little.

## Changes

1. **Every shot is scored at full frame rate.** After a rep, the
   coordinator runs the quick analysis of the live frames, then
   `refine/full-rate.ts` takes the rep's recorded clip, decodes every frame of
   the rep window (`shared/media/clip-decode.ts`, `requestVideoFrameCallback`
   where available; one seek, else reload + fast-forward — Android Firefox
   seeks hang) and re-detects them on a second, offline MediaPipe instance
   (`detectOffline` in the worker session; live detection pauses meanwhile).
   Detection, scoring, storage and review all use those frames. Reps the
   quick pass found no shot in are re-checked too (quietly), since 10 fps
   detection misses shots. The player hears "Shot captured / Analyzing" as
   soon as the quick pass sees a shot; the score is spoken/shown only from the
   full-rate result. Falls back to the live frames only when there is no clip
   (recording off, replay) or too few frames come back with a pose.
2. **Result-driven capture**: the next camera frame is sent the moment the
   previous frame's landmarks return, not on the next 33 ms tick.
3. **Timing in `?debug=capture`**: each frame's capture → landmarks latency,
   a `meta.timing` summary over frames WITH a pose (rate, latency p50/p90,
   frame gaps), `refine` events (frames, fps, time taken, decode method) and
   the last refined windows (`refined`).

## End-to-end check

`LIVE_VIDEO=<clip.webm> npx playwright test src-tests/e2e/manual/full-rate.spec.ts --project chromium`
plays a real side-on shot as the camera through real MediaPipe in headless
Chromium. Every scored shot came from the full-rate pass: ~29–30 fps, 85–90
frames, all with a pose, versus 38–48 live frames; refinement took ~5 s
(~10 s with `DETECT_DELAY_MS=60`, i.e. a slow phone's detection speed).

Repeated runs over the same looping footage scored 0.7–2.3: a few timing
metrics (`release.t_legs_vs_arm`, `rise.t_end`, `rise.t_spine_vs_knees`)
swing between runs even at 30 fps — event detection noise worth a separate
look.

## Validation tables

## Shots detected per recording

| recording | 30 fps | 10 fps (live today: detector told 30) | 10 fps (detector told 10) | 15 fps (detector told 15) |
|---|---|---|---|---|
| 20181219_173607 | 4 | 4 | 4 | 4 |
| 20190103_180930 | 3 | 3 | 3 | 3 |
| 20190103_181419 | 2 | 2 | 2 | 2 |
| 20190107_211108 | 1 | 0 | 0 | 0 |
| 20190124_175609 | 2 | 3 | 3 | 2 |
| 20190804_140617 | 3 | 3 | 3 | 3 |
| 20190804_140654 | 7 | 6 | 6 | 6 |
| 20190818_142631 | 3 | 3 | 3 | 3 |
| 20200606_111929 | 5 | 4 | 4 | 4 |
| 20201212_134104 | 1 | 1 | 1 | 1 |
| chris-5 | 1 | 0 | 0 | 1 |
| stephen-curry-1 | 9 | 1 | 1 | 9 |
| zak-1 | 6 | 5 | 5 | 5 |

| variant | 30 fps shots | matched | missed | extra |
|---|---|---|---|---|
| 10 fps (live today: detector told 30) | 47 | 29 | 18 | 6 |
| 10 fps (detector told 10) | 47 | 29 | 18 | 6 |
| 15 fps (detector told 15) | 47 | 41 | 6 | 2 |

## Overall score change (matched shots, 0–10 scale)

| variant | n | median change | median abs | p90 abs |
|---|---|---|---|---|
| 10 fps (live today: detector told 30) | 29 | 0.11 | 0.25 | 1.46 |
| 10 fps (detector told 10) | 29 | 0.11 | 0.25 | 1.46 |
| 15 fps (detector told 15) | 39 | 0.05 | 0.14 | 0.84 |

## Per metric: |10/15 fps − 30 fps| (matched shots, metrics reliable at 30 fps)

| metric | unit | 10 fps (live today: detector told 30) median / p90 (n) | 10 fps (detector told 10) median / p90 (n) | 15 fps (detector told 15) median / p90 (n) |
|---|---|---|---|---|
| detail.elbow_height_vs_head | torso | 0.06 / 0.16 (26) | 0.06 / 0.16 (26) | 0.05 / 0.15 (36) |
| detail.follow_through_elbow_max | deg | 1.63 / 8.05 (29) | 1.63 / 8.05 (29) | 1.48 / 7.75 (39) |
| detail.release_vs_takeoff | s | 0.14 / 2.33 (29) | 0.14 / 2.33 (29) | 0.12 / 0.85 (39) |
| detail.wrist_path_deviation | torso | 0.02 / 0.07 (25) | 0.02 / 0.07 (25) | 0.01 / 0.03 (35) |
| load.ball_close | torso | 0.03 / 0.16 (29) | 0.03 / 0.16 (29) | 0.02 / 0.07 (41) |
| load.ball_drop | torso | 0.03 / 0.22 (29) | 0.03 / 0.22 (29) | 0.02 / 0.08 (41) |
| load.elbow_angle | deg | 2.15 / 9.89 (24) | 2.15 / 9.89 (24) | 1.94 / 11.31 (35) |
| load.elbow_change | deg | 38.23 / 102.18 (21) | 38.23 / 102.18 (21) | 7.76 / 36.87 (25) |
| load.head_pitch | deg | 3.08 / 19.76 (29) | 3.08 / 19.76 (29) | 2.23 / 11.00 (41) |
| load.hip_over_knee | thigh | 0.02 / 0.10 (29) | 0.02 / 0.10 (29) | 0.01 / 0.04 (41) |
| load.knee_depth | deg | 3.30 / 12.88 (28) | 3.30 / 12.88 (28) | 1.24 / 5.29 (40) |
| load.knee_over_ankle | shin | 0.02 / 0.08 (29) | 0.02 / 0.08 (29) | 0.01 / 0.05 (41) |
| load.spine_angle | deg | 1.01 / 7.47 (29) | 1.01 / 7.47 (29) | 0.45 / 1.52 (41) |
| load.t_drop_end | phase | 0.21 / 0.49 (28) | 0.21 / 0.49 (28) | 0.07 / 0.40 (40) |
| load.t_drop_start | phase | 0.32 / 0.79 (24) | 0.32 / 0.79 (24) | 0.15 / 0.76 (34) |
| load.t_elbow_bend | phase | 0.56 / 1.48 (19) | 0.56 / 1.48 (19) | 0.51 / 1.29 (25) |
| release.elbow_path | deg | 4.45 / 49.62 (29) | 4.45 / 49.62 (29) | 2.06 / 9.03 (39) |
| release.forward_drift | leg | 0.02 / 0.10 (27) | 0.02 / 0.10 (27) | 0.01 / 0.04 (37) |
| release.guide_hand_dx | forearm | 0.08 / 0.54 (22) | 0.08 / 0.54 (22) | 0.06 / 0.17 (31) |
| release.guide_hand_dy | forearm | 0.05 / 0.30 (22) | 0.05 / 0.30 (22) | 0.04 / 0.23 (31) |
| release.knee_change | deg | 16.96 / 29.82 (27) | 16.96 / 29.82 (27) | 5.46 / 17.28 (38) |
| release.spine_change | deg | 2.18 / 7.04 (27) | 2.18 / 7.04 (27) | 0.75 / 2.29 (38) |
| release.t_legs_vs_arm | phase | 0.20 / 2.36 (27) | 0.20 / 2.36 (27) | 0.12 / 2.02 (38) |
| release.wrist_snap | deg | 8.50 / 25.72 (29) | 8.50 / 25.72 (29) | 3.72 / 17.29 (39) |
| release.wrist_vs_head_end | torso | 0.04 / 0.34 (29) | 0.04 / 0.34 (29) | 0.04 / 0.13 (39) |
| rise.elbow_change_1 | deg | 5.99 / 15.80 (21) | 5.99 / 15.80 (21) | 3.75 / 18.57 (33) |
| rise.elbow_change_2 | deg | 8.40 / 18.99 (21) | 8.40 / 18.99 (21) | 4.83 / 10.11 (33) |
| rise.head_pitch_change | deg | 5.11 / 10.54 (25) | 5.11 / 10.54 (25) | 2.89 / 14.92 (35) |
| rise.spine_change | deg | 1.35 / 3.84 (25) | 1.35 / 3.84 (25) | 0.62 / 3.61 (35) |
| rise.t_ball_vs_knee_bottom | phase | 0.44 / 1.89 (25) | 0.44 / 1.89 (25) | 0.36 / 2.33 (35) |
| rise.t_end | phase | 0.83 / 3.38 (25) | 0.83 / 3.38 (25) | 0.40 / 3.28 (35) |
| rise.t_spine_vs_knees | phase | 0.78 / 3.38 (25) | 0.78 / 3.38 (25) | 0.36 / 3.34 (35) |
| rise.t_start | phase | 0.48 / 2.15 (25) | 0.48 / 2.15 (25) | 0.31 / 2.46 (35) |
| rise.wrist_hinge_change_1 | deg | 5.79 / 14.42 (19) | 5.79 / 14.42 (19) | 2.40 / 11.41 (29) |
| rise.wrist_hinge_change_2 | deg | 4.39 / 10.41 (19) | 4.39 / 10.41 (19) | 3.17 / 9.82 (31) |
| setPoint.elbow_angle | deg | 6.94 / 39.76 (29) | 6.94 / 39.76 (29) | 5.98 / 22.82 (40) |
| setPoint.head_pitch | deg | 3.77 / 18.26 (29) | 3.77 / 18.26 (29) | 2.78 / 16.99 (40) |
| setPoint.hip_angle | deg | 11.13 / 27.63 (29) | 11.13 / 27.63 (29) | 3.35 / 15.04 (40) |
| setPoint.hip_over_knee | thigh | 0.14 / 0.30 (29) | 0.14 / 0.30 (29) | 0.06 / 0.19 (40) |
| setPoint.knee_angle | deg | 15.29 / 39.78 (29) | 15.29 / 39.78 (29) | 5.77 / 18.15 (40) |
| setPoint.knee_over_ankle | shin | 0.09 / 0.19 (29) | 0.09 / 0.19 (29) | 0.03 / 0.10 (40) |
| setPoint.spine_angle | deg | 2.27 / 7.99 (29) | 2.27 / 7.99 (29) | 0.47 / 3.35 (40) |
| setPoint.wrist_vs_head | torso | 0.13 / 0.57 (29) | 0.13 / 0.57 (29) | 0.08 / 0.17 (40) |
