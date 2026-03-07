# Shot Detection Testing Framework - Design Document

## Overview

A testing framework that validates shot detection metrics against human-labeled ground truth data. Separates pose extraction (browser/GPU required) from shot detection testing (Node.js).

## Goals

1. **Labeling Tool**: Extend existing validator UI to label shot boundaries and camera orientation
2. **Pose Export**: Save extracted poses to JSON for offline testing
3. **Test Runner**: Node.js-based comparison of detected vs labeled metrics
4. **Incremental Testing**: Tasks structured for Claude-orchestrated fix loop via progress.json

## Core Metrics to Test

### Shot Start Frame
- **Definition**: Frame when legs start bending (beginning of shooting motion)
- **Detection approach**: Knee angle decrease AND hip drop (algorithm can be creative)
- **Tolerance**: ±3 frames initially, expandable to ±5 if within 4 frames

### Shot End Frame
- **Definition**: Frame when arms reach max extension AND legs start bending again (landing)
- **Detection approach**: Wrist height peak + knee angle decrease (algorithm can be creative)
- **Tolerance**: ±3 frames initially, expandable to ±5 if within 4 frames

### Camera Orientation
- **Categories**: front, side-left, side-right, front-left, front-right
- **Detection approach**: Hip-to-shoulder alignment analysis
- **Tolerance**: Exact match required

## File Structure

```
test-data/
├── algorithm-learnings.md  # Persistent learnings from test iterations
├── chris-5/
│   ├── poses.json          # Extracted pose landmarks (124 frames)
│   └── labels.json         # Ground truth labels
├── chris-6/
│   ├── poses.json
│   └── labels.json
└── ...
```

### poses.json Format
```json
{
  "video": "chris 5.mp4",
  "fps": 30,
  "totalFrames": 124,
  "width": 1080,
  "height": 1920,
  "extractedAt": "2026-03-07T00:00:00.000Z",
  "frames": [
    {
      "frameIndex": 0,
      "timestamp": 0,
      "poseConfidence": 0.95,
      "landmarks": [
        { "x": 0.5, "y": 0.3, "z": 0.1, "visibility": 0.98 },
        ...
      ]
    }
  ]
}
```

### labels.json Format
```json
{
  "video": "chris 5.mp4",
  "labeledBy": "human",
  "labeledAt": "2026-03-07T00:00:00.000Z",
  "orientation": "front-right",
  "shots": [
    {
      "shotNumber": 1,
      "startFrame": 55,
      "endFrame": 76
    },
    {
      "shotNumber": 2,
      "startFrame": 150,
      "endFrame": 171
    }
  ]
}
```

## Components

### 1. Labeling UI Extension (validate-metrics.html)

Add to existing validator:
- **Shot List Panel**: Display detected shots, allow adding/editing labels
- **Frame Navigation**: Step through frames with keyboard (arrow keys)
- **Label Controls**:
  - "Mark Shot Start" button (or 's' key) - sets start frame for current shot
  - "Mark Shot End" button (or 'e' key) - sets end frame for current shot
  - "Add Shot" button - creates new shot entry
  - "Remove Shot" button - deletes current shot
- **Orientation Selector**: Dropdown with 5 options
- **Export Buttons**:
  - "Export Poses" - saves poses.json to test-data/<video>/
  - "Export Labels" - saves labels.json to test-data/<video>/

### 2. Test Runner (test-runner.ts)

Node.js CLI that:
1. Loads poses.json and labels.json from test-data/
2. Runs shot detection algorithm on poses
3. Compares detected shots with labeled shots
4. Reports results to console and JSON

```bash
# Run all tests (discovers videos from test-data/ directory)
npx tsx test-runner.ts

# Run single test
npx tsx test-runner.ts --video chris-5
```

**Test Discovery**: The test runner scans `test-data/` for subdirectories containing both `poses.json` and `labels.json`. Any folder with both files is treated as a test case. This allows adding new test videos without modifying code or configuration.

### 3. Console Output Format

```
=== Shot Detection Test Results ===

✓ chris-5: PASS
  Orientation: front-right (correct)
  Shot 1: start=55 (label=55, diff=0), end=76 (label=76, diff=0)
  Shot 2: start=152 (label=150, diff=+2), end=170 (label=171, diff=-1)

✗ chris-6: FAIL
  Orientation: front (expected: front-left) ← MISMATCH
  Shot 1: start=42 (label=38, diff=+4), end=61 (label=58, diff=+3) ← START OFF BY 4

Summary: 1/2 passed
```

### 4. JSON Report Format (test-results.json)

```json
{
  "runAt": "2026-03-07T00:00:00.000Z",
  "summary": {
    "total": 2,
    "passed": 1,
    "failed": 1
  },
  "tolerance": {
    "frames": 3,
    "expandedTo": 5
  },
  "results": [
    {
      "video": "chris-5",
      "status": "pass",
      "orientation": {
        "detected": "front-right",
        "expected": "front-right",
        "match": true
      },
      "shots": [
        {
          "shotNumber": 1,
          "startFrame": { "detected": 55, "expected": 55, "diff": 0 },
          "endFrame": { "detected": 76, "expected": 76, "diff": 0 }
        }
      ]
    }
  ]
}
```

## Task Structure for progress.json

The tasks are structured to enforce incremental testing:

```json
{
  "id": "8.0",
  "name": "Shot Detection Testing Framework",
  "status": "pending",
  "tasks": [
    {
      "id": "8.1",
      "name": "Labeling UI Extension",
      "context": {
        "user_story": "As a tester, I want to label shot start/end frames and orientation in the validator UI so I can create ground truth data for testing.",
        "acceptance_criteria": [
          "Can navigate frames with arrow keys",
          "Can mark shot start frame (s key)",
          "Can mark shot end frame (e key)",
          "Can add/remove shots",
          "Can select orientation from dropdown",
          "Can export poses.json and labels.json"
        ]
      }
    },
    {
      "id": "8.2",
      "name": "Test Runner Infrastructure",
      "context": {
        "user_story": "As a developer, I want a Node.js test runner that compares detection vs labels so I can validate the algorithm without a browser.",
        "acceptance_criteria": [
          "Loads poses.json and labels.json from test-data/",
          "Runs shot detection on poses",
          "Compares detected vs labeled metrics",
          "Outputs console summary and JSON report",
          "Returns exit code 0 on all pass, 1 on any fail"
        ]
      }
    },
    {
      "id": "8.3",
      "name": "Pass All Test Videos",
      "context": {
        "user_story": "Run and fix shot detection until all test videos pass.",
        "acceptance_criteria": [
          "Read test-data/ directory to discover all test videos (folders with poses.json + labels.json)",
          "For each video: shot start detected within tolerance of label",
          "For each video: shot end detected within tolerance of label",
          "For each video: orientation matches exactly",
          "test-runner.ts returns exit code 0 (all tests pass)",
          "algorithm-learnings.md updated with final working approach"
        ],
        "process": [
          "1. Read algorithm-learnings.md before starting",
          "2. Run test-runner.ts to see current state",
          "3. If failures, analyze pose data for labeled vs detected frames",
          "4. Update algorithm based on observations",
          "5. Update algorithm-learnings.md with insights",
          "6. Re-run tests, ensure no regressions",
          "7. Repeat until all tests pass"
        ],
        "notes": "Algorithm can be redesigned creatively. Tolerance starts at ±3 frames, can expand to ±5 if within 4 frames. Max attempts before stopping and reporting to user."
      }
    }
  ]
}
```

## Algorithm Design Freedom

The current shot detection uses wrist velocity. For this testing framework:

1. **Starting point**: Hip drop + knee bend for shot start, arm extension overhead + knee bend (landing) for shot end

2. **Data-driven iteration process**:
   When a test fails, Claude should:
   - Load the labeled frames (±threshold) from labels.json
   - Load the corresponding pose data from poses.json for those frames
   - Analyze what makes the labeled frames distinct (e.g., knee angle values, hip position, wrist height)
   - Analyze why the INCORRECTLY detected frames were chosen (what triggered false detection)
   - Identify patterns or thresholds that would correctly detect labeled frames while avoiding false positives
   - Update the algorithm based on observed pose data
   - Update `test-data/algorithm-learnings.md` with insights from this failure
   - Re-run tests to verify the fix works without breaking other videos

3. **Example iteration**:
   - Claude reads `algorithm-learnings.md` before starting
   - Test fails: detected start=62, labeled start=55
   - Claude examines poses.json frames 52-58 (label ±3) - why are these the RIGHT frames?
   - Finds knee angle drops from 170° to 155° between frames 54-56
   - Claude examines frame 62 - why was this INCORRECTLY detected?
   - Finds wrist velocity spiked at frame 62 but knees hadn't bent yet
   - Learns: wrist velocity alone is unreliable, must combine with knee bend
   - Updates algorithm to require knee angle decrease > 10° AND wrist movement
   - Updates `algorithm-learnings.md`: "Wrist velocity alone causes late detection - must combine with knee bend signal"
   - Re-runs test, now passes

4. **Flexibility**:
   Claude is free to discover the correct calculation by analyzing the data. Suggestions like "hip drop + knee bend" are starting points, not requirements. The goal is to find a calculation that:
   - Correctly identifies shot boundaries across ALL test videos
   - Uses consistent thresholds (not per-video tuning)
   - Is derived from observable patterns in the pose landmark data

5. **Constraints**:
   - Must work in Node.js (no browser APIs)
   - Must use pose landmarks from poses.json
   - Must achieve consistent threshold across all test videos
   - No machine learning - use deterministic calculations on pose data

6. **Algorithm Learnings File** (`test-data/algorithm-learnings.md`):
   A persistent document that Claude reads before each test iteration and updates after failures. Contains:

   ```markdown
   # Shot Detection Algorithm Learnings

   ## What Works
   - [Approaches that successfully detect shots]
   - [Threshold values that are reliable]

   ## What Doesn't Work
   - [Approaches that caused false positives/negatives]
   - [Why they failed]

   ## Key Observations
   - [Patterns discovered in pose data]
   - [Differences between orientations]

   ## Current Algorithm Summary
   - [Brief description of current detection logic]
   - [Key thresholds and their values]

   ## History
   - [Date]: [Change made] - [Result]
   ```

   This file serves as institutional memory, preventing Claude from repeating failed approaches and building on successful discoveries across test iterations.

## Tolerance Rules

1. **Initial tolerance**: ±3 frames
2. **Expansion rule**: If algorithm is within 4 frames of label, tolerance can expand to ±5
3. **Hard limit**: Never exceed ±5 frames (user labels are accurate within ±5)
4. **Final goal**: Single consistent tolerance value that works for all test videos

## Implementation Order

1. **Phase 1**: Labeling UI (extend validate-metrics.html)
2. **Phase 2**: Test runner infrastructure
3. **Phase 3**: Create first test case (chris-5)
4. **Phase 4**: Iterative - add videos one at a time, fix regressions

## Server Integration

The existing server.ts needs endpoints for saving labels:
- `POST /api/save-poses` - saves poses.json to test-data/<video>/
- `POST /api/save-labels` - saves labels.json to test-data/<video>/

This allows the browser UI to persist data without manual file handling.
