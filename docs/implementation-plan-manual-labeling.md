# Manual Labeling Workflow - Implementation Plan

## Overview

This implementation enables users to manually label shots without running full video analysis. The key change is loading video into the player immediately on file selection, enabling frame navigation, manual shot labeling, and on-demand pose export.

## Feature Breakdown

### Feature 1.0: Load Video on File Selection
**Parallel Group**: 1
**Estimated Tasks**: 2

#### Rationale
This is the foundation feature - all other features depend on the video being loaded. Must be implemented first. Modifies `validate-metrics.html` to add video loading on file input change.

#### Tasks
1. **Task 1.1: Implement loadVideoIntoPlayer function** - Create function to load video and extract metadata
2. **Task 1.2: Wire up file input and enable controls** - Connect file input to loader, enable navigation controls

---

### Feature 2.0: Enable Labeling UI After Video Loads
**Parallel Group**: 1
**Estimated Tasks**: 2

#### Rationale
Depends on Feature 1.0 (video must be loaded first). Changes button enable conditions from requiring `analysisData` to requiring `videoLoaded`. Same parallel group because it modifies the same UI state management code.

#### Tasks
1. **Task 2.1: Update Add Shot button enable logic** - Change enable condition to use videoLoaded
2. **Task 2.2: Add labeling panel visibility and test manual labeling** - Ensure labeling panel shows and full manual flow works

---

### Feature 3.0: Export Poses On-Demand
**Parallel Group**: 1
**Estimated Tasks**: 2

#### Rationale
Depends on Feature 1.0 (video loaded) and requires understanding of MediaPipe integration. Creates new `runPoseDetection()` function and modifies `exportPoses()` to run detection on-demand if no pose data exists.

#### Tasks
1. **Task 3.1: Create runPoseDetection function** - Implement standalone pose detection with progress indicator
2. **Task 3.2: Modify exportPoses and update button state** - Wire up on-demand detection and change enable condition

---

### Feature 4.0: Verify Existing Analyze Video Unchanged
**Parallel Group**: 1
**Estimated Tasks**: 1

#### Rationale
Regression testing to ensure existing "Analyze Video" workflow still works. No code changes, only verification. Same parallel group because it tests the same UI.

#### Tasks
1. **Task 4.1: Verify Analyze Video regression tests** - Test that full analysis still works correctly

---

## Parallel Groups Explained

| Group | Features | Reason |
|-------|----------|--------|
| 1 | All features | All modify same file (validate-metrics.html) and share UI state |

All features are in the same parallel group because:
- They all modify `validate-metrics.html`
- They share `appState` object
- Features 2.0 and 3.0 depend on Feature 1.0
- Feature 4.0 tests the integrated result

## Implementation Order

Must be sequential due to dependencies:
1. Feature 1.0 (foundation - video loading)
2. Feature 2.0 (depends on video being loaded)
3. Feature 3.0 (depends on video being loaded, uses similar patterns)
4. Feature 4.0 (regression testing after all changes)

## Shared Files to Watch

- `validate-metrics.html` - All features modify this file
- `appState` object - Shared state across all features
- Button enable functions - Multiple features modify button state logic

## Key Implementation Details

### Video Loading (Feature 1.0)
```javascript
async function loadVideoIntoPlayer(file) {
  elements.video.src = URL.createObjectURL(file);
  await new Promise(resolve => {
    elements.video.onloadedmetadata = resolve;
  });
  appState.fps = 30; // Default, HTML5 video doesn't expose native FPS
  appState.totalFrames = Math.floor(elements.video.duration * appState.fps);
  appState.videoLoaded = true;
  updateFrameDisplay();
}
```

### On-Demand Pose Detection (Feature 3.0)
```javascript
async function runPoseDetection() {
  const detector = await createPoseDetector();
  const frameProvider = await createVideoElementProvider(elements.video);
  const frames = [];

  for (let i = 0; i < appState.totalFrames; i++) {
    // Seek to frame, detect pose, collect data
    // Update progress: "Detecting poses: X / Y (Z%)"
  }

  return { frames, metadata };
}
```

### Button State Changes
| Button | Old Condition | New Condition |
|--------|--------------|---------------|
| Add Shot | `appState.analysisData` | `appState.videoLoaded` |
| Export Poses | `appState.poseData` | `appState.videoLoaded` |
