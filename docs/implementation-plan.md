# Shot Detection Testing Framework - Implementation Plan

## Overview

This implementation creates a testing framework to validate shot detection metrics against human-labeled ground truth. The framework separates pose extraction (browser/GPU) from shot detection testing (Node.js), enabling automated algorithm iteration.

## Feature Breakdown

### Feature 8.0: Labeling UI Extension

**Parallel Group**: 1
**Estimated Tasks**: 3

#### Rationale

The labeling UI must be built first because it's required to create the ground truth data (poses.json and labels.json) that the test runner needs. This extends the existing validate-metrics.html with frame navigation, shot labeling controls, and export functionality.

#### Tasks

1. **Task 8.1: Frame Navigation & Video Controls** - Add keyboard navigation (arrow keys), frame counter display, and video scrubbing to step through frames precisely
2. **Task 8.2: Shot Labeling Controls** - Add shot list panel, mark start/end buttons (s/e keys), add/remove shot buttons, and orientation dropdown
3. **Task 8.3: Server API & Export** - Create POST endpoints for saving poses and labels, integrate export buttons in UI

---

### Feature 9.0: Test Runner Infrastructure

**Parallel Group**: 1
**Estimated Tasks**: 3

#### Rationale

The test runner depends on the labeling UI to create test data, so it's in the same parallel group. This builds the Node.js CLI that discovers test cases, runs detection, and reports results.

#### Tasks

1. **Task 9.1: Test Discovery & Data Loading** - Scan test-data/ for subdirectories with poses.json + labels.json, create types for pose and label data structures
2. **Task 9.2: Detection Execution & Comparison** - Run shot detection algorithm on loaded poses, compare detected vs labeled metrics with tolerance rules
3. **Task 9.3: Reporting & CLI** - Console output formatting, JSON report generation, CLI argument parsing, exit codes

---

### Feature 10.0: Algorithm Iteration

**Parallel Group**: 1
**Estimated Tasks**: 2

#### Rationale

This is the iterative task where Claude analyzes failures, updates the algorithm, and maintains the learnings file. It depends on both labeling UI (for test data) and test runner (for execution).

#### Tasks

1. **Task 10.1: Shot Boundary Detection Algorithm** - Implement shot start detection (knee bend + hip drop) and shot end detection (arm extension + landing), create orientation detection from hip-shoulder alignment
2. **Task 10.2: Pass All Test Videos (Incremental)** - Incremental fix loop: Level 1 = video 1 only (iterate until pass, reset attempts). Level 2 = videos 1+2 (iterate until both pass, fix regressions first, reset attempts). Continue adding videos until all pass. Each level has its own max attempts counter.

---

## Parallel Groups Explained

| Group | Features                            | Reason                                                       |
| ----- | ----------------------------------- | ------------------------------------------------------------ |
| 1     | Labeling UI, Test Runner, Algorithm | Sequential dependencies - each feature requires the previous |

All features are in the same parallel group because:

- Test Runner needs test data from Labeling UI
- Algorithm Iteration needs Test Runner to execute and validate
- They share the test-data/ directory structure

## Implementation Order

1. **Feature 8.0: Labeling UI Extension** (foundation - creates test data)
2. **Feature 9.0: Test Runner Infrastructure** (depends on 8.0 for data format)
3. **Feature 10.0: Algorithm Iteration** (depends on 9.0 for test execution)

## Shared Files to Watch

- `validate-metrics.html` - Main labeling UI file
- `server.ts` - API endpoints for saving data
- `test-data/` - Directory containing all test cases and learnings
- `src/detection/shot-detector.ts` - Algorithm being tested and iterated

## Key Data Structures

### poses.json

```json
{
  "video": "chris 5.mp4",
  "fps": 30,
  "totalFrames": 124,
  "frames": [{ "frameIndex": 0, "landmarks": [...] }]
}
```

### labels.json

```json
{
  "video": "chris 5.mp4",
  "orientation": "front-right",
  "shots": [{ "shotNumber": 1, "startFrame": 55, "endFrame": 76 }]
}
```

## Success Criteria

1. User can load a video, navigate frames, and label shots with start/end frames
2. User can select orientation and export poses.json + labels.json
3. Test runner discovers all test cases and reports pass/fail with frame differences
4. Algorithm correctly detects shot boundaries within ±3-5 frames across all test videos
5. algorithm-learnings.md documents the final working approach
