# Shot Detection Algorithm Iterative Testing - Design Document

## Executive Summary

This project implements an iterative testing and refinement process for the basketball shot detection algorithm. Using pre-extracted pose data and human-labeled ground truth, we incrementally add test videos and adjust the algorithm until all videos pass detection accuracy thresholds.

## Problem Statement

The current shot detection algorithm needs validation and tuning against real-world basketball footage. By comparing algorithm output against human-labeled shot boundaries and camera orientations, we can systematically identify and fix detection issues. The incremental approach (one video at a time) prevents regressions and ensures the algorithm generalizes properly.

## Target Users

- Developers maintaining the shot-analysis algorithm
- The automated testing system that validates algorithm changes

## Features

### Feature 0: Test Infrastructure Setup

**Priority**: Critical (Blocker)
**Dependencies**: None

#### User Story
As a developer, I want the test infrastructure to correctly load and validate test data so that tests can actually run.

#### Current Issues
The existing test runner (`src/testing/run-tests.ts`) is blocked by validation errors:

1. **Null landmarks in poses.json**: Many frames have `landmarks: null` when no pose was detected, but schema requires an array
2. **Missing top-level orientation**: Schema expects `labelData.orientation` but labels only have per-shot `cameraOrientation`
3. **Missing orientation values**: Enum lacks `behind`, `behind-left`, `behind-right`
4. **Per-shot vs per-video orientation**: Comparison logic compares video-level orientation, but labels have per-shot orientation

#### Acceptance Criteria
- [ ] Update `frameSchema` to allow `landmarks: TestLandmark[] | null`
- [ ] Update `Orientation` type/schema to include `behind`, `behind-left`, `behind-right`
- [ ] Update `labeledShotSchema` to include `cameraOrientation: Orientation`
- [ ] Remove required top-level `orientation` from `labelDataSchema` (orientation is per-shot)
- [ ] Update `compareResults()` in detection.ts to compare orientation per-shot instead of per-video
- [ ] Update `detectOrientation()` to detect all 8 orientations including "behind" variants
- [ ] Add `--videos` CLI flag to run on a subset of videos (e.g., `--videos "20181219,20190107"`)
- [ ] Handle frames with null landmarks gracefully in shot detection (skip them)
- [ ] Create `test-data/algorithm-learnings.md` with initial structure
- [ ] All 9 test videos load successfully (no validation errors)
- [ ] Test runner executes and produces comparison output (even if tests fail)

#### Files to Modify
| File | Changes |
|------|---------|
| `src/testing/types.ts` | Update schemas for null landmarks, 8 orientations, per-shot orientation |
| `src/testing/detection.ts` | Update comparison logic for per-shot orientation, handle null landmarks |
| `src/testing/run-tests.ts` | Add `--videos` flag for subset testing |
| `src/testing/reporting.ts` | Update output to show per-shot orientation comparison |

#### Edge Cases
- Frame with null landmarks: Skip frame in detection, don't crash
- Shot spans frames with some null landmarks: Use available frames only
- Video has shots with mixed orientations: Each shot compared independently

#### Data Requirements
- Updated Zod schemas
- algorithm-learnings.md template

---

### Feature 1: Algorithm Learnings Document

**Priority**: High
**Dependencies**: Feature 0

#### User Story
As a developer, I want a persistent document tracking what we've learned about the algorithm so that insights aren't lost between sessions.

#### User Flow
1. System creates `test-data/algorithm-learnings.md` with structured sections
2. After each fix attempt, insights are appended to the relevant section
3. Final algorithm summary is documented when all videos pass

#### Acceptance Criteria
- [ ] algorithm-learnings.md created in test-data/ directory
- [ ] Sections: What Works, What Doesn't Work, Key Observations, Current Algorithm Summary, History
- [ ] History section tracks each fix attempt with timestamp and outcome
- [ ] Final state documents the working algorithm configuration

#### Edge Cases
- File already exists: Preserve existing content, append new entries
- No changes needed: Document why algorithm already works

#### Data Requirements
- algorithm-learnings.md file with markdown sections

---

### Feature 2: Test Runner Enhancements

**Priority**: High
**Dependencies**: Feature 0

#### User Story
As a developer, I want to run the shot detection algorithm against specific test videos and compare results to labeled ground truth.

#### User Flow
1. Load poses.json and labels.json for specified test directories
2. Run ShotBoundaryDetector.detectShots() on pose data
3. Run orientation detection on pose data (per-shot)
4. Compare detected shots to labeled shots using tolerance rules
5. Report pass/fail with detailed frame-by-frame comparison

#### Acceptance Criteria
- [ ] Can run against a subset of test directories (for incremental levels)
- [ ] Shot start tolerance: ±3 frames (expandable to ±5 if any diff is exactly 4 and all ≤5)
- [ ] Shot end tolerance: ±3 frames (expandable to ±5 if any diff is exactly 4 and all ≤5)
- [ ] Shot count must match exactly (no false positives or negatives)
- [ ] Orientation must match exactly for each shot (per-shot comparison)
- [ ] Detailed output shows: expected vs detected frames, per-shot orientation match, pass/fail

#### Edge Cases
- No poses.json or labels.json: Skip directory with warning
- Zero labeled shots: Pass if algorithm also detects zero
- Algorithm crashes: Report as failure with error message

#### Data Requirements
- TestCase: { directory, poses, labels }
- ComparisonResult: { passed, detectedShots, labeledShots, frameDiffs, perShotOrientationMatch }

---

### Feature 3: Orientation Detection Extension

**Priority**: High
**Dependencies**: Feature 0

#### User Story
As a developer, I want the algorithm to detect all 8 camera orientations so that orientation matching can pass for all test videos.

#### User Flow
1. Analyze pose landmarks within each shot's frame range to determine camera position
2. Detect: front, front-left, front-right, side-left, side-right, behind, behind-left, behind-right
3. Return orientation per-shot for comparison with labeled ground truth

#### Acceptance Criteria
- [ ] Algorithm detects all 8 orientations
- [ ] Uses shoulder/hip separation and Z-depth for classification
- [ ] "Behind" variants detected when shooter faces away from camera (negative shoulder separation)
- [ ] Orientation detected per-shot, not per-video

#### Detection Logic for "Behind" Variants
```typescript
// When right shoulder X < left shoulder X, we're looking at the back
// Combined with Z-depth to determine behind-left vs behind-right
if (avgShoulderDiffX < -sideThreshold) {
  // Behind view - shoulders appear "reversed"
  if (avgZDiff > angleThreshold) return "behind-right";
  if (avgZDiff < -angleThreshold) return "behind-left";
  return "behind";
}
```

#### Edge Cases
- Ambiguous angle (between categories): Use closest match based on thresholds
- Poor pose visibility: Use available landmarks, flag low confidence

#### Data Requirements
- Orientation enum extended to 8 values

---

### Feature 4: Level-Based Iterative Testing (Levels 1-9)

**Priority**: High
**Dependencies**: Features 0, 1, 2, 3

#### User Story
As a developer, I want to pass test videos one at a time, fixing regressions before proceeding, so that the algorithm generalizes properly.

#### User Flow (per level N)
1. Run test runner on all videos 1..N
2. If all pass: Level complete, proceed to level N+1
3. If any fail: Analyze failure, update algorithm, document in learnings, retry (up to 10 attempts)
4. If max attempts reached: Stop and report to user

#### Acceptance Criteria
- [ ] Level 1: Pass video 1 alone
- [ ] Level 2: Pass videos 1-2 together (video 1 must still pass)
- [ ] Level 3: Pass videos 1-3 together
- [ ] ... continue for all 9 videos
- [ ] Each level has independent 10-attempt counter that resets when level passes
- [ ] Regression check: all previous videos re-tested at each level

#### Video Order (alphabetical by directory)
1. 20181219_173607 (4 shots, various orientations)
2. 20190107_211108 (1 shot, front)
3. 20190124_175609 (5 shots, front-left/side-left)
4. 20190804_140654 (7 shots, various behind/side)
5. 20190818_142631 (3 shots, side-left/front)
6. 20200606_111929 (5 shots, side-right/front-right)
7. 20201212_134104 (1 shot, side-right)
8. chris-5 (1 shot, side-right)
9. zak-1 (9 shots, all 8 orientations)

#### Edge Cases
- Adding video N breaks video 1: Must fix regression before proceeding
- Algorithm change helps video N but breaks video N-1: Rollback and try different approach
- Same error pattern across multiple videos: Apply systematic fix

#### Data Requirements
- Level state: { currentLevel, attempts, passedVideos[] }

---

### Feature 5: Final Validation & Documentation

**Priority**: Medium
**Dependencies**: Feature 4 (all levels passed)

#### User Story
As a developer, I want the final algorithm documented after all videos pass so that the working configuration is preserved.

#### User Flow
1. All 9 levels complete successfully
2. Document final algorithm in algorithm-learnings.md "Current Algorithm Summary" section
3. Record final configuration parameters
4. Mark feature as complete

#### Acceptance Criteria
- [ ] All 9 videos pass in single test run
- [ ] algorithm-learnings.md has complete "Current Algorithm Summary"
- [ ] Configuration parameters documented (thresholds, windows, etc.)

#### Edge Cases
- N/A (only reached after all levels pass)

#### Data Requirements
- Final algorithm configuration snapshot

---

## Technical Decisions

### Stack
- Runtime: Node.js with TypeScript
- Test Framework: Existing run-tests.ts CLI
- Algorithm: ShotBoundaryDetector + PhaseDetector + extended orientation detection

### Test Data Structure
```
test-data/
├── algorithm-learnings.md        # Created by this feature
├── {video-directory}/
│   ├── poses.json               # Pre-extracted MediaPipe pose data
│   └── labels.json              # Human-labeled ground truth
```

### labels.json Schema (actual structure - no top-level orientation)
```typescript
{
  video: string;
  labeledBy: "human";
  labeledAt: string;  // ISO timestamp
  shots: Array<{
    shotNumber: number;           // 1-based
    startFrame: number;           // 0-based, inclusive
    endFrame: number;             // 0-based, inclusive
    cameraOrientation: Orientation;  // Per-shot orientation
  }>;
}
```

### poses.json Frame Schema (updated to allow null landmarks)
```typescript
{
  frameIndex: number;
  timestamp: number;
  poseConfidence: number;
  landmarks: TestLandmark[] | null;  // null when no pose detected
}
```

### Orientation Enum (extended to 8 values)
```typescript
type Orientation =
  | "front"
  | "front-left"
  | "front-right"
  | "side-left"
  | "side-right"
  | "behind"
  | "behind-left"
  | "behind-right";
```

### Tolerance Rules
```typescript
const BASE_TOLERANCE = 3;     // ±3 frames
const EXPANDED_TOLERANCE = 5; // ±5 frames (if diff=4 and all ≤5)

function isWithinTolerance(detected: number, labeled: number, tolerance: number): boolean {
  return Math.abs(detected - labeled) <= tolerance;
}
```

### Pass/Fail Criteria
1. Shot count must match exactly
2. Each labeled shot must have exactly one matching detected shot
3. Start frame within tolerance
4. End frame within tolerance
5. Orientation matches exactly

## Dependency Graph

```
Feature 0: Test Infrastructure Setup (BLOCKER - must complete first)
    ↓
Feature 1: Algorithm Learnings (depends on 0)
Feature 2: Test Runner Enhancements (depends on 0)
Feature 3: Orientation Extension (depends on 0)
    ↓
Feature 4: Level-Based Testing (depends on 1, 2, 3)
    ↓
Feature 5: Final Validation (depends on 4)
```

### Implementation Order
1. **Task 1: Setup** - Feature 0 (test infrastructure fixes)
2. **Tasks 2-10: Levels 1-9** - Feature 4 (iterative testing with Features 1, 2, 3 integrated)
3. **Task 10 completion** - Feature 5 (final documentation)

## Progress Tracking

The progress.json will contain 10 tasks:

### Task 1: Setup (Feature 0)
Fix test infrastructure so tests can run:
- Update schemas for null landmarks and 8 orientations
- Update comparison logic for per-shot orientation
- Add `--videos` CLI flag for subset testing
- Create algorithm-learnings.md template
- Verify all 9 videos load without validation errors
- Run test and confirm it executes (failures expected, but no crashes)

### Tasks 2-10: Iterative Levels
| Task | Videos to Pass | New Video Added |
|------|----------------|-----------------|
| 2 | 20181219_173607 | 20181219_173607 (4 shots) |
| 3 | 1-2 | 20190107_211108 (1 shot) |
| 4 | 1-3 | 20190124_175609 (5 shots) |
| 5 | 1-4 | 20190804_140654 (7 shots) |
| 6 | 1-5 | 20190818_142631 (3 shots) |
| 7 | 1-6 | 20200606_111929 (5 shots) |
| 8 | 1-7 | 20201212_134104 (1 shot) |
| 9 | 1-8 | chris-5 (1 shot) |
| 10 | 1-9 (ALL) | zak-1 (9 shots) + final documentation |

### Per-Level Iteration Process
Each level task (2-10) will iterate:
1. Run tests on videos 1..N using `--videos` flag
2. If all pass: Level complete, proceed to next level
3. If any fail:
   a. Analyze failure details (frame diffs, orientation mismatches)
   b. Examine poses.json around labeled frames to understand ground truth
   c. Identify why algorithm detected differently
   d. Update algorithm code
   e. Document changes in algorithm-learnings.md History section
   f. Retry (up to 10 attempts per level)
4. If max attempts reached: Stop and report to user with analysis
