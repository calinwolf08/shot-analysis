/**
 * Type definitions for shot detection and phase identification.
 *
 * This module defines types for detecting basketball shots in video frames
 * and identifying the key phases of each shot.
 *
 * @see Feature 4.0 - Shot Detection & Phase Identification
 */
/**
 * Phases of a basketball shot.
 *
 * The shot is divided into 6 sequential phases:
 * - gather: Ball is caught or pulled in, player prepares to shoot
 * - load: Player loads legs and brings ball to shooting pocket
 * - rise: Player begins upward motion, ball rises with body
 * - setPoint: Ball reaches highest point before release, elbow at ~90 degrees
 * - release: Ball leaves hand, wrist snaps forward
 * - followThrough: Post-release motion, arm fully extended
 *
 * Note: Some phases may be missing in partial shots (e.g., video starts mid-shot).
 */
export var ShotPhase;
(function (ShotPhase) {
    /** Ball is caught or pulled in, player prepares to shoot */
    ShotPhase["Gather"] = "gather";
    /** Player loads legs and brings ball to shooting pocket */
    ShotPhase["Load"] = "load";
    /** Player begins upward motion, ball rises with body */
    ShotPhase["Rise"] = "rise";
    /** Ball reaches highest point before release */
    ShotPhase["SetPoint"] = "setPoint";
    /** Ball leaves hand, wrist snaps forward */
    ShotPhase["Release"] = "release";
    /** Post-release motion, arm fully extended */
    ShotPhase["FollowThrough"] = "followThrough";
})(ShotPhase || (ShotPhase = {}));
/**
 * All valid shot phase values.
 * Useful for iteration and validation.
 */
export const SHOT_PHASES = Object.values(ShotPhase);
/**
 * Number of shot phases.
 */
export const TOTAL_SHOT_PHASES = 6;
/**
 * Creates an empty PhaseRange.
 * Useful for initialization or representing undetected phases.
 */
export function createEmptyPhaseRange() {
    return {
        startFrame: 0,
        endFrame: 0,
    };
}
/**
 * Creates an empty Shot with default values.
 * Useful for initialization.
 *
 * @param shotIndex - The index of the shot
 */
export function createEmptyShot(shotIndex = 0) {
    return {
        shotIndex,
        frameRange: { start: 0, end: 0 },
        phases: {},
    };
}
/**
 * Creates a FrameLabel indicating no shot is occurring.
 *
 * @param frameIndex - The frame index
 */
export function createNoShotFrameLabel(frameIndex) {
    return {
        frameIndex,
        phase: null,
        shotIndex: null,
        confidence: 1.0,
    };
}
/**
 * Checks if a phase is present in a shot's phases.
 *
 * @param phases - The shot phases object
 * @param phase - The phase to check
 */
export function hasPhase(phases, phase) {
    return phases[phase] !== undefined;
}
/**
 * Gets the duration of a phase in frames.
 * Returns 0 if the phase is not present.
 *
 * @param phases - The shot phases object
 * @param phase - The phase to get duration for
 */
export function getPhaseDuration(phases, phase) {
    const range = phases[phase];
    if (range === undefined) {
        return 0;
    }
    return range.endFrame - range.startFrame + 1;
}
/**
 * Gets the total duration of a shot in frames.
 *
 * @param shot - The shot to get duration for
 */
export function getShotDuration(shot) {
    return shot.frameRange.end - shot.frameRange.start + 1;
}
//# sourceMappingURL=types.js.map