# Practice loop fixes — investigation, decisions & phased plan

Scope: the five issues reported from real-device use (practice readiness/voice,
Practice-tab UX, orientation gating, review framing, local video). Companion to
[live-redesign-plan](./live-redesign-plan.md).

---

## 1. Investigation findings (root causes)

| # | Symptom | Root cause (file) |
|---|---|---|
| 1a | "Move further from camera" spammed | `PracticeScreen.svelte#handleReadiness` speaks a cue the instant it changes, and re-speaks every 4 s. No debounce, no global cooldown. |
| 1b | Large lag between movement and the camera pose | Pose detection **is already on-device** (MediaPipe in `analysis.worker.ts`); nothing goes to the server per frame. The lag is **queueing**: `frame-capture.ts` pushes a frame every 66 ms via `setInterval` with no backpressure, so when the full model takes more than 66 ms per frame on a phone, frames pile up in the worker queue and the latency keeps growing. Fix is on-device, not a move. |
| 1c | Alternates "step back" / "turn side-on" while standing still | `checks.ts#isFullBodyVisible` requires **both** shoulders, hips and ankles at visibility ≥ 0.5. Side-on, the far-side joints are occluded (low visibility), so full-body fails, giving "step back". Facing the camera, all joints are visible, so full-body passes and orientation fails, giving "turn". The gate can never pass in the pose it asks for. `detectOrientation` has the same problem (requires all four torso joints ≥ 0.3, so it returns `unknown` side-on). |
| 1d | No clear "shot captured / analyzing" signal; shots detected while "not ready" | The coordinator never looks at readiness, so motion is detected at any angle. Earcons are 120 ms at gain 0.12 (inaudible outdoors). The "ready" earcon plays immediately after `speak()` and overlaps it. The coordinator returns to READY on a 4 s timer, not when speech ends, so a new shot can be picked up mid-readback. |
| 2 | Need "Start live practice", must exit to see Shots | `/practice` is a card linking to the full-screen `/practice/live` route outside the tab layout. |
| 3 | Non-side shots analyzed | `runReplayAnalysis` and `analyzeAndScore` score every detected shot whatever its `detectOrientation` result. Nothing filters. |
| 4 | Review pose looks rotated/sheared | `ShotReviewScreen#makeProject` maps normalized x→canvas **w** and y→canvas **h**. The source aspect ratio is never stored (`ShotReviewPoses` has only `fps`, and the live page never passes `dims`), so a landscape or odd-aspect source is stretched non-uniformly into the 3:4 stage. A lean then reads as a rotation. The view also re-centers on each frame's bbox and scales by the median height, so the extremes (arms up at release, the dip) get clipped. |
| 5 | Want real video in review | Partly built: `shot-clip-recorder.ts` (MediaRecorder) + `shot-clip-store.ts` (IndexedDB, cap 50). Gaps: the clip spans "positioned to shot" with no timestamp link to the pose frames (sync is a linear guess), there is no compression, no user setting, and no native storage. **Yes, it works on web** (MediaRecorder: Chrome/Android webm; iOS Safari 14.3+ mp4). |

## 2. Locked decisions (from the interview)

| Area | Decision |
|---|---|
| Cue pacing | Debounce + cooldown: a cue must hold **1.5 s** before it is spoken; after any cue, **≥ 5 s** global cooldown; the same cue repeats at most every **10 s**; "Ready, take your shot" is spoken once after positioned holds **1 s**. **All values in a hand-editable tuning JSON.** |
| Lag | Backpressure (never queue stale frames) + **adaptive model**: full by default, auto-switch to *lite* if p50 end-to-end latency stays above **150 ms** (threshold in tuning JSON). Latency shown in the debug HUD. |
| Shot gating | Shot detection runs **only while positioned**. A final per-shot orientation check rejects non-matching shots with the spoken line "Wrong angle, shot not counted". |
| Other orientations | Code for them stays, behind a single commented gate (`ALLOWED_ORIENTATIONS`) explaining it is currently unused. |
| Existing non-side shots | **Deleted** by a one-time migration (client + server DB, and their clips). |
| Shots list label | Replace the orientation label with **time + worst issue** (e.g. "4:12 PM · Set point low") and a score ring, grouped under date headers (Today / Yesterday / Nov 14). |
| Post-shot flow | Earcon + spoken **"Shot captured"**, then **"Analyzing"**, then the worst metrics spoken and shown. Detection stays suspended until the readback **finishes speaking**, then a distinct **"ready" earcon** (no spoken "Ready") and tracking resumes at once. The score card stays on screen without blocking. Audio-first. |
| Practice tab | The camera opens **immediately inside the Practice tab**; the tab bar stays visible. A 🎯 focus icon sits over the preview. A one-time **"Tap to start"** overlay unlocks audio (skipped once unlocked). Leaving the tab **stops the camera**; coming back resumes it. |
| Review framing | Uniform scale with the **true source aspect**, and **one static crop** fitting the whole shot (highest and lowest points just visible). The **video is zoomed to the same crop.** |
| Video | Continuous timestamped recording, cut exactly to the shot's pose frames. **Compressed** (see §3.5). **Keep last 20** by default, set in Profile ("Keep video for last N shots", 0 = off). |
| Platforms | **Web + native Capacitor** (clips in the native Filesystem on iOS/Android). |
| E2E input | **Pose-replay only** (no real footage). The camera stream for video tests is Chromium's synthetic fake device. Real-camera specs stay manual. |

## 3. Design notes

### 3.1 Tuning file
`app/static/config/live-tuning.json` (served statically and fetched at loop boot).
In dev, edit it and reload, with no rebuild. In a production or native build,
`?tuning=<url>` (dev/E2E builds only) or the debug HUD's "reload tuning" picks up
edits. A zod schema validates the file and falls back to the defaults on error,
logging a warning. Keys:

```jsonc
{
  "cues":    { "holdMs": 1500, "cooldownMs": 5000, "repeatSameMs": 10000, "readyHoldMs": 1000 },
  "latency": { "liteFallbackP50Ms": 150, "windowFrames": 30 },
  "readiness": { "nearSideMinVis": 0.5, "headMinVis": 0.5, "orientationWindow": 30 },
  "shot":    { "orientationMinAgreement": 0.6 },
  "video":   { "maxEdge": 480, "bitsPerSecond": 900000, "segmentMs": 20000, "preRollMs": 1500 },
  "earcons": { "gain": 0.35, "durationMs": 220 }
}
```

### 3.2 Readiness and orientation (fixes 1a/1c/3)
- `isFullBodyVisible` becomes **side-aware**: it needs the head plus the
  **near-side** shoulder, hip, knee and ankle (the near side is the one facing the
  camera for the required orientation). Far-side joints are ignored.
- A new `detectLiveOrientation(frames, required)` is used for readiness **and**
  per-shot gating. It uses the shoulder/hip x-separation (side-on means small) plus
  the near/far z and visibility asymmetry. It does not require far-side
  visibility, and it returns a vote fraction.
- `createCuePacer(tuning.cues)` is a pure state machine
  (`update(cue, nowMs) → speak | null`), unit-tested with a fake clock.
  `PracticeScreen` calls it instead of `audio.speak` directly.
- **Shot gate:** in `analyzeAndScore`, any shot whose orientation is not in
  `ALLOWED_ORIENTATIONS = [required]` is dropped and reported as
  `rejected: "orientation"`. The comment block documents that other orientations
  are intentionally disabled and how to re-enable them.
- The coordinator gets `setArmed(boolean)`. It is armed only while positioned and
  idle, so rise triggers are ignored when unarmed.

### 3.3 Lag (fix 1b)
- Worker posts `landmarks` per frame. `frame-capture` keeps **one frame in
  flight**: it skips capture ticks until the previous frame's landmarks return.
- Each `LandmarkFrame` carries `captureTs`. The session computes rolling p50
  latency (`now − captureTs`). If p50 stays above the threshold for a window, it
  re-inits the worker with `pose_landmarker_lite.task` (staged alongside full by
  the existing WASM staging script). This happens at most once per session and is
  logged.
- The overlay draws only frames newer than the last drawn frame.

### 3.4 Post-shot flow (fix 1d)
State machine in `LivePracticeStore`:
`TRACKING → CAPTURED (earcon + "Shot captured") → ANALYZING ("Analyzing") → READBACK (speak worst) → TRACKING (ready earcon)`.
- `AudioFeedbackService.speak()` returns a Promise that resolves on
  `utterance.onend` (with a safety timeout of length × 90 ms + 2 s). On native,
  the same goes through the TTS plugin promise. Earcons are queued **after**
  speech, never overlapping it.
- The coordinator stays disarmed from CAPTURED until the readback promise
  resolves. The `feedbackMs` auto-dismiss is removed as a gate; the card simply
  persists until the next shot.
- Rejected shot: "Wrong angle, shot not counted", then the ready earcon.
- Visual: a full-width status strip shows *Ready / Shot captured / Analyzing… /
  score*, color-coded, with large type for a spotter.

### 3.5 Video (fix 5)
- **Recording:** a ping-pong pair of MediaRecorders while armed. Each segment
  records `startTs` on the same `performance.now()` clock as the pose frames.
  When a shot is captured, the segment covering `[shotStart − preRoll, shotEnd]`
  is finalized (detection is paused, so this is cheap), and the clip record stores
  `{ shotId, blob, mime, clipStartTs, frameTimestamps[] }`. Recording restarts on
  resume.
- **Compression:** the camera stream is drawn into a canvas at `maxEdge` 480 px,
  and that canvas's `captureStream(15)` is recorded with
  `videoBitsPerSecond: 900k`, giving roughly **0.3–0.6 MB per 3–5 s shot**
  (vs ~3 MB raw). The stream is audio-less. The codec is the best available:
  VP9 > VP8 > H.264/mp4 on iOS.
- **Sync:** review maps pose frame *i* to `video.currentTime = (frameTs[i] − clipStartTs)/1000`.
  This is exact, not the current linear guess.
- **Storage:** a `ShotClipStore` interface with an IndexedDB impl (web) and a
  **Capacitor Filesystem** impl (native, `Directory.Data/clips/<shotId>.<ext>`,
  metadata in SQLite settings). The cap comes from the `videoRetention` setting
  (default **20**, 0 = off). Lowering it prunes immediately. Deleting a shot
  deletes its clip.
- **Review:** video and canvas share one transform (§3.6). If no clip exists,
  review falls back to skeleton only.

### 3.6 Review framing (fix 4)
- Persist `width`/`height` (source pixels) in `ShotReviewPoses`, from the
  downsampled frame size. A migration backfills older rows with `null`.
- `computeShotFraming(frames, aspect, stage)`: take the union bbox of all visible
  landmarks over the whole shot, convert it to pixel space with the true aspect,
  pad 6 %, and fit it into the stage with a **uniform** scale. The result is a
  constant transform with no per-frame recentering.
- The video uses a CSS `transform: translate() scale()` with the same matrix, and
  the canvas uses the same projection. For legacy rows with no aspect, the
  framing is fitted on a bbox-only basis (uniform scale, assuming square pixels in
  normalized space and a 9:16 portrait source), and the screen is flagged as
  approximate.

### 3.7 Practice tab (fix 2)
- `/practice` hosts `PracticeScreen` directly inside the tabs layout. The
  `/practice/live` route redirects to it.
- The camera and loop start in `onMount` and stop in `onDestroy` (a tab switch
  unmounts). Shot history is read from the repo, so it survives remounts.
- The "Tap to start" overlay calls `audio.unlock()` (resumes the AudioContext and
  speaks an empty utterance) and stores `audioUnlocked` for the page lifetime.
- The focus icon is overlaid top-left on the preview and opens the existing
  `FocusSheet`. Mute and pause controls are overlaid top-right. "Done" is removed.

---

## 4. Phased implementation

> **Status:** Phases 0–7 are implemented (Phase 8: native validation + docs remains) (see "Implementation notes" below).

### Implementation notes (Phases 0–1)
- **Required side corrected.** Pose data shows "side-left" means the player's
  LEFT side is nearest the camera. Curry (right-handed, labeled side-left) was
  filmed from his guide-hand side, and the app required right-handers to stand
  side-left (guide arm toward the camera) while the voice said "shooting arm
  toward the camera". With the user's decision, `requiredOrientation` is now
  **side-right for right-handers** (shooting arm nearest). Side-on 2D metrics
  are mirror images, so Curry's targets still apply.
- **Body-in-frame check uses the side actually nearest the camera** (not the
  required side), so showing the wrong side gives "turn around", not "step back".
- **Orientation** separation is divided by torso height (independent of distance
  from the camera). On labeled fixture shots it never confuses which side faces
  the camera. One labeled side-left shot is quite angled (0.59) and reads as
  "front".
- **Tuning** is edited in `app/static/config/live-tuning.json` and picked up on
  page reload (fetched `no-store`). E2E overrides it by intercepting that
  request, so the planned `?tuning=` param was not needed.
- **One Playwright project, `mobile-fakecam`** (iPhone 14 viewport on Chromium +
  fake camera), runs `*.mobile.spec.ts`. Review screenshots go to
  `app/test-results/screens/<phase>/`. `toHaveScreenshot` baselines were not
  added: the live preview (fake camera pattern) and skeleton sway are not
  pixel-stable. Specs assert test ids and states instead.
- **Speech-duration simulation** in the audio probe moves to Phase 4, which
  introduces promise-based `speak()`.

### Implementation notes (Phase 2)
- **Root cause confirmed.** With detection slowed to 150 ms per frame (a slow
  phone; capture runs every 66 ms), the old unthrottled path reached a
  **9.9 s** median capture→pose delay within about 20 s. With backpressure the
  same run stays flat at **~175 ms**, and capture ticks are skipped rather than
  queued.
- **Backpressure** lives in the live session (`isBusy`, at most one frame in
  flight, 2 s stall guard). Capture skips the tick, with no grab or downsample,
  while busy.
- **The worker handles messages strictly in order**, so a model swap can't close
  the detector mid-frame. `cancel` is still immediate.
- **Lite fallback:** under `latency.model: "auto"`, the session switches once to
  `pose_landmarker_lite.task` (now committed and staged by
  `scripts/fetch-mediapipe-assets.ts`). It switches when the median latency
  over `windowFrames`, measured after `warmupFrames`, exceeds
  `liteFallbackP50Ms`. All of these are in the tuning file, and `"full"` or
  `"lite"` pins the model.
- **HUD** (`?debug=live`) shows the median pose latency, the model, the skipped
  ticks, and a "pose model → lite" log line.
- **E2E now runs the real MediaPipe worker** on the fake camera (no replay).
  CDP CPU throttling doesn't reach workers, so a slow phone is imitated with the
  dev/E2E-only `?detectDelayMs=` (extra time per detection inside the worker;
  stripped from production, enforced by `check:stripped`).
- **The overlay needed no change:** with one frame in flight, landmarks arrive in
  order.

### Implementation notes (Phase 3)
- **Per-shot gate** in the shared core (`pipeline/core.ts#analyzeAndScore`), so
  on-device and server analysis behave the same. `allowedOrientations(hand)`
  is the single switch, with its comment explaining that other views are kept
  but not in use. Each shot's orientation now comes from the side-aware live
  detector, and that same reading feeds the v2 posture metrics. Previously the
  library detector could return "unknown" side-on and silently drop them.
- **Pipeline results** are now `{ shots, rejected }`. The server endpoint returns
  the same, and wrong-angle shots are never stored. The store speaks "Wrong
  angle, shot not counted" and shows a flash.
- **Fixed an existing bug:** when the pipeline found nothing, the coordinator
  stayed stuck in its feedback state. It is now released.
- **`coordinator.setArmed`**: reps start only while positioned, with a 750 ms
  grace so a gate flicker at the start of the shot can't drop it. A rep already
  in progress is never aborted. Without a camera gate (replay), detection is
  always armed.
- **Migration 006** (per the product decision): deletes **all** shots,
  including the hidden upload path, whose orientation isn't the player's
  shooting-arm side (side-right for right-handers). That includes
  null/"unknown". Their poses, metrics and shot scores are deleted too, and reps
  are unlinked. This is irreversible. On-device clips for those ids age out
  through the clip cap.
- **Shots list:** "Today / Yesterday / Nov 14" headers and rows labeled
  "time · worst issue". The colored deviation badge is kept instead of
  `ScoreRing`, which is a 0–100 higher-is-better ring and would mislead on this
  scale. The issue text uses today's metric names; plain wording comes in
  Part B.
- **E2E result** (mixed-angle fixture, right-handed): 2 side-right shots stored,
  5 wrong-angle shots announced and not stored.

### Implementation notes (Phase 4)
- **`speak()` / `playEarcon()` return Promises** that resolve when the sound
  finishes. Speech resolves on end, error or `cancel()`, with a safety timeout
  of 2 s + 90 ms per character. Muted or unsupported audio resolves at once.
- **Per-shot cycle** (`LivePracticeStore.cycle`): "captured" tone → "Shot
  captured" → "Analyzing" (the pipeline scores in parallel) → the worst
  metrics, or "On target" (never silence after "Analyzing") → "ready" tone →
  tracking resumes. The coordinator stays in FEEDBACK for the whole cycle, so no
  new shot can start until the ready tone. There is no fixed pause, per the
  decision. The feedback card stays up until the next shot.
- **The announcement starts when a shot is confirmed**, not when any motion
  ends. A motion that isn't a shot only flashes "No shot detected", so false
  "Shot captured" lines are avoided.
- **Wrong angle** → "Wrong angle, shot not counted" → ready tone. An empty or
  failed pipeline result → "Shot not scored" → ready tone. Pause/stop abandon
  the cycle (generation counter). "Not a shot?" cuts the readback short.
- **Positioning cues are only coached while tracking**, and "Ready" plays tone
  then words, never overlapping.
- **Earcons are louder** (gain 0.35, triangle wave) and distinct: rising
  two-note = captured, bright double-tap = ready.
- **Status strip** (`status-strip`, `data-state`) mirrors every step for a
  spotter: Shot captured / Analyzing… / Shot N · score / Ready / Get in
  position / Paused.
- **The audio probe simulates speech** in E2E builds (~60 ms per character),
  logging `speak` and `speak-end`, so order and overlap are asserted
  deterministically.
- **Known layout limit:** on a phone the big feedback card sits below the
  preview, off screen. The strip shows the score. Phase 5 (Practice tab)
  revisits the layout.

### Implementation notes (Phase 5)
- **The Practice tab is the live loop** (`routes/(tabs)/practice`). The camera
  and pose tracking start on arrival, and the tab bar stays visible.
  `/practice/live` redirects to it, keeping the query (hidden Home/plan
  links, bookmarks).
- **"Tap to start"** (once per page load, `audioUnlockState`) calls
  `audio.unlock()`, which resumes WebAudio and primes speech with a silent
  utterance inside the gesture. Mobile browsers need this. Shot detection
  (`store.start()`) and spoken cues begin only after the tap. Switching
  tabs and coming back doesn't ask again.
- **Leaving the tab unmounts the page,** which stops the store, pose session,
  camera tracks and wake lock. A boot still in flight when you leave releases
  the camera as soon as it opens (no background camera).
- **Today's shots are reloaded** on (re)entry, so the counter, average and
  "Today" sheet continue. The Shots tab has the full history.
- **Layout:** full-bleed in the tab layout. The preview flexes to the remaining
  height, and the 🎯 focus chip and mute/pause are overlaid on it. The status
  strip and a compact feedback card (score + top 3 issues) stay above the tab
  bar. The breakdown and today's list are sheets. The camera pill says
  "✓ In position" (the strip carries "Ready"). The "Done" button and the old
  Practice card/focus row are gone.
- **The dev server now serves the replay fixtures** (`vite.config.ts`, serve
  only), so the Practice tab works with `?e2e=replay` under `npm run dev`.
  This was found by the dev-parity e2e tier.
- **E2E** (`practice-tab.mobile.spec.ts`):
  - The camera is live on arrival under "Tap to start", nothing is spoken
    before the tap, and the tap is logged as an unlock.
  - The focus chip sits inside the preview.
  - The strip and feedback card are above the tab bar on an iPhone 14
    viewport.
  - Switching to Shots ends the camera tracks. Back on Practice the camera is
    live again, with no second tap and the counter continued.
  - `/practice/live` redirects, and axe passes on the new screen.

### Implementation notes (Phase 6)
- **Cause:** landmarks are normalized 0..1 on each axis. The review drew
  them at x·stageW and y·stageH (a 3:4 stage for a 9:16 camera), which
  stretched the body, so leaning read as rotation. It also re-centered and
  re-zoomed each frame, which clipped the release reach and the dip.
- **`review/framing.ts`:** one fixed transform per shot, with a uniform scale
  using the true source aspect. The zoom makes the union of every frame's
  visible joints fill the stage with a 6% margin, so the highest and lowest
  points are just visible. The same transform positions the video
  (`sourceRect`), so footage and skeleton stay registered.
- **The source size is now stored** with each shot's review poses: the
  session's `frameSize()` feeds the store, then PoseData, then
  `reviewPoses.width/height`. It is JSON in `shot_poses`, so no migration was
  needed. A clip's own `videoWidth/Height` wins when present.
- **Older shots without a size:** the aspect is estimated from the skeleton
  (limb lengths stay constant only at the true aspect), using clearly
  tracked joints (≥ 0.8), then snapped to 9:16, 3:4, 4:3 or 16:9. On labeled
  clips it always gets portrait vs landscape right, though 9:16 vs 3:4 can
  miss. Such shots show an "Approximate framing" tag.
- **Also fixed:** the phase chips moved below the stage so they no longer
  hide the feet, and their text now reads "Elbow angle low by 91" instead of
  "Elbow anglelow by 91.096".
- **E2E** scrubs every frame of a recorded shot and checks that:
  - the transform is identical across frames;
  - every frame's joints are inside the stage;
  - the movement's extremes are within 8% of the edges;
  - the stored 9:16 aspect is used exactly.

  A re-saved copy without a size shows the approximate tag with a portrait
  estimate.

### Implementation notes (Phase 7)
- **Recorder** (`shared/media/shot-clip-recorder.ts`): two staggered
  MediaRecorders ("ping-pong"), each restarting every 10 s, offset by 5 s.
  On a shot, the shortest segment that started before rep start minus the
  1.5 s pre-roll is kept, and the other is dropped. Clips never exceed 10 s.
- **Compression:** bitrate-capped (`videoBitsPerSecond` 0.9 Mbps), so about
  0.1 MB per second. The e2e clip was ~460 KB.

  Deviation from the plan: no canvas downscale. Bitrate alone bounds size,
  and canvas `captureStream` adds per-frame CPU and is unreliable on iOS
  WKWebView. Codec is VP9 → VP8 → WebM → MP4 (iOS).
- **Exact sync:** each segment records its start on `performance.now()`.
  Each stored pose frame now keeps its real capture time (`ReviewPoseFrame.t`;
  the analysis view rebases times, so it's read from PoseData). The clip
  stores `startFrameTs` on the pose-frame clock, and review seeks to
  `(t − startFrameTs)/1000`. Older clips fall back to spreading the shot
  across the clip. Play/pause lets the video drive the scrubber.
- **Storage:** IndexedDB (web) or `@capacitor/filesystem` files plus a JSON
  index in `Directory.Data/clips` (native), behind one `ShotClipStore`
  interface with `cap`/`setCap`. "Not a shot?" only excludes shots (there is
  no delete), so old clips leave through the cap.
- **Retention is per device**, not a server setting: Profile → "Keep video for
  the last" No video / 5 / 10 / 20 (default) / 50, stored in localStorage.
  Lowering it prunes at once, and 0 records nothing. The clips live only on
  that device, and server settings are currently **global across all users**
  (see below), which surfaced as cross-test interference.
- **Bug fixed — duplicate shots:** a rep window that ran to its max duration
  (the player kept moving) could contain two detected shots, and the
  pipeline stored both. One real shot showed up twice in Shots and Insights,
  and the clip went to the wrong copy. `analyzeAndScore(…, focusIndex)` now
  keeps only the shot nearest the rep trigger, on device and on the server.
- **Bug fixed — flicker:** positioning flickers as the shooting motion starts,
  which discarded the rolling clip. Clips now discard only after 3 s out of
  position.
- **Not validated here:** native iOS/Android (MediaRecorder in WKWebView,
  Filesystem writes). Phase 8, on a device.

### Findings for later (not fixed in Phases 0–7)
- **Server settings are global, not per user** (`settings` table has no
  `user_id`). Live focus areas, voice feedback and similar settings are shared
  by every account on a server. Fix: a migration adding `user_id` and
  scoping the settings repo. Video retention avoided it by being per device.
- **Frame spacing vs. assumed fps:** since Phase 2's backpressure skips camera
  ticks, live frames can be unevenly spaced. The analysis still assumes a
  fixed 15 fps (time = index / fps). Fraction-of-shot timing metrics are mostly
  unaffected, but durations in seconds can be off on slow phones. Part B
  (30 fps + sub-frame timing) should use the real per-frame timestamps,
  which the pose track now carries.

Each phase ends with its own validation (see §5) and lands as its own commit(s).

**Phase 0 — Test harness groundwork**
- E2E audio probe: in `VITE_E2E` builds, `AudioFeedbackService` mirrors every
  `speak`/`earcon` into `window.__scAudioLog` (`{t, kind, text}`) and resolves
  speech after a deterministic fake duration.
- Replay session additions: a `?replaySpeed=` control, `captureTs` stamping,
  optional injected latency (`?replayLatencyMs=`) and a "pose stream script"
  (e.g. `?replayScript=facing,turn,side`) built from fixture frames with
  synthetic visibility edits, to drive readiness scenarios.
- `?e2e=replay&fakecam=1`: poses come from replay while the camera stream comes
  from Chromium `--use-fake-device-for-media-stream` (so MediaRecorder and clip
  storage are exercised). A Playwright project `chromium-fakecam` with those
  flags plus fake-UI permission.
- A mobile Playwright project (`iPhone 14` emulation) for screenshots.

**Phase 1 — Tuning file + readiness/cue fixes (1a, 1c)**
- `live-tuning.json`, schema, and loader.
- Side-aware `isFullBodyVisible`, `detectLiveOrientation`, `createCuePacer`.
- Wire into `PracticeScreen`. The debug HUD shows the cue, positioned state and
  pacer timers.

**Phase 2 — Latency (1b)**
- Frame backpressure, `captureTs`, p50 latency, lite-model fallback, lite asset
  staging, HUD latency readout.

**Phase 3 — Orientation gating + cleanup (3)**
- `ALLOWED_ORIENTATIONS` gate in `analyzeAndScore` (and the server
  `/api/analysis/live-shot` path, which uses the same core). Gated
  other-orientation code paths are commented.
- Coordinator `setArmed`, armed only while positioned.
- Migration `006-delete-non-side-shots`: deletes shots (and `shot_poses`) whose
  orientation is not side-left/side-right **matching the player's hand**, on both
  the client and server DBs. Also prunes their clips.
- Shots list: date headers + "time · worst issue" + score ring. Orientation
  label removed.

**Phase 4 — Post-shot flow (1d)**
- Promise-based `speak`, earcon queueing, louder and distinct earcons.
- Store state machine CAPTURED → ANALYZING → READBACK → TRACKING, disarmed
  throughout. Rejected-shot line. Status strip UI.

**Phase 5 — Practice tab (2)**
- Embed the loop in `/practice`, redirect `/practice/live`, tap-to-start audio
  unlock, overlaid focus/mute/pause, stop/resume on tab change.

**Phase 6 — Review framing (4)**
- Persist the source dims, `computeShotFraming`, shared transform, legacy
  fallback.

**Phase 7 — Video capture, compression, retention (5)**
- Ping-pong timestamped recorder via a downscaled canvas stream; clip metadata
  with frame timestamps.
- IndexedDB + Capacitor Filesystem stores behind one interface.
- Profile setting "Keep video for last N shots" (default 20). Prune on change
  and on save.
- Review: exact sync, zoom-to-crop video, play/pause plus scrub.

**Phase 8 — Native validation + docs**
- `npx cap sync` and an iOS/Android build smoke. Verify camera permission
  strings, MediaRecorder in WKWebView (iOS ≥ 14.3), Filesystem clip
  write/read/prune, and native TTS end callbacks.
- Update `docs/live-redesign-plan.md`, `SETUP.md` (tuning file) and
  `app/docs/device-testing.md` (real-device checklist below).

---

## 5. Validation plan

All UI e2e specs drive the app through **real user interactions** (tab taps,
overlay tap, focus icon, scrubber drag, Profile setting changes) with
Playwright, never by calling store methods. Screenshots are taken at
`deviceScaleFactor: 2` on iPhone 14 emulation for human review, saved to
`app/test-results/screens/<phase>/`. Stable states are compared with
`toHaveScreenshot` (masked: live video and timestamps).

| Phase | Unit / integration (vitest) | E2E (Playwright, real UI) | Screenshots |
|---|---|---|---|
| 0 | Audio probe log shape; replay script builder produces the intended visibility edits. | Smoke: `?e2e=replay&fakecam=1` boots; fake camera stream present; `__scAudioLog` populated. | — |
| 1 | `createCuePacer`: hold, cooldown, repeat, ready-once with a fake clock. Side-aware full-body passes on side-on fixture frames with an occluded far side (regression for 1c). `detectLiveOrientation` on labeled fixture windows: ≥ 90 % agreement with `labels.json` side shots. Tuning schema fallback. | Script `facing → turn → side`: assert the audio log has **no cue repeated within 10 s**, **no two cues within 5 s**, the cue sequence is `turn` (never alternating with `step back` once side-on), then exactly one "Ready". Edit the tuning file (`?tuning=`) to 3 s cooldown and assert the spacing changes. | Readiness banner: not-ready cue, ready. |
| 2 | Backpressure: with a fake worker taking 150 ms per frame, the in-flight count is never > 1 and latency stays bounded (vs unbounded growth before). p50 tracker and fallback trigger. | Replay with `replayLatencyMs=200` plus CDP CPU throttle 4×: HUD latency stays < 300 ms over 30 s and the model switches to lite once (HUD + console). The overlay `data-frame` is monotonic. | HUD with latency readout. |
| 3 | `analyzeAndScore` drops non-matching shots on fixture `20190804_140654` (mixed side-left/side-right/behind) and keeps the expected side shots. Migration deletes exactly the non-side rows (seeded DB) and leaves others intact. Coordinator ignores rises while unarmed. | Left-handed player (side-right required) replays `20190804_140654`: only side-right shots appear in the **Shots tab** (checked by tapping into it); the audio log has "Wrong angle, shot not counted" for the side-left ones. Seed a front-right shot, reload, and assert it is gone. The Shots list shows date headers and "time · issue" with no orientation text. | Shots list (grouped, new labels). |
| 4 | Store sequence + timing: detection stays disarmed until the speak promise resolves; earcons never overlap speech; a rejected-shot path. | Replay a 3-shot fixture: the audio log order per shot is `earcon:captured, "Shot captured", "Analyzing", <worst>, earcon:ready`. **No `repStarted` between "Shot captured" and earcon:ready** (coordinator debug events). The status strip text transitions are asserted by test id. With mute on, the visual strip still transitions. | Status strip: Ready / Shot captured / Analyzing / score. |
| 5 | — | Open the app, tap the **Practice** tab: the camera preview shows with no extra button; the tap-to-start overlay appears; tap it; the loop runs. Tap the 🎯 icon and change focus: the chip updates. Tap the **Shots** tab: the camera tracks stop (`getTracks().every(t => t.readyState==='ended')` via a page hook) and the previous shots are listed. Back to Practice: the camera resumes and the overlay does not reappear. `/practice/live` redirects. axe a11y on the new screen. | Practice tab with overlay, after start, focus sheet open. |
| 6 | `computeShotFraming`: uniform scale (sx == sy); the union bbox fits with the top and bottom within the padding; landscape/portrait/legacy cases; no per-frame translation. | Open a replayed shot's review and drag the scrubber across the full range. A page hook reports the projected bbox per frame: all joints are inside the canvas, the highest/lowest points are within 8 % of the top/bottom edges, and the transform is identical across frames. | Review at gather, setPoint, release (the "rotated" regression). Before/after pair for the PR. |
| 7 | Clip store contract for IndexedDB and memory/Filesystem mocks: save, get, prune to N, prune on setting decrease, delete with shot. Frame→time mapping. Recorder segment selection covers `[start − preRoll, end]`. | fakecam project: take replayed shots, open review, `review-video` is present with a non-zero duration and blob size **< 1 MB**. Scrub to frame *k* and assert `video.currentTime ≈ (frameTs[k] − clipStartTs)` (±1 frame). Profile: set N=1 through the UI, take 2 shots, and the older shot's review falls back to skeleton. N=0 records nothing. | Review with video + overlay zoomed (fake-device pattern), Profile setting. |
| 8 | — | `npm run verify` (check, lint, unit, build, bundle-size, debug-stripped) and the full Playwright suite on prod + dev projects. | — |

### Manual real-device checklist (required; not automatable without footage)
Run on iPhone Safari, Android Chrome, and the native iOS/Android builds:
1. Stand side-on at a normal distance: you hear "Ready, take your shot" within
   about 3 s, with no "step back"/"turn" alternation.
2. Wave an arm. The overlay tracks with no visible lag (HUD < 150 ms, or the lite
   fallback has engaged).
3. Face the camera and shoot: nothing is captured, or you hear "Wrong angle".
4. With earbuds, shoot from side-on: earcon, "Shot captured", "Analyzing", the
   metrics, then the ready earcon. A second shot during the readback is ignored.
5. A spotter watching the screen sees the status strip change for each shot.
6. Shots tab, then Practice tab: the camera stops and resumes, and the focus
   icon works.
7. Review: the video plays zoomed with the skeleton registered, and the top and
   bottom of the motion are just visible.
8. Profile N=20: the clip count stays ≤ 20, and the storage per clip is noted.

## 6. Risks and open items
- **Without real footage**, `detectLiveOrientation` thresholds are validated only
  on fixture pose data. The tuning file and checklist step 1 cover tuning on
  device. Adding 2–3 real clips later would activate the existing
  `manual/real-analysis.spec.ts`.
- The iOS WKWebView canvas `captureStream` + MediaRecorder needs iOS ≥ 14.3. If
  it is unavailable, recording is skipped and review falls back to skeleton.
- Native validation (Phase 8) needs a Mac/Xcode or Android device; it cannot run
  in the cloud container.
- Deleting the non-side shots is irreversible. The migration logs counts and runs
  once.

---

# Part B — Metrics overhaul + Curry model viewer

Phases 9–15 follow Part A (phases 0–8). They depend on Phase 0's harness and
Phase 6's review framing (reused by the viewer). The 30 fps change (B-2.4)
builds on Phase 2's backpressure and lite-model fallback.

## B-1. Investigation findings

| Area | Today | Gap vs. request |
|---|---|---|
| Targets source | `src/testing/build-live-targets.ts` runs v2 metrics over the 7 labeled `stephen-curry-1` shots using **detected** keyframes and writes `app/static/reference/live-targets.json` (88 ids). | There is no way to see what was measured on Curry. Some values look suspect: for example, set-point elbow angle ≈ 144° suggests the detected set point may sit late. |
| Curry video | `Stephen Curry 1.mov` (1920×1080, 30 fps, 925 frames) is **gitignored / local only**. `poses.json` + `labels.json` are committed. | The viewer must load the video from local disk. NBA footage can't ship. |
| Normalization | Distances are ÷ `bodyScaleY` = nose-to-ankle **vertical span of the same frame**. | That span shrinks as the player crouches, which inflates load/rise distances. Some anatomy also leaks through (head height vs. leg length). |
| Sequencing | 7 signed gaps between consecutive events, as a **fraction of the whole shot**. | The request is **per-phase %** of specific event pairs. Several events don't exist yet (ball drop start, hip drop start/low, ball rise end, elbow bend start, spine straightened). |
| Timing resolution | Curry shots are ~18 frames at 30 fps (rise ≈ 4 frames, so 25 % per frame). Live runs at **15 fps**. | Per-phase % is meaningless at frame granularity. It needs 30 fps plus sub-frame interpolation. |
| Structure | Posture = joint x-offset from feet center (head/shoulders/hips/knees/ankles). Also wrist cock, wrist height/dist, elbow angle (set point only), elbow "flare", guide-hand timing, elbow height vs head, wrist snap, elbow extension. | **Missing:** spine angle, head/neck vs spine, knee angle (depth), hip angle, hip-over-knee, knee-over-ankle, elbow angle in load/rise, elbow travel direction in release, guide-hand position, knee/spine change in release. `*.ankles` is ≈ 0 by construction. |
| Score scale | `score = clamp(1 + normDev, 1, 10)`, lower is better, 1 = on target. | The request is **0 = perfect, 10+ = way off** (display capped at 10). |
| Labels | Ids like `load.knees_delta`, `seq.ball_rise__leg_low`. | The request is plain-language wording plus coaching cues. |
| Debug routes | `/__debug/{analyze,drills,replay,scorecard}` exist. `/__debug` has no index. | Add an index page and a temporary Profile link. |

## B-2. Locked decisions (from the interview)

### B-2.1 Phases (4 scored groups)
**Load → Rise → Set Point → Release.** Gather and Follow-Through are dropped as
groups. Wrist snap moves into Release. Each phase window is a fixed denominator
for timing:

| Phase | Window |
|---|---|
| Load | first of (ball starts dropping, hips start dropping) → last of (ball lowest, hips lowest) |
| Rise | end of Load → set point (ball highest before the arm extends) |
| Set Point | snapshot at the set-point frame |
| Release | set point → shooting arm fully extended (wrist snap looks ~0.3 s past this) |

**Timing metric** = signed `(t_B − t_A) ÷ phase duration`. A negative value
means the order is wrong. This one number captures **both order and the % gap**.

### B-2.2 Normalization
- **Angles in degrees** wherever possible (inherently anatomy-free).
- Distances are ÷ the player's **own segment length**, taken as the median over
  the shot's frames for: thigh (hip→knee), shin (knee→ankle), torso (shoulder
  mid→hip mid), forearm (elbow→wrist), and leg (thigh + shin).
- Side-on, the **near-side** joints are used (shooting side toward camera; the
  pose is mirrored for left-handers). Far-side joints are used only for the guide
  hand.
- "Toward the hoop" is positive for every horizontal offset.

### B-2.3 Metric catalog (scored)

Notation: **S** = structure, **T** = timing (% of phase, signed). All angles use
near-side landmarks. Spine = hip-mid→shoulder-mid vs. vertical (+ = leaning
toward the hoop). Head/neck = ear→shoulder line vs. the spine line. Knee angle =
hip-knee-ankle (180 = straight). Hip angle = shoulder-hip-knee.

**Load**
| id | Type | Measures | Unit |
|---|---|---|---|
| `load.spine_angle` | S | Spine lean at deepest load | ° |
| `load.head_vs_spine` | S | Head/neck angle at deepest load | ° |
| `load.knee_depth` | S | Minimum knee angle | ° |
| `load.hip_over_knee` | S | Hip x relative to knee x at deepest load (− = sitting back) | % thigh |
| `load.knee_over_ankle` | S | Knee x relative to ankle x at deepest load (+ = forward) | % shin |
| `load.ball_drop` | S | Wrist height relative to hip height at ball lowest (− = below hip) | % torso |
| `load.elbow_angle` | S | Elbow angle at ball lowest | ° |
| `load.elbow_change` | S | Elbow angle change across load | ° |
| `load.ball_close` | S | Wrist distance from hip at ball lowest *(extra)* | % torso |
| `load.t_drop_start` | T | Ball starts dropping vs hips start dropping | % load |
| `load.t_drop_end` | T | Ball lowest vs hips lowest | % load |
| `load.t_elbow_bend` | T | Elbow starts bending vs ball starts dropping | % load |

**Rise**
| id | Type | Measures | Unit |
|---|---|---|---|
| `rise.t_start` | T | Ball starts rising vs knees start straightening | % rise |
| `rise.t_end` | T | Ball reaches set point vs knees fully straight | % rise |
| `rise.elbow_change_1` / `_2` | S | Elbow angle change over 0–50 % / 50–100 % of rise | ° |
| `rise.wrist_hinge_change_1` / `_2` | S | Wrist hinge change over 0–50 % / 50–100 % of rise | ° |
| `rise.spine_change` | S | Spine angle change over rise | ° |
| `rise.t_spine_vs_knees` | T | Spine finishes straightening vs knees finish | % rise |
| `rise.head_vs_spine_change` | S | Head/neck angle change over rise | ° |

**Set Point** (snapshot)
| id | Measures | Unit |
|---|---|---|
| `setPoint.wrist_vs_head` | Shooting wrist height relative to head (ear) height | % torso |
| `setPoint.elbow_angle` | Elbow angle | ° |
| `setPoint.spine_angle` | Spine lean | ° |
| `setPoint.knee_angle` | Knee bend | ° |
| `setPoint.hip_angle` | Hip bend | ° |
| `setPoint.hip_over_knee` | Hip x relative to knee x | % thigh |
| `setPoint.knee_over_ankle` | Knee x relative to ankle x | % shin |
| `setPoint.head_vs_spine` | Head/neck angle | ° |

**Release**
| id | Type | Measures | Unit |
|---|---|---|---|
| `release.elbow_path` | S | Elbow travel direction from set point to extension (0 = straight up, + = toward the hoop) | ° |
| `release.wrist_vs_head_end` | S | Shooting wrist height relative to head at arm extension | % torso |
| `release.guide_hand_end` | S | Guide wrist offset from shooting wrist at extension (dx, dy). **Unmeasured when far-side visibility < 0.5** | % forearm |
| `release.knee_change` | S | Knee extension change across release | ° |
| `release.spine_change` | S | Spine angle change across release | ° |
| `release.wrist_snap` | S | Max wrist flexion within 0.3 s after extension (unreliable when finger visibility is low) | ° |
| `release.forward_drift` | S | Hip + head travel toward the hoop from load end to release end *(extra)* | % leg |
| `release.t_legs_vs_arm` | T | Legs fully straight vs arm fully extended | % release |

**Kept as unscored "Details"** (viewer + shot-review Details section; not in the
score or the voice readback): wrist path straightness (rise), elbow height vs
head (release), guide-hand separation timing, jump timing (release vs feet
leaving the ground), follow-through elbow extension.
**Removed:** gather posture/ball height, elbow flare, `*.ankles`, and the old
per-joint `_start/_end/_delta` posture offsets.

**New events** (sub-frame timestamps, see B-2.4): ball drop start, hip drop
start, hip lowest, ball lowest, ball rise start, set point, knees start
straightening, knees fully straight, elbow bend start, spine straightened, arm
fully extended. The existing keyframe detector supplies the ones it has. The
rest are new detectors over smoothed joint signals.

### B-2.4 Timing resolution
- Live tracking goes to **30 fps**, using Part A's backpressure + lite fallback.
  If the device can't sustain it, the effective fps is recorded per shot and
  timing metrics are flagged *low resolution* when the phase is under 6 frames.
- **Sub-frame event times:** each signal is smoothed (Savitzky–Golay, window 5),
  and events are found by interpolating the threshold or extremum crossing
  between frames (parabolic fit for minima/maxima). Unit tests use synthetic
  signals with known sub-frame events.
- Recommendation (doc only): record future reference clips at 60 fps.

### B-2.5 Scoring scale
- Within Curry's band `[passMin, passMax]`, the score is **0**.
- Outside the band, the score is `(distance beyond the band edge) ÷ rampSd`, so
  +1 per Curry SD. It is continuous with 1 decimal and the display is capped at
  **"10+"**. The stored value is uncapped.
- Phase score = mean of its measured metrics. Overall = mean of the 4 phases.
  Coverage gating is unchanged.
- Score color bands: 0–1 green, 1–3 yellow, 3–6 orange, 6+ red. The legend sits
  on the scorecard.

### B-2.6 Wording (both styles)
Each metric entry in `live-targets.json` gains `label`, `unitLabel`, and per
direction `{ phrase, cue }`. All are hand-editable.
- **Scorecard (measurement):** "Knee bend — too shallow by 12° (target 95–110°)" ·
  timing: "Ball started rising 15 % of the rise *after* your legs (target: 5–20 % before)".
- **Voice (coaching cue, terse):** "Bend your knees more" / "Start the ball up
  sooner". This uses the 5 worst, with focus areas respected.
- Default phrases and cues are authored for every metric/direction in the
  targets builder and preserved across rebuilds (hand edits win).

### B-2.7 Curry model viewer (dev only) — `/__debug/reference`
- **Video:** in dev, served from `test-data/stephen-curry-1/` through a dev-only
  Vite middleware. Otherwise a file picker loads it locally. Without it the
  viewer is skeleton-only. The video is never bundled or committed.
- **Overlay:** the Phase 6 renderer (true aspect, static fit). The measured
  geometry for the selected metric is drawn: angle arcs, the spine line,
  hip→knee and knee→ankle offsets, the wrist-vs-head bar, and phase/event
  markers on the scrubber with sub-frame ticks.
- **Per-shot metric table:** rows = metrics (grouped by phase, plain-language
  label), columns = the 7 Curry shots, plus mean, band, SD. Outliers > 2 SD and
  unmeasured cells are flagged. Clicking a cell seeks that shot to the metric's
  frame and draws its geometry.
- **Compare:** pick one of *my* shots and play it side-by-side with a chosen
  Curry shot, **phase-time-aligned** (each phase stretched to the same duration).
  Both skeletons are drawn with the same renderer, and the metric table shows my
  value next to the band.
- **`/__debug` index:** links to every debug route (analyze, drills, replay,
  scorecard, reference). A temporary "Debug tools" button on the Profile page
  (dev/E2E builds only, marked `TEMP` in code).

### B-2.8 Existing shots
The metric schema bumps to `schemaVersion: 2`. On read, shots with v1 metrics
are **recomputed from their stored review pose track** (2D + visibility is
enough for every new metric) and the result is persisted back. Shots without a
pose track show "Re-analysis unavailable" and are excluded from Insights trends.

## B-2.9 Implementation notes (Phase 9)
- **`/__debug` index** (`routes/__debug/debug-routes.ts`): a unit test checks
  the list against the route folders, so a new tool can't be left off.
  A **TEMP "Debug tools →" link** sits in Profile (dev/E2E builds only).
  `check:stripped` asserts that it, the index, and the viewer markup are
  absent from production.
- **Curry model viewer** (`/__debug/reference`):
  `features/reference/curry-model.ts` measures the 7 labeled Curry shots
  exactly like `targets:build`. A unit test proves parity: the mean, min,
  max and n of every target are reproduced to 1e-9. The library now exports
  `keyframeFramesFromPoseData` for this.
  - The table groups rows by phase, then sequencing, with one column per
    shot plus mean, band and SD. Cells more than 2 SD out are flagged,
    unmeasured cells show "—", and unscored rows are faded.
  - Clicking a cell selects that shot and seeks to the frame where it was
    measured.
  - The stage reuses the Phase 6 framing (true 16:9 aspect, whole-shot fit).
- **Data:** in dev, a serve-only middleware reads it from
  `test-data/stephen-curry-1/` (poses, labels, `manifest.json`, and the
  local-only video with Range support). The e2e build gets poses and labels
  copied in, with `manifest.json` set to `{video:false}`. There is no video in
  CI, so the viewer is skeleton-only with a file picker.
- **What the table already shows** (input for Phases 10–12):
  - `setPoint.elbow_angle` is 135–152° on every shot. A true set point is a
    bent elbow (~90°), and shot 4's skeleton at the measured frame has the arm
    nearly extended. So the **detected set point lands late** (near release),
    which is why "elbow angle low by 91" shows on user shots.
  - **Wrist-cock and wrist-path metrics are unmeasured on 3–4 of 7 shots**
    (finger landmarks), so their targets rest on 3–4 values.
  - **Some sequencing gaps read 0** on several shots (e.g. ball low → ball
    rise), meaning events landed on the same frame at 30 fps. This is the
    resolution problem B-2.4 addresses.
  - Ankle rows are 0 by construction (already excluded from scoring).

## B-2.10 Implementation notes (Phase 10)
- **`src/metrics/v3/signals.ts`:** per-frame signals for the shooting wrist
  height, near hip height, near knee angle, near hip angle, shooting elbow
  angle and spine lean, plus median segment lengths.
  - **Angles use true proportions:** x is scaled by the frame aspect. The v2
    angles were computed on per-axis-normalized coordinates, which distorts
    every non-axis-aligned angle, and differently on a landscape reference
    than on a portrait phone. **Correction to the Phase 9 note:** Curry's
    135–152° "set-point elbow" was this distortion, not a late set point. With
    true proportions his elbow at the labeled set point is ~30–40°.
  - **Real timestamps** are used, not index ÷ fps. Gaps of up to 3 frames are
    bridged, then smoothed with a 5-point Savitzky–Golay filter.
- **`src/metrics/v3/events.ts`:** sub-frame events.
  - Turning points (ball lowest, hips lowest, deepest knee, most-bent elbow)
    are refined with a parabola.
  - Onsets (hips/ball drop, ball rise, knees start straightening, set point,
    elbow bend) are where the speed toward the coming turning point first
    reaches 20% of its peak (10% for ball rise), interpolated.
  - Completions (knees straight 80%, arm extended 90%) are interpolated
    threshold crossings.
- **Definitions that came out of matching the labels:**
  - **Set point** is the *start of the elbow's extension* after its most-bent
    point (the labels mark the end of the hold, not the minimum).
  - **Knees start straightening** is the onset of knee extension.
  - The shot is anchored on the hand's *first* arrival at its peak (release),
    because a held follow-through peaks later.
  - Legs are searched in a window anchored on the ball events, so the landing
    dip can't pose as the load.
- **`phaseWindows`** builds the Load / Rise / Release windows per B-2.1.
- **Agreement with the human labels** (`npx tsx src/testing/eval-events-v3.ts`,
  34 side-on shots). "Old" is the current keyframe detector, which was built
  to match these same labels, so it is a tuned baseline rather than an
  independent one. Start labels placed on a window's first frame are clipped
  and excluded.

```
label                    n   v3 ±1  ±2   med  bias miss | old ±1  ±2   med  bias miss
ball_low_point           19    37%  63%  1.75 -1.50   0 |   53%  63%  1.00  0.21   0
ball_starts_upward       23    61%  78%  0.95 -0.08   0 |   74%  87%  1.00 -0.30   0
leg_bend_low_point       23    48%  74%  1.03 -1.12   0 |   83%  83%  0.00 -0.52   0
legs_start_extending     23    52%  65%  0.96 -2.40   0 |   83%  83%  0.00 -0.65   0
set_point                23    65%  91%  0.69 -1.26   0 |   70%  87%  0.00  0.17   0
arms_fully_extended      23    70%  87%  0.56 -1.75   0 |   65%  74%  1.00  0.52   0
legs_fully_extended       7    29%  43%  2.48 -3.69   0 |  100% 100%  0.00  0.00   0
ALL 141: within ±1 — v3 55% · old 73%; within ±2 — v3 75% · old 81%
```

  The ±1-frame ≥ 80% target from B-4 is **not met overall**. The events the
  timing metrics depend on most do match well within 2 frames: set point 91%
  (old 87%), arm extension 87% (old 74%) and ball rise 78%. Low points
  (ball/hips) sit on flat stretches where the "lowest frame" is ambiguous to
  a person too, and they are weakest. Some Curry shots barely bend the knees,
  which leaves the knee events noisy. `v3.test.ts` guards today's levels as
  floors.
- **Viewer:** each Curry shot shows a detected-vs-labeled event table (Δ in
  frames, amber over 1, red over 2, clipped labels marked), plus
  detected/labeled markers on the scrubber with a labels toggle. Clicking an
  event seeks to it.

## B-2.11 Implementation notes (Phase 11)
- **`src/metrics/v3/metrics.ts`** implements the full B-2.3 catalog: Load (12),
  Rise (9), Set Point (8) and Release (9, with the guide hand as `dx`/`dy`),
  plus 4 unscored details. Details: wrist path deviation, elbow height vs
  head, release vs take-off (s), follow-through elbow max.
  - **Angles** use true proportions.
  - **Distances** are divided by the shot's median thigh, shin, torso, forearm
    or leg length.
  - **Horizontal offsets** are + toward the facing direction.
  - **Timing** is signed (B − A) ÷ the phase's real duration.
  - Each metric carries `kind` (structure, timing or detail), `phase` and
    `unit`.
  - Guide-hand metrics need the guide wrist ≥ 0.5 visible; wrist hinge and
    snap need the index finger ≥ 0.5. Otherwise they are unreliable with a
    note. Timing over a phase shorter than 6 frames is noted "low
    resolution".
  - `schemaVersion: 2`. The v2 module is untouched; it is removed from the
    live path in Phase 14.
- **Timestamp units:** recorded pose files store **milliseconds** while the
  live path stores seconds. Signals detect the unit from frame spacing.
- **Invariance tests** (`metrics.test.ts`) pass. Curry's exact pixel skeleton
  redrawn at half size on a **portrait 1080×1920** canvas, at ×2 zoom, or
  **mirrored as a left-hander**, and timestamps in ms vs s, all give
  identical metrics. The tests also cover reliability rules and a golden
  snapshot.
- **Viewer:** a "New metrics (v3) / Current targets (v2)" switch. v3 shows
  the 7 Curry values plus mean, band and SD computed from them (what Phase 12
  will publish).
- **What v3 shows on Curry** (to audit before Phase 12):
  - **Set-point elbow is 37–75°** (v2 said 135–152°, a distortion).
  - **Timing metrics are very spread** (e.g. rise start −2.1…+0.05 of the
    rise) because his rise and release last only ~3–4 frames at 30 fps; all
    are flagged low resolution. Bands from these 7 shots will be wide.
    60 fps reference footage would tighten them.
  - **Load elbow change is unmeasured on 6 of 7 shots:** his shooting arm is
    the occluded far side early in the load (guide-side camera).
  - **Curry reads as slightly leaning back** (spine −7…−17°) with the head
    well forward of the spine line (+30…+42°). Other side-on shooters in
    test-data lean forward in the load (+7…+28°), so the sign convention is
    consistent. This is worth confirming against his video in the viewer.

## B-2.12 Implementation notes (Phase 12)
- **Feedback is now 3 items, named by phase and in phase order** (user
  request). This applies to the current live (v2) path now and carries into v3:
  - `FEEDBACK_COUNT = 3` (`loop/readback.ts`). The store's `maxWorstSpoken`
    defaults to it.
  - `feedbackItems()` takes the 3 worst, then orders them Load → Rise → Set
    point → Release.
  - Voice groups by phase: "Load: knee bend too shallow. Set point: elbow
    flare high by 6."
  - The feedback card shows each chip with its phase name first
    (`data-testid="feedback-item"`).
  - E2E (`live-practice.spec.ts`) asserts ≤ 3 items, in phase order.
- **Wording catalog** (`src/metrics/v3/wording.ts`): a label, plus a low/high
  `phrase` (scorecard) and `cue` (voice), for every v3 metric.
- **Targets** (`src/metrics/v3/targets.ts`, `npm run targets:build:v3` →
  `app/static/reference/live-targets-v3.json`):
  - 42 metrics, 37 scored.
  - Band = mean ± SD over Curry's shots. Metrics with fewer than 3 reference
    values are left unscored.
  - Hand edits (label, wording, band override) survive rebuilds.
- **Scoring** (`app/src/lib/features/scoring/v3/score.ts`):
  - 0 inside the band, +1 per `rampSd` outside it; the display caps at "10+".
  - Phase score = mean of its metrics; overall = mean of the phases.
  - An excess under 5% of a ramp step counts as on target.
  - `feedbackV3` gives the 3 worst as phase-grouped cues.
  - `ScoreCardV3.svelte` shows the phases in order, with a legend.
  - Curry leave-one-out scores average 0.35 (max < 0.7).
- **Debug replay** has a v3/v2 view switch (`e2e/scoring-v3.spec.ts`). The
  live path still scores v2 until Phase 14.
- **Clip coverage fix:** the shot clip recorder now keeps **3 staggered 15 s
  segments** instead of 2 × 10 s.
  - A shot reaches the recorder only after it ends and is analyzed, ~9 s
    after its pre-roll began. The 2 × 10 s scheme only guaranteed 5 s of
    lookback, so a second shot's clip could start mid-shot.
  - The new scheme guarantees ≥ 10 s of lookback.
  - Clips are now ≤ ~1.7 MB.
  - The recorder also restarts right after a take, without waiting for the
    feedback to finish.

## B-3. Phased implementation (Part B)

**Phase 9 — Debug index + Curry viewer shell**
- `/__debug/+page.svelte` index, the Profile TEMP button, and the
  `/__debug/reference` route.
- Dev middleware for the local video, plus the file-picker fallback. Load
  `poses.json`, `labels.json` and `live-targets.json`.
- Current (v1) metrics in the per-shot table, so you can **audit today's
  targets before anything changes.**

**Phase 10 — Signals, events, sub-frame timing**
- `src/metrics/v3/signals.ts`: smoothed per-frame signals (spine angle,
  head-vs-spine, knee/hip/elbow angles, wrist hinge, wrist/hip heights, segment
  lengths).
- `events.ts`: the new event detectors with sub-frame interpolation, plus phase
  windows per B-2.1.
- The viewer shows the detected events vs. the human labels on the scrubber
  (read-only, for sanity checking).

**Phase 11 — Metric catalog v3**
- `src/metrics/v3/{load,rise,setPoint,release}.ts` per B-2.3, with segment-length
  normalization, near-side selection, and reliability flags (guide hand, wrist
  snap, low-resolution timing).
- Details (unscored) block. Flatten to ids. `schemaVersion: 2`.
- Old v2 module kept until Phase 14 removes its callers.

**Phase 12 — Targets v2 + scoring scale + wording**
- `targets:build` emits the v3 ids with band/SD, plus default
  `label`/`phrase`/`cue`, merged with existing hand edits.
- `scoreDeviation` rewritten to the 0–10+ scale (B-2.5). The 4-phase grouping
  replaces Structure/Sequencing sections. Within a phase, the Position and
  Timing sub-lists remain.
- Readback uses `cue`. The scorecard uses `phrase` + target text + score chip +
  legend.

**Phase 13 — Viewer: geometry overlays + compare**
- Per-metric geometry drawing, cell-click seek, outlier flags.
- Side-by-side phase-aligned compare with my shots.

**Phase 14 — Pipeline integration + migration**
- The live pipeline, server endpoint and replay pipeline compute v3. Live
  capture at 30 fps.
- Read-time recompute of v1 shots from the stored pose track, then persist.
  Insights use v3 ids. Old focus-area ids are mapped to the new phase-based
  areas.
- Remove the v2 live path. The hidden assessment path keeps v2 untouched.

**Phase 15 — Docs**
- Update `docs/metrics-by-phase.md` with the v3 catalog (definition, formula,
  unit, landmarks, reliability rule per metric) and `docs/live-redesign-plan.md`
  with the scale and phases.

## B-4. Validation plan (Part B)

The same conventions as §5 apply: real UI interactions, screenshots at DPR 2,
and `toHaveScreenshot` for stable states. The Curry video isn't in CI, so the
viewer e2e runs **skeleton-only**. Video-backed checks are on the manual
checklist.

| Phase | Unit / integration (vitest) | E2E (real UI) | Screenshots |
|---|---|---|---|
| 9 | Debug index lists every `__debug` route (glob test, so new routes can't be forgotten). | Profile → tap "Debug tools" → index → tap "Reference" → the table renders 7 shot columns, scrub a shot. The button is absent from a production build (`check:stripped` extended). | Index, viewer (skeleton-only). |
| 10 | Synthetic signals with known sub-frame events: recovered within ±0.15 frame. Smoothing doesn't shift extrema. Phase windows from event sets, including missing-event fallbacks. **Curry agreement:** detected events vs. `labels.json` across the 7 shots within ±1 frame for ≥ 80 % of events (the report is printed). | Viewer: event markers render. Toggling "labels" shows the human markers, and disagreements are highlighted. | Scrubber with detected + labeled markers. |
| 11 | Each metric has a hand-computed fixture (a synthetic skeleton with known angles/lengths), so exact values are known. **Anatomy invariance:** scaling limbs ±20 % or the whole body ×0.5/×2 leaves every metric unchanged (±1 %). **Mirroring:** a left-hand mirrored pose gives the same values. Unmeasured rules (guide hand hidden, low fps). Golden snapshot over the 3 replay fixtures + Curry. | — | — |
| 12 | Scale: in band = 0, 1 SD beyond = 1.0, display caps at "10+", uncapped stored. Phase/overall means. Builder merge keeps hand-edited phrases. Every v3 id has a label, phrase and cue (a lint test). Curry's own shots score ≤ 1 on average (sanity). | Replay a shot → the scorecard shows 4 phases, the "10+" cap, the legend, and plain wording. The audio log contains a cue string (not an id). Focus sheet → choose "Rise" → the readback only includes rise cues. | Scorecard (live feedback + shot review), legend. |
| 13 | Phase-time alignment maps phase boundaries 1:1. | Viewer: click a cell (e.g. Load · knee depth · shot 3) → the scrubber seeks to that frame and the angle arc is drawn (canvas probe hook). Compare: pick my replayed shot → both stages play and the phase labels match at each boundary. | Geometry overlay per metric family (angle, offset, height bar), compare view. |
| 14 | Recompute-from-pose-track equals direct v3 analysis on the same frames (±1 %). Migration is idempotent. 30 fps capture timestamps are monotonic. | Seed a v1 shot → open Shots → the review shows the v3 scorecard, and the row is persisted as schema 2 (API probe). Full live replay flow end-to-end with v3. Insights tab renders the new phase ids. | Insights with v3 issues. |
| 15 | `npm run verify` + the full Playwright suite (prod + dev). | — | — |

**Manual (needs the local Curry video + a real device):**
1. Dev server → `/__debug/reference` loads the `.mov` automatically. The
   skeleton sits on Curry with no aspect distortion.
2. For each phase, click 2–3 metric cells. The drawn angle or offset visually
   matches the footage, and the target band looks plausible. Correct
   `live-targets.json` by hand where needed.
3. Compare one of your real shots with Curry. The phases line up and the
   differences you see match the scored metrics.
4. On the phone, live 30 fps holds (HUD), or the lite fallback engages and
   timing metrics show "low resolution" when appropriate.

## B-5. Risks
- **7 Curry shots is a thin baseline.** Bands from min/max of 7 values are
  tight, so expect many non-zero scores at first. The viewer is the tool to widen
  them by hand.
- **Far-side landmarks** (guide hand, far ear) are unreliable side-on.
  Reliability flags keep them out of scores rather than guessing.
- **Wrist hinge and wrist snap rely on finger landmarks**, which are noisy at
  256 px. Phase 2's capture `maxEdge` may need raising to 384 for these. This is
  measured in Phase 11 against Curry.
- **Sub-frame interpolation can't invent information.** At 15 fps (if 30 isn't
  sustained), timing remains approximate and is labeled as such.
