# All-Frame Keypoint Detection - Implementation Plan

## Overview

This plan extends the existing shot detection algorithm to detect ALL 10 keyframes within each shot, not just start/end boundaries. The iterative tuning process proven successful for shot boundaries will be applied to each keyframe type.

## Background

The previous iterative testing successfully tuned the algorithm for:
- Shot start frame (`legs_start_bending`)
- Shot end frame (approximating `feet_land`)
- Camera orientation detection (8 orientations)

This phase extends detection to ALL keyframes required by `metrics-by-phase.md`.

### 10 Keyframes to Detect (in chronological order)

| # | Keyframe ID | Phase | Description |
|---|-------------|-------|-------------|
| 1 | `legs_start_bending` | Load | Shot start - first movement |
| 2 | `leg_bend_low_point` | Load | Deepest knee bend |
| 3 | `ball_low_point` | Load | Lowest ball position (dip) |
| 4 | `legs_start_extending` | Rise | Legs begin pushing up |
| 5 | `ball_starts_upward` | Rise | Ball begins rising |
| 6 | `set_point` | Set Point | Ball at peak before release |
| 7 | `release` | Release | Wrist snapped, ball leaves hand |
| 8 | `arms_fully_extended` | Follow-through | Maximum arm extension |
| 9 | `feet_leave_ground` | Follow-through | Jump (if any) |
| 10 | `feet_land` | Follow-through | Landing / shot end |

## Data Sources

### Ground Truth Labels (video-tagger output)
Located in: `/mnt/c/Users/calin/OneDrive - Soul Focused Group/Personal Photos/basketball clips/`

Current labeled videos with keypoints:
- chris/20190103_180930_labels.json (3 shots)
- chris/20190103_181419_labels.json (2 shots)
- chris/chris 5_labels.json (1 shot)
- cody/20190818_142631_labels.json (3 shots - 1 has partial labels)
- cody/20190804_140617_labels.json (3 shots)
- cole/20201212_134104_labels.json (1 shot)
- jax/20181219_173607_labels.json (4 shots) - NEW
- edmond/20190804_140654_labels.json (7 shots) - NEW

**Total: 24 shots with keypoint labels across 8 videos**

**Note**: jax and edmond videos have complete labels including `release` and `orientation`. Other videos may need `release` added.

## Feature Breakdown

### Feature 1.0: Infrastructure Updates
**Parallel Group**: 1
**Estimated Tasks**: 3

#### Rationale
Before iterative keyframe tuning, we need to:
1. Update label schema to include all 10 keyframes
2. Convert video-tagger labels to test-data format
3. Build comparison infrastructure for per-keyframe validation

#### Tasks
1. **Task 1.1: Update Label Schema** - Extend LabeledShot interface with all 10 keyframe fields
2. **Task 1.2: Convert Video-Tagger Labels** - Script to convert video-tagger JSON to test-data format with poses.json
3. **Task 1.3: Build Keyframe Comparison** - Extend detection.ts to compare all keyframes with tolerance

---

### Feature 2.0: Keyframe Detection Algorithms
**Parallel Group**: 1
**Estimated Tasks**: 4

#### Rationale
Implement detection algorithms for each keyframe type, building on existing pose tracking infrastructure.

#### Tasks
1. **Task 2.1: Load Phase Keyframes** - Detect `leg_bend_low_point`, `ball_low_point`
2. **Task 2.2: Rise Phase Keyframes** - Detect `legs_start_extending`, `ball_starts_upward`
3. **Task 2.3: Set/Release Keyframes** - Detect `set_point`, `release`
4. **Task 2.4: Follow-through Keyframes** - Detect `arms_fully_extended`, `feet_leave_ground`, `feet_land`

---

### Feature 3.0: Iterative Testing Levels
**Parallel Group**: 1
**Estimated Tasks**: 9

#### Rationale
Apply the proven iterative approach: add one video at a time, tune algorithm for ALL keyframes until all pass, verify no regressions, proceed to next video.

#### Videos (in order - simpler to more complex)
1. chris 5 (1 shot) - simplest case
2. cole/20201212_134104 (1 shot) - second single-shot
3. chris/20190103_181419 (2 shots)
4. chris/20190103_180930 (3 shots)
5. cody/20190818_142631 (3 shots)
6. cody/20190804_140617 (3 shots)
7. jax/20181219_173607 (4 shots) - multiple orientations
8. edmond/20190804_140654 (7 shots) - largest video, good variety

#### Tasks
1. **Task 3.1: Level 1** - chris 5 (all 10 keyframes for 1 shot)
2. **Task 3.2: Level 2** - Add cole/20201212_134104, verify no regression
3. **Task 3.3: Level 3** - Add chris/20190103_181419, verify no regression
4. **Task 3.4: Level 4** - Add chris/20190103_180930, verify no regression
5. **Task 3.5: Level 5** - Add cody/20190818_142631, verify no regression
6. **Task 3.6: Level 6** - Add cody/20190804_140617, verify no regression
7. **Task 3.7: Level 7** - Add jax/20181219_173607, verify no regression
8. **Task 3.8: Level 8** - Add edmond/20190804_140654, verify no regression
9. **Task 3.9: Final Validation** - All 8 videos pass, document algorithm

---

## Parallel Groups Explained

| Group | Features | Reason |
|-------|----------|--------|
| 1 | All | Sequential dependency - each level depends on previous passing |

## Implementation Order

All tasks must be sequential:
1. Feature 1.0: Infrastructure (foundation for testing)
2. Feature 2.0: Detection Algorithms (initial implementation)
3. Feature 3.0: Iterative Levels (tune until all pass)

## Key Files to Modify

| File | Purpose |
|------|---------|
| `src/testing/types.ts` | Extend LabeledShot with 10 keyframe fields |
| `src/testing/detection.ts` | Add keyframe comparison logic |
| `src/testing/reporting.ts` | Show per-keyframe results |
| `src/keyframe-detector.ts` | New file for keyframe detection algorithms |
| `test-data/algorithm-learnings.md` | Document keyframe detection insights |

## Iteration Process Per Level

Each level task (3.1-3.9) follows this process:

1. Run tests on all videos up to current level
2. If all keyframes pass (within ±8 frames): Level complete, proceed to next
3. If any keyframe fails:
   - Analyze which keyframe(s) failed and by how many frames
   - Examine poses.json around labeled keyframe
   - Identify pose signal that distinguishes the keyframe
   - Update detection algorithm
   - Document changes in algorithm-learnings.md
   - Retry (up to 10 attempts per level)
4. If max attempts reached: Stop and report with analysis

## Success Criteria

- All 10 keyframes detected within ±8 frame tolerance
- All 24 labeled shots across 8 videos pass validation
- No regressions when adding new videos
- Algorithm documented in `algorithm-learnings.md`

## Frame Tolerance Rules

- **Base tolerance**: ±8 frames (same as shot boundary testing)
- **Labels are immutable**: Algorithm must be tuned to match labels, NEVER modify labels
- **Per-keyframe flexibility**: Some keyframes may need different detection approaches
