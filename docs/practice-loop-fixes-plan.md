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
