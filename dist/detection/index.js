/**
 * Shot detection and phase identification module.
 *
 * This module provides types and utilities for detecting basketball shots
 * in video frames and identifying the key phases of each shot.
 *
 * ## Shot Phases
 *
 * A basketball shot is divided into 6 sequential phases:
 * 1. **Gather** - Ball is caught or pulled in, player prepares to shoot
 * 2. **Load** - Player loads legs and brings ball to shooting pocket
 * 3. **Rise** - Player begins upward motion, ball rises with body
 * 4. **SetPoint** - Ball reaches highest point before release
 * 5. **Release** - Ball leaves hand, wrist snaps forward
 * 6. **FollowThrough** - Post-release motion, arm fully extended
 *
 * Note: Some phases may be missing in partial shots (e.g., video starts mid-shot).
 *
 * ## Usage
 *
 * ```typescript
 * import { ShotPhase, Shot, FrameLabel } from './detection';
 *
 * // Check what phase a frame belongs to
 * const frameLabel: FrameLabel = {
 *   frameIndex: 50,
 *   phase: ShotPhase.Rise,
 *   shotIndex: 0,
 *   confidence: 0.95,
 * };
 *
 * // Define a detected shot with its phases
 * const shot: Shot = {
 *   shotIndex: 0,
 *   frameRange: { start: 10, end: 80 },
 *   phases: {
 *     [ShotPhase.Gather]: { startFrame: 10, endFrame: 20 },
 *     [ShotPhase.Load]: { startFrame: 21, endFrame: 35 },
 *     [ShotPhase.Rise]: { startFrame: 36, endFrame: 50 },
 *     [ShotPhase.SetPoint]: { startFrame: 51, endFrame: 60 },
 *     [ShotPhase.Release]: { startFrame: 61, endFrame: 65 },
 *     [ShotPhase.FollowThrough]: { startFrame: 66, endFrame: 80 },
 *   },
 *   confidence: 0.92,
 * };
 * ```
 */
// Enum and constants
export { ShotPhase, SHOT_PHASES, TOTAL_SHOT_PHASES } from "./types";
// Helper function exports
export { createEmptyPhaseRange, createEmptyShot, createNoShotFrameLabel, hasPhase, getPhaseDuration, getShotDuration, } from "./types";
// Shot boundary detector
export { ShotBoundaryDetector, createShotBoundaryDetector, } from "./shot-detector";
// Phase detector
export { PhaseDetector, createPhaseDetector } from "./phase-detector";
// Integrated shot detector
export { ShotDetector, createShotDetector } from "./integrated-shot-detector";
//# sourceMappingURL=index.js.map