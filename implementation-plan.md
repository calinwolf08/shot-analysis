# Shot Detection Algorithm Iterative Testing - Implementation Plan

## Overview

This implementation plan breaks down the iterative testing and refinement process for the basketball shot detection algorithm. The work is structured as a single feature with 10 sequential tasks: one setup task followed by 9 level-based testing tasks that incrementally add test videos.

## Feature Breakdown

### Feature 1.0: Iterative Algorithm Testing
**Parallel Group**: 1
**Estimated Tasks**: 10

#### Rationale

All tasks are in the same parallel group because they are strictly sequential - each level builds on the previous and must pass all previous videos before proceeding. The setup task is a blocker for all other tasks since the test infrastructure must work before any testing can occur.

#### Tasks

1. **Task 1.1: Test Infrastructure Setup** - Fix schemas, add CLI flag, handle null landmarks, create learnings doc
2. **Task 1.2: Level 1 - Video 1** - Pass 20181219_173607 (4 shots)
3. **Task 1.3: Level 2 - Videos 1-2** - Add 20190107_211108 (1 shot), ensure no regression
4. **Task 1.4: Level 3 - Videos 1-3** - Add 20190124_175609 (5 shots), ensure no regression
5. **Task 1.5: Level 4 - Videos 1-4** - Add 20190804_140654 (7 shots), ensure no regression
6. **Task 1.6: Level 5 - Videos 1-5** - Add 20190818_142631 (3 shots), ensure no regression
7. **Task 1.7: Level 6 - Videos 1-6** - Add 20200606_111929 (5 shots), ensure no regression
8. **Task 1.8: Level 7 - Videos 1-7** - Add 20201212_134104 (1 shot), ensure no regression
9. **Task 1.9: Level 8 - Videos 1-8** - Add chris-5 (1 shot), ensure no regression
10. **Task 1.10: Level 9 - All Videos** - Add zak-1 (9 shots), complete final documentation

## Parallel Groups Explained

| Group | Features | Reason |
|-------|----------|--------|
| 1 | All Tasks | Strictly sequential - each level depends on previous levels passing |

## Implementation Order

All tasks must be executed in strict sequence:

1. **Task 1.1** - Must complete first to enable test infrastructure
2. **Tasks 1.2-1.10** - Sequential level-based testing, each building on previous

## Key Files to Modify

| File | Purpose |
|------|---------|
| `src/testing/types.ts` | Update schemas for null landmarks, 8 orientations, per-shot orientation |
| `src/testing/detection.ts` | Update comparison logic for per-shot orientation, handle null landmarks, extend orientation detection |
| `src/testing/run-tests.ts` | Add `--videos` flag for subset testing |
| `src/testing/reporting.ts` | Update output to show per-shot orientation comparison |
| `src/detection/shot-detector.ts` | Algorithm tuning during iterative testing |
| `test-data/algorithm-learnings.md` | Document algorithm insights and final configuration |

## Iteration Process Per Level

Each level task (1.2-1.10) follows this process:

1. Run tests on all videos up to current level using `--videos` flag
2. If all pass: Level complete, proceed to next
3. If any fail:
   - Analyze failure details (frame diffs, orientation mismatches)
   - Examine poses.json around labeled frames
   - Identify why algorithm detected differently
   - Update algorithm code
   - Document changes in algorithm-learnings.md
   - Retry (up to 10 attempts per level)
4. If max attempts reached: Stop and report with analysis

## Success Criteria

- All 9 test videos pass detection accuracy thresholds
- Shot count matches exactly
- Start/end frames within ±3 frames (expandable to ±5)
- Orientation matches per-shot
- Algorithm learnings documented
