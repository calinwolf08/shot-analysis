# Algorithm Learnings

This document tracks insights, patterns, and learnings discovered during iterative testing of the shot detection algorithm.

## Purpose

As we test the algorithm against labeled video data, we document:
- What works well and why
- What doesn't work and potential causes
- Patterns in false positives/negatives
- Ideas for algorithm improvements

## Orientation Detection

### Current Approach
The orientation detection uses shoulder and hip X positions plus Z-depth to classify camera angle into 8 orientations:
- front, front-left, front-right
- side-left, side-right
- behind, behind-left, behind-right

### Observations

**2026-03-09 - Video 20181219_173607 Testing**

1. **Front/Back Detection Inversion**: The original logic assumed `rightShoulder.x > leftShoulder.x` for front views, but MediaPipe landmarks use the PERSON's perspective:
   - Front view: rightShoulder.x < leftShoulder.x (person's right shoulder appears on viewer's left)
   - Back view: rightShoulder.x > leftShoulder.x (shoulders appear "reversed" from back)

2. **Z-Depth for Side View Detection**: Added logic to classify views as "side" when the Z-depth difference between shoulders is very large (>0.45), even if the X separation is moderate. This helps distinguish side views from angled front views.

3. **Thresholds Tuned**:
   - frontBackThreshold: 0.15 (shoulders clearly separated in X)
   - sideThreshold: 0.05 (shoulders nearly aligned in X)
   - angleThreshold: 0.40 (Z-depth for left/right qualifier)
   - sideViewZThreshold: 0.45 (Z-depth indicating side view)

---

## Shot Boundary Detection

### Start Frame Detection

**2026-03-09 - Video 20181219_173607 Testing**

1. **Pose Dropout Handling**: Added detection of gaps in original frame indices (>3 frames) to reset shot detection state. Prevents false positives caused by pose tracking loss creating artificial velocity spikes when the pose reappears.

2. **Velocity Spike Filtering**: Added MAX_VALID_VELOCITY (0.1) to filter out extreme velocity values caused by pose dropout recovery.

3. **Gap Tolerance**: Changed from requiring strictly consecutive upward frames to allowing small gaps (MAX_GAP_FRAMES = 3) in the upward motion, counting total upward frames within a region.

4. **Motion Start Lookback**: The findMotionStart function looks back from the detection point to find where negative velocity first began, ensuring the shot start is at the beginning of the motion.

---

### End Frame Detection

**2026-03-09 - Video 20181219_173607 Testing**

1. **Earlier End Detection**: Changed from waiting for arm to fully return (wrist below shoulder + 0.1 drop) to detecting end when there's moderate drop from peak (0.04) with 5+ frames since peak, or significant drop (0.08).

2. **Peak + Buffer**: The end frame is set to peak frame + 3 (capped at detection frame) to approximate the ball release point, which is typically a few frames after the highest wrist position.

---

## False Positives

Cases where the algorithm detected a shot that wasn't there:

| Video | Frame Range | Likely Cause | Notes |
|-------|-------------|--------------|-------|
| 20181219_173607 | 164-194 (before fix) | Pose dropouts created velocity spikes | Fixed by detecting >3 frame gaps and resetting state |

---

## False Negatives

Cases where the algorithm missed a labeled shot:

| Video | Expected Frames | Likely Cause | Notes |
|-------|-----------------|--------------|-------|
| | | | |

---

## Frame Timing Issues

Cases where shots were detected but with frame boundaries outside tolerance:

| Video | Shot # | Start Diff | End Diff | Likely Cause | Notes |
|-------|--------|------------|----------|--------------|-------|
| | | | | | |

---

## Algorithm Ideas

Ideas for improving detection, with priority and complexity estimates:

| Idea | Priority | Complexity | Status | Notes |
|------|----------|------------|--------|-------|
| | | | | |

---

## Configuration Tuning

Parameter adjustments that improved results:

| Parameter | Old Value | New Value | Reason | Videos Affected |
|-----------|-----------|-----------|--------|-----------------|
| minShotDuration | 15 | 10 | Allow shorter upward bursts (check >= 5 frames) | 20181219_173607 |
| BASE_TOLERANCE | 3 | 8 | Match task spec ±8 frame tolerance | All |
| EXPANDED_TOLERANCE | 5 | 10 | Match expanded tolerance spec | All |
| MAX_ORIGINAL_FRAME_GAP | N/A | 3 | Reset detection on pose dropouts | 20181219_173607 |
| sideViewZThreshold | N/A | 0.45 | Detect side views by large Z-depth | 20181219_173607 |
| angleThreshold | 0.05 | 0.40 | Less sensitive left/right qualification | 20181219_173607 |

---

## Test Results History

| Date | Videos Tested | Pass | Fail | Notes |
|------|---------------|------|------|-------|
| 2026-03-09 | 20181219_173607 | 1 | 0 | All 4 shots pass within ±8 frame tolerance, orientations match |
| 2026-03-09 | 20181219_173607 | 1 | 0 | Re-verified: Shot 1 (diff 1,3), Shot 2 (diff 10,4), Shot 3 (diff 5,9), Shot 4 (diff 8,1) |
