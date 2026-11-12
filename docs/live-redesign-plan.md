# Live-first redesign — implementation plan

A SwingCoach-style redesign of ShotCoach's analysis/scoring experience,
centered on **live** practice. This plan is the agreed scope for **Milestone 1**
and the sequencing to build it. Companion docs:
[architecture](./architecture.md),
[shot detection & analysis](./shot-detection-and-analysis.md),
[follow-up work](./follow-up-work.md).

> Status: **plan only — not yet approved for implementation.**

---

## 1. Locked decisions (from the design interview)

| Area | Decision |
| --- | --- |
| **Viewing angle (v1)** | ONE angle: **side-on, shooting-arm side**. Matches Stephen Curry's 7 approved `side-left` clips and is the most accurate angle in the labeled corpus. |
| **Angle setup** | **Detect & guide** to side-on before capture; **block Start** until the live pose reads as the required side with adequate confidence. |
| **Per-metric scoring** | **SwingCoach-style deviation, lower = better.** `1` = on target; ramps up toward `~10` the further outside the band. Pass-ranges where appropriate. |
| **Phase grouping** | The existing **6 phases**: gather, load, rise, setPoint, release, followThrough. |
| **Scorecard layout** | **Two top-level sections — Structure and Sequencing — each grouped by phase**, with a per-metric score, a per-phase group score, a per-section score, and an overall shot score. |
| **Baseline targets** | Derived from **Curry's approved side shots' spread** (ideal = mean; pass-range from observed spread), written to an **editable JSON** file. Full multi-pro baseline is later work. |
| **Voice readback** | After each shot, read the **5 worst** metrics (not all). **Terse, interruptible**, no coaching instruction — phrased like **"set point low by 2"**. Replaces the current single-cue audio. |
| **Audio bracketing** | **Earcon** when a shot is recognized / analysis starts → speak the 5-worst → **earcon** when ready for the next shot. |
| **Session model** | **No session concept. Fully de-session the schema** — shots root directly on the player with a timestamp; scoring and insights never touch sessions. |
| **Insights** | Windows **Today / 7d / 30d / All-time**; per window show **recurring issues (ranked worst-first)** + **trends** (overall + per-metric over time). Computed on read; no stored session aggregates. |
| **Shot storage** | **All** shots' pose data kept server-side by default. |
| **Video storage** | **Local only, last N shots**, where N is a **user setting**. Older shots fall back to **skeleton reconstruction** from pose. |
| **Shot review** | Review **any** past shot: scrub the clip (or skeleton) with **skeleton + keyframe markers + per-metric values** overlaid at the measured frame. Included now. |
| **Navigation** | Top-level tabs: **Practice / Shots / Insights / Profile**. |
| **Existing flows** | Upload assessment, training plans, drills, onboarding wizard: **hidden for now, code kept** (route the app to the live-first experience; leave the modules unreachable in the UI). |
| **Deferred** | Metric on/off toggles, drill mode (N-rep streaks), preset/custom metric groups, per-metric video lessons. Not Milestone 1. |

### One judgment call to confirm

"Fully de-session the schema" and "keep the assessment/upload code" are in mild
tension: assessment is inherently session-shaped (one upload = one session of
shots). **Proposed resolution:** the *live* product is fully de-sessioned —
shots root on the player, nothing live creates or reads `sessions`, and
scoring/insights never reference them. The `sessions` table stays in the schema
purely as dead storage for the **hidden** assessment path (kept intact, not part
of this milestone and unreachable in the UI). If instead assessment should also
be migrated off sessions now, or the table physically dropped, that is a small
add-on — flag it and it moves into scope.

---

## 2. Target architecture

```
Camera ─▶ MediaPipe pose (client) ─▶ LiveRepCoordinator (rep boundary)
                                         │  earcon: "analyzing"
                                         ▼
                         POST /api/analysis/shot { playerId, poseData }
                                         │  (server-authoritative)
                                         ▼
              library analysis ─▶ v2 metrics (sequencing + structure)
                                         ▼
              deviation scorecard  ◀── live-targets.json (editable)
                                         ▼
     persist shot (player-rooted) + score  ──▶  return { shot, scorecard, worst5 }
                                         │  speak worst5 → earcon "ready"
                                         ▼
           on-device clip recorded + retained (last N)  ──▶ Shots review
                                         ▼
           Insights: aggregate stored shot scores by time window
```

Shot is the unit of record. No session. Pose + scorecard live server-side for
every shot; the raw clip lives on-device for the most recent N shots only.

---

## 3. Component plan

### 3.1 Baseline targets pipeline → `live-targets.json`

- New script (root library `src/`, run via an `npm run` target) that loads the
  approved Curry shots in `test-data/stephen-curry-1/` (all 7 `side-left`),
  runs the **v2 metrics** (sequencing + structure) over each shot's labeled
  window, and collects per-metric value arrays.
- For each metric id (`seq.<from>__<to>` and `<phase>.<key>` per
  `src/metrics/v2/flatten.ts`) compute: `ideal` (mean), `sd` (σ), observed
  `[min,max]`. Emit **`app/static/reference/live-targets.json`** (served as a
  static asset next to `thresholds.json`), hand-editable:

  ```jsonc
  {
    "version": 1,
    "builtFrom": "stephen-curry-1 (7 side-left)",
    "metrics": {
      "setPoint.elbow_under_ball": {
        "section": "structure", "phase": "setPoint",
        "label": "Set point", "unit": "deg",
        "ideal": 88.4, "sd": 3.1,
        "passMin": 84.0, "passMax": 93.0,     // observed spread (editable)
        "rampSd": 3.1,                         // units per deviation step for 1→10
        "direction": { "low": "low", "high": "high" }
      }
      // …one entry per scored metric
    }
  }
  ```

- **Direction vocabulary** is per metric family: angle/position → `low`/`high`;
  timing/sequencing gaps → `early`/`late`; extension/reach → `short`/`long`.
- **Caveats baked into the doc output** (mirror
  [follow-up-work §1.1–1.4](./follow-up-work.md)): 7 clips is a *placeholder*
  spread; `*.ankles` posture metric is ≈0 by construction (exclude from scoring
  or swap for stance width); `set_point` is the weakest keyframe (~52% @ ±1), so
  its band is widened / down-weighted. The JSON is the hand-tune surface.

### 3.2 Deviation scoring — `app/src/lib/features/scoring/deviation.ts`

Pure module, fully unit-tested, no UI/DB deps.

- `scoreMetric(id, value, target)` → `{ score (1–10, lower better), normDev,
  direction, magnitude, inBand }`:
  - inside `[passMin,passMax]` → `score = 1`, `magnitude = 0`.
  - outside → `magnitude` = distance from the nearest band edge in native units
    (rounded) for the readback; `normDev = |value − ideal| / sd`;
    `score = clamp(round(1 + normDev), 1, 10)` (ramp slope from `rampSd`).
  - `direction` = sign → the metric's `low`/`high`/`early`/`late`/etc. word.
- `scoreShot(metrics, targets)` → full scorecard:
  - per-metric results, grouped **Structure** vs **Sequencing**, each grouped by
    the 6 phases; **group score** = mean of its metrics' deviation scores;
    **section score** = mean across its phase groups; **overall** = mean of the
    two sections. Everything stays on the 1–10 lower-better scale.
  - `worst5` = the 5 measured metrics with the highest `normDev` (cross-unit
    comparable), each carrying `{ label, direction, magnitude }` for the voice
    line (`"set point low by 2"`).
  - respects `unmeasured`/coverage from the library; a shot-level **coverage
    gate** suppresses the headline score below a threshold (follow-up §2.5).

The existing v1 `scoreRep`/engine and v2 upload scorecard stay for the hidden
assessment path; the live path uses this new module.

### 3.3 Angle gate

- Determine the **required orientation** from the player's `shooting_hand`
  (Profile): right → `side-left` (matches Curry), left → `side-right`.
- **LH handling:** mirror the incoming pose landmarks horizontally (swap
  left/right joints) so the single RH/side-left target set serves both. Noted as
  an explicit assumption to verify.
- Practice screen runs a **setup check** before capture: sample ~1s of live
  pose, detect orientation + coverage/confidence (reuse existing orientation
  detection). If not the required side or low confidence → show a guidance
  overlay ("Stand side-on, shooting arm toward the camera") and **disable
  Start**; re-check continuously until satisfied.

### 3.4 Data model — migration `004-deshot-session.ts`

Reshape to shot-centric (DB is wiped in dev; migration also backfills to be
safe):

- **`shots`**: drop `session_id`; add `player_id TEXT NOT NULL REFERENCES
  players(id)`. Keep `created_at` (the time anchor), `orientation`,
  `start/end_frame`, `overall_confidence`, `excluded`, `analysis_json`,
  `video_id`. New index `idx_shots_player ON shots(player_id, created_at)`.
  Backfill `player_id` by joining old `shots → sessions`.
- **`reps`**: collapsed into `shots` — one live rep *is* one shot. Store rep
  feedback (cues/scorecard summary) on the shot (`feedback_json`) instead of a
  separate `reps` row. (Keep the `reps` table only if the hidden assessment path
  needs it; otherwise drop its live usage.)
- **`scores`**: `scope = 'shot'` only; `ref_id` = shot id. Store the deviation
  scorecard JSON in `breakdown_json` plus the overall score. No `'session'`
  scope writes.
- **`focus_areas`**: no longer written (was per-session). Insights computes
  recurring issues on read.
- **`sessions` / `plans` / `plan_items`**: retained for the hidden assessment
  path only; unreferenced by anything live (see §1 judgment call).
- **Repos** (`app/src/lib/shared/db/repos/shot-repo.ts`): add
  `createForPlayer(...)`, `recent(playerId, limit)`,
  `listByPlayerSince(playerId, sinceTs)`, `setExcluded(...)`. Live path stops
  calling `session.create`/`session.complete`.

### 3.5 Server analysis endpoint

- `POST /api/analysis/shot` (`app/src/routes/api/analysis/shot/+server.ts` +
  `app/src/lib/server/analysis.ts`): request becomes `{ playerId, poseData }`
  (drop `sessionId`). Persist the shot rooted on the player, compute the
  deviation scorecard (§3.2) from `live-targets.json`, persist the score, and
  return `{ shot, scorecard, worst5 }`.
- Pose data for every shot is persisted (`analysis_json`), honoring
  "store all shots by default."

### 3.6 Live store rewrite — `LivePracticeStore`

Replaces `LiveSessionStore`:

- `start()`: resolve player, run the **angle gate**, start the coordinator. No
  session creation.
- On `repResult`: play the **"analyzing" earcon**, POST `{playerId, poseData}`,
  then on response **speak the worst-5** terse readback and play the **"ready"
  earcon**. Persist happens server-side.
- **Readback builder:** for each of worst-5, `${label} ${direction} by
  ${magnitude}` → e.g. "set point low by 2, elbow flare high by 6, …".
  Interruptible — a new shot cancels in-flight speech before speaking.
- **Audio service** (`app/src/lib/shared/audio`): add `playEarcon("analyzing" |
  "ready")` (two short distinct tones) and `cancel()`; keep `speak`/mute.
  `createFakeAudio` records earcons for tests.
- Remove `end()` → summary and the summary route; practice is continuous.
  Pause/resume just stop/start the coordinator.

### 3.7 On-device clip capture + retention

- Record each rep's clip (`MediaRecorder` over the camera stream, bounded to the
  rep window) and store locally via the existing `video-repo` + `bytes-store`;
  link through `videos.file_uri` (source `'live'`) + `shots.video_id`.
- **Retention setting** `videoRetentionCount` in Profile (default **20**, bounds
  ~5–200), stored in `settings`. After each new clip, evict the oldest local
  clips beyond N (LRU by `created_at`). Pose stays server-side regardless;
  evicted shots review via skeleton reconstruction.
- Verify `MediaRecorder` behavior in the Capacitor native shell vs web; pick the
  storage location accordingly. (Risk flagged below.)

### 3.8 Scorecard component

- Renders overall score + two collapsible sections (**Structure**,
  **Sequencing**), each grouped by the 6 phases, with per-group scores and
  per-metric rows (value, target band, 1–10 deviation score, direction).
  Lower = better visual language (1 = green "on target", high = red).
- Two presentations from one component: compact post-shot card (overall +
  worst-5) and the full review scorecard.

### 3.9 Shots tab + scrub review

- `(tabs)/shots/+page.svelte`: recent shots newest-first (score + thumbnail);
  tap → `(tabs)/shots/[id]/+page.svelte`.
- Review: video player (local clip if retained, else skeleton reconstruction on
  canvas from pose via `replay-pipeline`) with a **scrubber**; as the user
  scrubs, overlay **skeleton + the 11 keyframe markers + per-metric values**
  measured at/near the current frame. Reuse existing overlay/skeleton rendering.
- Replaces `(tabs)/progress/shot/[id]`.

### 3.10 Insights tab

- `(tabs)/insights/+page.svelte`: window selector **Today / 7d / 30d /
  All-time**. For the window, query shots by player + `created_at` range and
  compute: **recurring issues** = metrics ranked by frequency × avg `normDev`
  (worst-first, top N) and **trends** = overall + per-metric deviation over
  time (sparklines/line). All on read from stored shot scores — no stored
  aggregates, no session score. Replaces `(tabs)/progress`.

### 3.11 Navigation + Profile

- Tab bar (`app/src/routes/(tabs)/+layout.svelte`) → **Practice / Shots /
  Insights / Profile**. Move the `practice/live` experience into the Practice
  tab.
- **Hide** (keep code, unlink from UI): home assessment CTA, `assess/`, `plan/`,
  `drill/`, and the full onboarding wizard. Keep a **minimal onboarding** to
  capture name + **shooting hand** (needed by the angle gate), or auto-create a
  player.
- **Profile** adds: shooting hand (surfaced), **video-retention count**, voice
  on/off + mute.

---

## 4. Build sequence (ordered, each independently verifiable)

1. **Targets pipeline + `live-targets.json`** (library script + npm target).
   *Verify:* JSON emitted from Curry's 7 shots, bands sane, caveats documented.
2. **Deviation scoring module** (`deviation.ts`) + unit tests. *Verify:* pure
   tests for band/ramp/worst-5/grouping.
3. **Migration 004** (de-session shots/scores, player-rooted) + repo methods +
   migration/repo tests.
4. **Shot endpoint + server analysis**: player-rooted persistence + deviation
   scorecard + worst-5. *Verify:* endpoint tests.
5. **Live store rewrite**: no session, angle gate, earcons + worst-5 readback,
   on-device clip capture + retention.
6. **Scorecard component** (sections × phases).
7. **Shots tab + scrub/overlay review**.
8. **Insights tab** (windows + recurring issues + trends).
9. **Nav restructure (4 tabs)** + hide legacy flows + Profile settings.
10. **Cleanup**: coverage gating, Playwright e2e, docs refresh, remove the
    summary route.

Steps 1–4 are backend/pure and land first; 5–9 are the UI build; each step
keeps the suite and both build targets green.

---

## 5. Risks & flags

- **Thin baseline:** 7 Curry clips → placeholder spread
  ([follow-up §1.1](./follow-up-work.md)). `live-targets.json` is the hand-tune
  surface until a real multi-pro baseline exists.
- **`*.ankles` posture metric** ≈0 by construction — exclude from Structure
  scoring or replace with stance width ([follow-up §1.2](./follow-up-work.md)).
- **`set_point` keyframe** weakest (~52% @ ±1) — affects set-point metrics and
  the "by X" magnitude; widen band / down-weight.
- **LH mirroring** correctness needs verification against a LH clip.
- **`MediaRecorder`** availability/format in the Capacitor native shell vs web;
  local storage location for clips.
- **De-session vs assessment** — the §1 judgment call is the one explicit veto
  point before migration 004.
- **Stored-metrics versioning** ([follow-up §2.1](./follow-up-work.md)) still
  applies: bump a schema version on the shot scorecard so older shots degrade
  gracefully in Insights/review.
