/**
 * Metric extraction module for basketball shot analysis.
 *
 * This module provides types and orchestration for calculating form metrics
 * from detected shots. It uses a strategy pattern for metric calculators,
 * allowing flexible composition of different metrics.
 *
 * ## Implemented Metrics (27 total)
 *
 * **Shooting Arm (5):**
 * - shootingElbowFlare: Elbow angle deviation from body plane (degrees)
 * - shootingElbowAngle: Elbow bend at set point (degrees)
 * - maxArmExtension: Maximum arm extension during follow-through (degrees)
 * - wristSnapAngle: Wrist flexion at release (degrees)
 * - followThroughHold: Time arm stays extended after release (percent)
 *
 * **Guide Arm (3):**
 * - guideElbowFlare: Guide arm elbow deviation (degrees)
 * - guideHandPosition: Hand position category (side/under/front/thumb-up)
 * - guideHandRelease: When guide hand separates from ball (percent)
 *
 * **Ball Position (7):**
 * - ballDip: How far ball drops before rising (normalized)
 * - ballPath: Straightness of ball path to set point (deviation score)
 * - setPointHeight: Height of set point relative to head (normalized)
 * - setPointDuration: Time ball stays at set point (ms)
 * - releasePoint: Position at release (normalized coords)
 * - releaseAngle: Shooting arm angle at release (degrees)
 * - ballBehindHead: Furthest back position (normalized)
 *
 * **Lower Body (3):**
 * - hipDrop: How far hips drop during load (normalized)
 * - kneeFlexion: Knee bend angle at maximum bend (degrees)
 * - legExtensionStart: When legs begin extending (percent)
 *
 * **Posture & Alignment (4):**
 * - backPosture: Spine angle from vertical (degrees)
 * - headTilt: Head tilt from vertical (degrees)
 * - shoulderAlignment: Shoulder rotation from target (degrees)
 * - handCupVsHinge: Hand position category (cup/hinge/neutral)
 *
 * **Timing & Synchronization (5):**
 * - ballRiseStart: When ball begins rising (percent)
 * - legRiseStart: When legs begin extending (percent)
 * - ballLegSync: Difference between ball and leg rise (percent)
 * - releaseStart: When release motion begins (percent)
 * - totalShotDuration: Full shot duration (ms)
 *
 * ## Known Limitations
 *
 * 1. **Ball Position Inference**: Ball position is inferred from hand landmarks
 *    (index finger midpoint), not actual ball detection. Only valid when hands
 *    are together. After release, ball cannot be tracked.
 *
 * 2. **Z-Depth Limitations**: MediaPipe provides estimated Z coordinates but
 *    they are less reliable than X/Y. Metrics using Z (like elbow flare)
 *    have inherently lower confidence.
 *
 * 3. **Occlusion Handling**: When landmarks are occluded (low visibility),
 *    metrics have reduced confidence but may still calculate using the
 *    low-confidence data. Future improvement: skip frames with too many
 *    occluded landmarks.
 *
 * 4. **Frame Rate Dependency**: Timing metrics assume consistent frame rate.
 *    Variable frame rate videos may have timing inaccuracies.
 *
 * 5. **Single Shooter**: Currently optimized for single shooter in frame.
 *    Multiple people may cause incorrect landmark associations.
 *
 * 6. **Camera Angle**: Best results with camera positioned at shooter's
 *    non-shooting side, perpendicular to shooting plane. Front or back
 *    views significantly reduce accuracy.
 *
 * ## Future Improvements
 *
 * - Real ball detection using object detection models
 * - Multi-person tracking and shooter identification
 * - Camera angle detection and metric adjustment
 * - Confidence-weighted metric averaging
 * - Historical shot comparison and trend analysis
 * - 3D pose reconstruction from multiple cameras
 *
 * @example
 * ```typescript
 * import {
 *   MetricOrchestrator,
 *   type MetricCalculator,
 *   type ShotAnalysis
 * } from './metrics';
 *
 * // Create orchestrator with custom calculators
 * const orchestrator = new MetricOrchestrator([
 *   myElbowAngleCalculator,
 *   myKneeFlexionCalculator,
 * ]);
 *
 * // Analyze a shot
 * const analysis = orchestrator.analyzeShot(
 *   0,
 *   poseLandmarks,
 *   frameRange,
 *   phases,
 *   config
 * );
 * ```
 *
 * @see Feature 5.0 - Metric Extraction
 */
// Helper functions
export { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./types";
// Orchestrator
export { MetricOrchestrator, } from "./metric-orchestrator";
// Shooting Arm Calculators
export { ShootingElbowFlareCalculator, ShootingElbowAngleCalculator, MaxArmExtensionCalculator, WristSnapAngleCalculator, FollowThroughHoldCalculator, createShootingArmCalculators, } from "./shooting-arm";
// Guide Arm Calculators
export { GuideElbowFlareCalculator, GuideHandPositionCalculator, GuideHandReleaseCalculator, createGuideArmCalculators, } from "./guide-arm";
// Ball Position Calculators
export { inferBallCenter, areHandsTogether, BallDipCalculator, BallPathCalculator, SetPointHeightCalculator, SetPointDurationCalculator, ReleasePointCalculator, ReleaseAngleCalculator, BallBehindHeadCalculator, createBallMetricCalculators, } from "./ball";
// Lower Body Calculators
export { HipDropCalculator, KneeFlexionCalculator, LegExtensionStartCalculator, createLowerBodyCalculators, } from "./lower-body";
// Posture & Alignment Calculators
export { BackPostureCalculator, HeadTiltCalculator, ShoulderAlignmentCalculator, HandCupVsHingeCalculator, createPostureCalculators, } from "./posture";
// Timing & Synchronization Calculators
export { BallRiseStartCalculator, LegRiseStartCalculator, BallLegSyncCalculator, ReleaseStartCalculator, TotalShotDurationCalculator, createTimingCalculators, } from "./timing";
//# sourceMappingURL=index.js.map