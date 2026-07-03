# Shot Metrics by Phase

This document organizes all metrics by when they occur during a basketball shot. Each metric is classified as either:
- **Find frame** - Algorithm must detect WHEN this happens
- **Measure @ frame** - Read value from pose data AT a specific frame
- **Derived** - Computed from frame timings or across multiple frames

---

## Phase 1: LOAD (Dip)

*Player catches ball, bends knees, ball may dip*

| Type | Metric | What to tag/find |
|------|--------|------------------|
| **Find frame** | `leg_bend_low_point` | Deepest knee bend |
| **Find frame** | `ball_low_point` | Lowest ball position |
| **Measure @ leg_bend_low_point** | `kneeFlexion` | Knee angle (degrees) |
| **Measure @ leg_bend_low_point** | `hipDrop` | How far hips dropped (normalized) |
| **Measure @ ball_low_point** | `ballDip` | How far ball dropped (normalized) |
| **Measure @ leg_bend_low_point** | `backPostureLoad` | Spine angle during load (degrees) |

---

## Phase 2: RISE

*Legs extend, ball moves upward toward set point*

| Type | Metric | What to tag/find |
|------|--------|------------------|
| **Find frame** | `legs_start_extending` | First frame legs push up |
| **Find frame** | `ball_starts_upward` | First frame ball rises |
| **Derived (%)** | `legRiseStart` | legs_start_extending as % of shot |
| **Derived (%)** | `ballRiseStart` | ball_starts_upward as % of shot |
| **Derived (diff)** | `ballLegSync` | ballRiseStart - legRiseStart |
| **Measure across rise** | `ballPath` | Lateral deviation during rise (score) |
| **Measure @ legs_start_extending** | `backPostureRise` | Spine angle during rise (degrees) |
| **Measure @ 10% of rise** | `wristSetEarly` | Is wrist already in shooting position? (boolean/angle) |

**Wrist Set Check:**
- Measured at 10% between `ball_starts_upward` and `set_point`
- Check if wrist is already cocked into shooting pocket
- Early set = good, late flip = needs work

---

## Phase 3: SET POINT

*Ball at highest pre-release position, arms cocked*

| Type | Metric | What to tag/find |
|------|--------|------------------|
| **Find frame** | `set_point` | Ball at peak, before release motion |
| **Measure @ set_point** | `shootingElbowAngle` | Elbow bend (degrees) |
| **Measure @ set_point** | `shootingElbowFlare` | Elbow out from body (degrees) |
| **Measure @ set_point** | `setPointHeight` | Ball height relative to head (normalized) |
| **Measure @ set_point** | `ballBehindHead` | How far back ball is (normalized) |
| **Measure @ set_point** | `guideElbowFlare` | Guide arm elbow angle (degrees) |
| **Measure @ set_point** | `guideHandPosition` | side / under / front / thumb-up |
| **Measure @ set_point** | `shoulderAlignment` | Shoulder rotation (degrees) |
| **Measure @ set_point** | `headTilt` | Head tilt (degrees) |
| **Measure @ set_point** | `handCupVsHinge` | cup / hinge / neutral |
| **Derived (duration)** | `setPointDuration` | Time at set point (ms) |

---

## Phase 4: RELEASE

*Arm extends, wrist snaps, ball leaves hand*

| Type | Metric | What to tag/find |
|------|--------|------------------|
| **Find frame** | `release` | Ball leaves shooting hand |
| **Derived (%)** | `releaseStart` | release frame as % of shot |
| **Measure @ release** | `releaseAngle` | Arm angle at release (degrees) |
| **Measure @ release** | `releasePoint` | Position at release (normalized) |
| **Measure @ release** | `wristSnapAngle` | Wrist flexion (degrees) |
| **Measure @ release** | `backPostureRelease` | Spine angle at release (degrees) |
| **Measure @ release** | `guideHandSeparation` | Has guide hand separated? (boolean/distance) |

**Guide Hand Check:**
- Measured at `release` frame
- Check if guide hand has cleanly separated from ball
- Early separation = good, late/thumb interference = needs work

---

## Phase 5: FOLLOW-THROUGH

*Arm fully extended, held*

| Type | Metric | What to tag/find |
|------|--------|------------------|
| **Find frame** | `arms_fully_extended` | Maximum arm extension |
| **Find frame** | `feet_leave_ground` | Jump (if any) |
| **Find frame** | `feet_land` | Landing / shot end |
| **Measure @ arms_fully_extended** | `maxArmExtension` | Arm extension angle (degrees) |
| **Derived (%)** | `followThroughHold` | Duration arm stays extended |

---

## OVERALL (Shot-level)

| Type | Metric | What to tag/find |
|------|--------|------------------|
| **Find frame** | `shot_start` | First movement (legs_start_bending) |
| **Derived** | `totalShotDuration` | End frame - start frame (ms) |

---

## Summary

### Frames to Find (10)

| # | Frame | Phase |
|---|-------|-------|
| 1 | `shot_start` / `legs_start_bending` | Load |
| 2 | `leg_bend_low_point` | Load |
| 3 | `ball_low_point` | Load |
| 4 | `legs_start_extending` | Rise |
| 5 | `ball_starts_upward` | Rise |
| 6 | `set_point` | Set Point |
| 7 | `release` | Release |
| 8 | `arms_fully_extended` | Follow-through |
| 9 | `feet_leave_ground` | Follow-through |
| 10 | `feet_land` | Follow-through |

### Metrics by Measurement Type

**Angle measurements (12):**
- `kneeFlexion`, `backPostureLoad`, `backPostureRise`, `backPostureRelease`
- `shootingElbowAngle`, `shootingElbowFlare`, `guideElbowFlare`
- `shoulderAlignment`, `headTilt`
- `releaseAngle`, `wristSnapAngle`, `maxArmExtension`

**Position measurements (5):**
- `hipDrop`, `ballDip`, `setPointHeight`, `ballBehindHead`, `releasePoint`

**Categorical measurements (2):**
- `guideHandPosition` (side / under / front / thumb-up)
- `handCupVsHinge` (cup / hinge / neutral)

**Checkpoint measurements (2):**
- `wristSetEarly` - measured at 10% of rise phase (boolean/angle)
- `guideHandSeparation` - measured at release frame (boolean/distance)

**Path/deviation measurements (1):**
- `ballPath`

**Timing/percentage derived (6):**
- `legRiseStart`, `ballRiseStart`, `ballLegSync`
- `releaseStart`
- `setPointDuration`, `followThroughHold`, `totalShotDuration`

---

## Calibration Priority

For real-time feedback, prioritize metrics that are:
1. Reliably detectable from phone camera angles
2. Have clear corrective actions
3. Most impactful for shooting accuracy

**Tier 1 (Most Actionable):**
- `shootingElbowFlare` - "Tuck your elbow"
- `followThroughHold` - "Hold your finish"
- `ballLegSync` - "Push up as you shoot"
- `setPointHeight` - "Higher release point"
- `wristSetEarly` - "Set your wrist early"

**Tier 2 (Important):**
- `kneeFlexion`, `backPostureLoad/Rise/Release`, `wristSnapAngle`

**Tier 3 (Track over time):**
- `totalShotDuration`, `setPointDuration`, `guideHandSeparation`
