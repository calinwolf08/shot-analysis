/**
 * v2 metrics module — Sequencing / Structure measurements for the scoring
 * overhaul. Structure metrics (Step 3) and the single extraction entry point
 * (Step 4) land here as they're built.
 *
 * @see docs/implementation-plan-metrics-overhaul.md
 */

export * from "./types";
export * from "./normalize";
export * from "./sequencing";
export * from "./structure";
export * from "./extract";
export { derivePhaseRanges } from "./structure/phases";
export type { PhaseRanges, FrameRange } from "./structure/phases";
export type { ShootingHand } from "./structure/geometry";
