# Design: Manual Labeling Workflow Without Analysis

## Overview

Enable users to select a video, manually label shots with frame ranges and orientation, and export poses - all without clicking "Analyze Video".

## Current State

- **Video loading**: Only loads into player when "Analyze Video" is clicked
- **Add Shot / labeling**: Requires "Analyze Video" first (disabled)
- **Export Poses**: Requires pose data from analysis (disabled)
- **Frame navigation**: Works after video loads (but video doesn't load until analysis)

## Goals

1. Load video into player immediately on file selection
2. Enable manual shot labeling without prior analysis
3. Enable pose export on-demand (runs detection when needed)
4. Keep existing "Analyze Video" workflow unchanged

## Workflow

```
Select Video File
       ↓
Video loads into player
Frame navigation enabled
       ↓
   ┌───┴────────────────┐
   ↓                    ↓
[Analyze Video]     [Add Shot]
(auto detect)       (manual label)
   ↓                    ↓
Full analysis       Set start/end frames (S/E keys)
+ metrics           Set orientation
   ↓                    ↓
   └────────┬───────────┘
            ↓
[Export Poses] - runs detection if needed, saves to server
[Export Labels] - exports shot definitions
```

## Features

### Feature 1: Load Video on File Selection

**Implementation:**
- Add `onchange` handler to video file input
- Create `loadVideoIntoPlayer()` function that:
  - Loads video file into HTML video element using `URL.createObjectURL()`
  - Waits for `loadedmetadata` event
  - Extracts metadata (fps from video or defaults to 30, duration, calculated frame count)
  - Sets `appState.videoLoaded = true`, `appState.fps`, `appState.totalFrames`
  - Enables frame navigation controls
  - Updates frame display

**Tests:**
- [ ] Video loads into player when file selected
- [ ] Metadata (fps, totalFrames) extracted correctly
- [ ] Frame navigation controls enabled after video loads
- [ ] `appState.videoLoaded` set to true
- [ ] Can step through frames after video loads (no analysis)

### Feature 2: Enable Labeling UI After Video Loads

**Implementation:**
- Enable "Add Shot" button when `appState.videoLoaded` is true (not requiring `appState.analysisData`)
- Show labeling panel when video is loaded
- S/E key shortcuts work for setting frame boundaries
- Orientation dropdown available for each shot (existing options)

**Orientation Options:**
- Front
- Side Left (camera facing shooter's left side)
- Side Right (camera facing shooter's right side)
- Front Left
- Front Right

Note: Left/Right are relative to the shooter.

**Tests:**
- [ ] "Add Shot" button enabled after video loads (no analysis needed)
- [ ] Labeling panel visible after video loads
- [ ] Can add shot and set start/end frames with S/E keys
- [ ] Can set orientation for shot from dropdown
- [ ] Shot validation works (no overlaps, end > start)
- [ ] Export Labels works with manually created shots

### Feature 3: Export Poses On-Demand

**Implementation:**
- Enable "Export Poses" button when `appState.videoLoaded` is true (not requiring `appState.poseData`)
- Modify `exportPoses()` function:
  ```javascript
  async function exportPoses() {
    // If no pose data exists, run detection first
    if (!appState.poseData) {
      showProgress("Running pose detection...");
      appState.poseData = await runPoseDetection();
    }

    // Then export as before
    await savePosesToServer(appState.poseData, videoName);
  }
  ```
- Create `runPoseDetection()` function that:
  - Creates MediaPipe pose detector (browser version)
  - Creates frame provider from video element
  - Iterates through all frames, extracting poses
  - Shows progress indicator (frame X of Y)
  - Returns pose data in expected format

**Progress Indicator:**
- Display "Detecting poses: frame X of Y (Z%)"
- Allow cancellation if possible

**Tests:**
- [ ] "Export Poses" enabled after video loads (without analysis)
- [ ] Clicking Export Poses without prior analysis triggers pose detection
- [ ] Progress indicator shown during pose detection
- [ ] Poses saved to `/test-data/{video-name}/poses.json`
- [ ] Export Poses still works when poseData exists (from Analyze Video)
- [ ] Pose data format matches existing format

### Feature 4: Analyze Video Unchanged

Existing "Analyze Video" workflow remains unchanged:
- Runs full analysis pipeline
- Auto-detects shots
- Calculates metrics
- Populates pose data

**Tests:**
- [ ] "Analyze Video" button still works as before
- [ ] Auto shot detection produces shots
- [ ] Metrics calculated for detected shots
- [ ] Pose data populated after analysis
- [ ] Can switch between manual and auto-detected shots

## UI Changes

### Buttons State Logic

| Button | Current Enable Condition | New Enable Condition |
|--------|-------------------------|---------------------|
| Analyze Video | Video file selected | Video file selected (unchanged) |
| Add Shot | `appState.analysisData` exists | `appState.videoLoaded` |
| Export Poses | `appState.poseData` exists | `appState.videoLoaded` |
| Export Labels | Shots exist with valid frames | Shots exist with valid frames (unchanged) |

### File: `validate-metrics.html`

Key functions to modify:
1. `elements.videoFileInput.onchange` - Add video loading logic
2. `updateExportPosesButtonState()` - Change enable condition
3. `exportPoses()` - Add on-demand pose detection
4. Add Shot button enable logic - Change condition

## Data Flow

### Manual Labeling Flow (New)
```
1. User selects video file
2. loadVideoIntoPlayer() called
   - video.src = URL.createObjectURL(file)
   - Wait for loadedmetadata
   - Set appState.videoLoaded, fps, totalFrames
3. UI enables: Add Shot, Export Poses, frame navigation
4. User adds shots manually (Add Shot button)
5. User navigates frames, sets start/end with S/E keys
6. User sets orientation for each shot
7. User clicks Export Poses
   - runPoseDetection() called (no prior analysis)
   - Poses saved to server
8. User clicks Export Labels
   - Labels saved with shot definitions
```

### Auto Analysis Flow (Existing, Unchanged)
```
1. User selects video file
2. User clicks Analyze Video
3. runAnalysis() called
   - Creates analyzer, frame provider
   - Runs full pipeline (pose detection + shot detection + metrics)
4. UI populated with auto-detected shots and metrics
5. User can export poses/labels
```

## Technical Notes

### FPS Detection
- HTML5 video doesn't expose native FPS
- Options:
  1. Default to 30fps (current behavior)
  2. Use filename pattern matching (e.g., `_60fps.mp4`)
  3. Allow user to specify FPS
  4. Use mediainfo.js library (adds dependency)

Recommendation: Default to 30fps, allow user override in config panel.

### Pose Detection Progress
- Total frames = duration * fps
- Report progress every 10 frames or 100ms
- Display: "Detecting poses: 150 / 300 (50%)"

### Memory Considerations
- Pose data for 300 frames @ 33 landmarks = ~100KB
- Video element handles streaming, no full video in memory
- Pose detection processes one frame at a time

## Testing Strategy

### Unit Tests (if applicable)
- Test `loadVideoIntoPlayer()` logic
- Test button state update functions
- Test pose data format validation

### Integration Tests
- Full flow: select video -> load -> add shot -> set frames -> export
- Verify poses.json file content
- Verify labels.json file content

### Manual Testing Checklist
1. [ ] Select video, verify it loads into player
2. [ ] Step through frames using arrow keys
3. [ ] Click Add Shot, verify shot appears in list
4. [ ] Press S to set start frame, verify value updates
5. [ ] Press E to set end frame, verify value updates
6. [ ] Set orientation dropdown, verify value saves
7. [ ] Click Export Poses, verify progress shows
8. [ ] Verify poses.json created on server
9. [ ] Click Export Labels, verify labels.json created
10. [ ] Click Analyze Video, verify full analysis still works
11. [ ] Verify Export Poses works after analysis (immediate, no re-detection)
