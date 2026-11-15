# Shot detection & analysis, in plain language

How ShotCoach turns a stream of body poses into detected shots, keyframes, and
scores — explained step by step with diagrams. This is the "what the algorithm
actually does" companion to the higher-level [architecture](./architecture.md).

Everything here runs on **pose landmarks** only: 33 body points per frame
(nose, shoulders, elbows, wrists, hands, hips, knees, ankles…), each with an
x/y position and a visibility score. MediaPipe produces them; none of the logic
below needs the raw video.

- [1. The whole pipeline](#1-the-whole-pipeline)
- [2. Finding shots (boundary detection)](#2-finding-shots-boundary-detection)
- [3. Finding keyframes inside a shot](#3-finding-keyframes-inside-a-shot)
- [4. The two key signals: wrist height and hip drop](#4-the-two-key-signals-wrist-height-and-hip-drop)
- [5. From keyframes to metrics](#5-from-keyframes-to-metrics)
- [6. From metrics to a score](#6-from-metrics-to-a-score)

---

## 1. The whole pipeline

A clip of poses becomes one or more scored shots through a fixed sequence of
stages. Each stage only depends on the stage before it.

```mermaid
flowchart TD
    A["Pose frames<br/>(33 landmarks each)"] --> B["Shot boundary detection<br/>find where each shot starts and ends"]
    B --> C["Keyframe detection<br/>find the 11 key moments in each shot"]
    C --> D["Phase ranges<br/>Gather, Load, Rise, Set Point, Release, Follow-through"]
    C --> E["Sequencing metrics<br/>order and timing of events"]
    D --> F["Structure metrics<br/>body mechanics per phase"]
    E --> G["Score vs pro thresholds"]
    F --> G
    G --> H["Sequencing Score + Structure Score"]
```

Key idea: **keyframes are the backbone.** Almost every metric is either "when
did keyframe X happen" (sequencing) or "what did the body look like between
keyframes X and Y" (structure).

---

## 2. Finding shots (boundary detection)

A clip may contain several shots with gaps between them. The detector scans the
wrist height over time and looks for the signature of a shot: the ball (hands)
travels **up** far enough, fast enough, and ends up **above the shoulders**.

```mermaid
flowchart TD
    S["Scan frames in order"] --> U{"Wrists moving up<br/>fast enough?"}
    U -- "no" --> G{"Gap too long?"}
    G -- "no" --> S
    G -- "yes" --> R["Reset — this wasn't a shot"]
    R --> S
    U -- "yes" --> C["Count upward frames<br/>track the peak height"]
    C --> V{"Enough upward motion<br/>AND wrists reached<br/>above the shoulders?"}
    V -- "no" --> S
    V -- "yes" --> W["A shot! Now refine the START<br/>backward from the upward motion"]
    W --> X["Refine start to the gather<br/>(see below)"]
    X --> S
```

**Why refine the start?** The upward-motion signal fires when the ball is
already rising — _after_ the player has dipped into their shot. The true start
is the **gather**: when the legs begin to bend. So the detector walks backward
from the ball's upward motion to find where the legs started dropping.

```mermaid
flowchart TD
    B["Ball-based start<br/>(too late — ball already rising)"] --> A{"Clean gather?<br/>legs were clearly<br/>straight then bent"}
    A -- "yes" --> C["Move start to the<br/>standing-to-bending onset"]
    A -- "no" --> D{"Deep athletic stance?<br/>knee already bent<br/>at the ball-start"}
    D -- "yes" --> E["Trace the recent bend<br/>back to its onset"]
    D -- "no" --> F["Keep the ball-based start"]
```

This two-strategy start refinement is why boundary-start accuracy on side-view
clips is ~89% within a couple of frames. Code: `src/detection/shot-detector.ts`
(`findBoundaries`, `cleanGatherStart`, `deepStanceStart`).

---

## 3. Finding keyframes inside a shot

Within one shot the detector finds **11 keyframes** — the moments coaches care
about. They're found in dependency order: later ones search forward from
earlier ones.

```mermaid
flowchart TD
    subgraph Load
      LB["legs_start_bending<br/>= the shot start"]
      BL["ball_low_point<br/>lowest the ball gets"]
      LL["leg_bend_low_point<br/>deepest knee bend"]
    end
    subgraph Rise
      LE["legs_start_extending<br/>legs begin to push up"]
      BU["ball_starts_upward<br/>ball begins to rise"]
    end
    subgraph SetRelease
      SP["set_point<br/>ball cocked, highest hold<br/>before the push"]
      LF["legs_fully_extended<br/>the drive completes"]
      RE["release<br/>wrist snaps, ball leaves hand"]
      AE["arms_fully_extended<br/>full reach"]
    end
    subgraph Follow
      FL["feet_leave_ground"]
      FD["feet_land<br/>= shot end"]
    end
    LB --> BL --> LL --> LE --> BU --> SP --> LF --> RE --> AE --> FL --> FD
```

Each keyframe is found from a specific signal:

| Keyframe                          | Plain-language rule                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ball_low_point`                  | The **onset** of the dip's bottom — first frame the wrists reach near their lowest (highest Y). Taking the onset, not the deepest single frame, avoids landing late on a flat dip. |
| `ball_starts_upward`              | The **bottom of the dip** — where the wrists stop descending and turn upward.                                                                                                      |
| `leg_bend_low_point`              | The deepest knee bend, read from the **hip drop** signal (see §4) on the most-visible leg.                                                                                         |
| `legs_start_extending`            | Where the hips begin rising again after the deepest bend.                                                                                                                          |
| `set_point`                       | The highest, most-cocked hold of the ball before the forward push — detected from the shooting elbow's flex, not raw wrist height.                                                 |
| `legs_fully_extended`             | The **peak** of the hip-drop signal — hips highest relative to the ankles (the drive complete).                                                                                    |
| `release`                         | Maximum wrist flexion ("snap") after the set point. Treated as a _range_ through arm extension when scored.                                                                        |
| `arms_fully_extended`             | Maximum arm reach after release.                                                                                                                                                   |
| `feet_leave_ground` / `feet_land` | Ankle height crossing a ground baseline.                                                                                                                                           |

Code: `src/keyframe-detector.ts`; wired into phases in
`src/detection/keyframe-phases.ts`.

---

## 4. The two key signals: wrist height and hip drop

Two derived signals do most of the work. Understanding them explains most of the
keyframe rules.

### Wrist height (the ball)

The hands hold the ball, so the average wrist **Y** is a proxy for ball height.
Remember image coordinates: **Y grows downward**, so a _lower_ ball has a
_higher_ Y.

```mermaid
flowchart LR
    A["Ball at set position"] --> B["Dip: wrists go DOWN<br/>(Y increases)"]
    B --> C["ball_low_point<br/>onset of the bottom"]
    C --> D["ball_starts_upward<br/>the turn"]
    D --> E["Rise: wrists go UP<br/>(Y decreases)"]
    E --> F["release / arms extended"]
```

### Hip drop (the legs)

Knee _angle_ is noisy in side views because the far leg is occluded and
MediaPipe fabricates a near-straight angle for it. So instead of knee angle we
use the **vertical distance from hip to ankle** on the most-visible leg: it
shrinks as the legs bend and grows as they extend. This one change lifted
leg-keyframe accuracy substantially.

```mermaid
flowchart LR
    A["Standing<br/>big hip-to-ankle distance"] --> B["Load: hips drop<br/>distance SHRINKS"]
    B --> C["leg_bend_low_point<br/>smallest distance (basin onset)"]
    C --> D["legs_start_extending<br/>distance starts growing"]
    D --> E["legs_fully_extended<br/>largest distance (peak)"]
```

Both signals share the same trick: find a **basin** (a valley or a peak) and
take its _onset_ or its _turn_ rather than the single most-extreme frame, which
is noisy. The `HIP_DROP_MIN_RANGE` gate falls back to knee angle when the hips
barely move (e.g. synthetic tests, or a view where hips/ankles aren't tracked).

---

## 5. From keyframes to metrics

Two families of metric come out of the keyframes and the poses between them.
Code: `src/metrics/v2/`.

### Sequencing (efficiency) — order and timing

Take the 8 shot events, express each event's time as a fraction of the shot, and
measure the **signed gap** between each consecutive pair.

```mermaid
flowchart LR
    A["8 events with<br/>normalized times<br/>(0 = shot start, 1 = end)"] --> B["Signed gap per pair<br/>gap = t(next) − t(prev)"]
    B --> C{"gap sign"}
    C -- "positive" --> D["correct order,<br/>magnitude = elapsed time"]
    C -- "negative" --> E["ORDER VIOLATED<br/>later event happened first"]
```

One number captures both "must happen before X" (the sign) and "within a time
range" (the magnitude). Example: _ball must start rising before the legs reach
their lowest_ becomes one signed gap that should be positive and not too large.

### Structure — body mechanics per phase

For each phase (Gather, Load, Rise, Set Point, Release, Follow-through) measure
body shape. The reusable core is **posture**: the horizontal offset of head /
shoulders / hips / knees / ankles from the **center of the feet**, at the phase
start, the phase end, and the change between them.

```mermaid
flowchart TD
    P["Phase frame range"] --> Q["Posture core<br/>joint offsets vs center of feet<br/>start / end / delta"]
    P --> R["Phase-specific<br/>depth, wrist cock, wrist path,<br/>elbow angle, guide-hand timing, snap"]
    Q --> S["Measurements<br/>each with a reliability flag"]
    R --> S
```

Everything is **normalized** so camera zoom and player size cancel out:
distances divide by a body-scale estimate (nose-to-ankle span), times divide by
shot duration. Anything that can't be measured reliably (wrong camera angle,
occluded landmarks, missing keyframe) is returned **unavailable** — never
guessed.

---

## 6. From metrics to a score

Metrics are scored against **thresholds** derived from pro reference clips.

### Deriving thresholds (offline, from pro clips)

```mermaid
flowchart TD
    A["Pro clips → per-player<br/>metric medians + spread"] --> B["Per metric: consensus band<br/>= range of player medians<br/>padded by within-player noise"]
    B --> C{"Do the pros agree tightly?<br/>(small between-player spread<br/>vs within-player noise)"}
    C -- "yes → key metric" --> D["High weight — scored"]
    C -- "no → pros differ" --> E["Weight 0 — reported only"]
```

The insight: a metric where **every pro lands in a narrow band** is a truly key
element of good shooting; a metric where pros legitimately differ (e.g. exact
set-point height) shouldn't be scored. Code: `src/metrics/v2/thresholds.ts`.

### Scoring a shot

```mermaid
flowchart TD
    A["Shot metric value"] --> B{"Inside the pro band?"}
    B -- "yes" --> C["100 (good)"]
    B -- "no" --> D["Smoothstep falloff<br/>to 0 at ~2 band-widths out"]
    D --> E{"Sequencing order<br/>violated?"}
    E -- "yes" --> F["Penalized hard (≤10)"]
    E -- "no" --> G["close or off by distance"]
    C --> H["Roll up"]
    F --> H
    G --> H
    H --> I["Sequencing Score<br/>(+ order subscore)"]
    H --> J["Structure Score<br/>(mean of 6 phase categories)"]
```

Unreliable, missing, and reported-only metrics don't affect the score; the
**measured fraction** is surfaced so the UI is honest about gaps ("scored on 14
of 19 metrics — side view needed for the rest"). Code: `src/scoring/v2/`.

---

## Where to look in the code

| Concern                            | File                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| Shot boundaries + start refinement | `src/detection/shot-detector.ts`                          |
| Keyframe detection                 | `src/keyframe-detector.ts`                                |
| Keyframes → phases                 | `src/detection/keyframe-phases.ts`                        |
| Sequencing metrics                 | `src/metrics/v2/sequencing.ts`                            |
| Structure metrics                  | `src/metrics/v2/structure/`                               |
| Normalization primitives           | `src/metrics/v2/normalize.ts`                             |
| Single extraction entry point      | `src/metrics/v2/extract.ts`                               |
| Threshold derivation               | `src/metrics/v2/thresholds.ts`                            |
| Scoring engine                     | `src/scoring/v2/index.ts`                                 |
| Validate detection vs labels       | `src/testing/tolerance-report.ts` (`npm run test:labels`) |
