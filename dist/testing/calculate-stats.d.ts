export interface KeyframeResult {
    keyframeId: string;
    labeled: number | null;
    detected: number | null;
    diff: number | null;
    passed: boolean;
}
export interface Shot {
    shotNumber: number;
    keyframes: KeyframeResult[];
    keyframeValidationExcluded: boolean;
}
export interface VideoResult {
    video: string;
    status: string;
    shots: Shot[];
}
export interface TestResults {
    results: VideoResult[];
}
export interface KeyframeStats {
    diffs: number[];
    passed: number;
    failed: number;
    notDetected: number;
    excluded: number;
}
export interface OverallStats {
    totalShots: number;
    passedShots: number;
    excludedShots: number;
    totalLabeledKeyframes: number;
    passedKeyframes: number;
}
export interface CalculatedStats {
    keyframeStats: Record<string, KeyframeStats>;
    overallStats: OverallStats;
}
export declare const KEYFRAME_ORDER: readonly ["legs_start_bending", "leg_bend_low_point", "ball_low_point", "legs_start_extending", "ball_starts_upward", "set_point", "release", "arms_fully_extended", "feet_leave_ground", "feet_land"];
/**
 * Calculates per-keyframe and overall statistics from test results.
 */
export declare function calculateStats(data: TestResults): CalculatedStats;
/**
 * Calculates average error for a keyframe.
 */
export declare function calculateAvgError(stats: KeyframeStats): number | null;
/**
 * Calculates max error for a keyframe.
 */
export declare function calculateMaxError(stats: KeyframeStats): number | null;
/**
 * Calculates pass rate for a keyframe.
 */
export declare function calculatePassRate(stats: KeyframeStats): number | null;
/**
 * Formats and prints statistics to console.
 */
export declare function printStats(calculatedStats: CalculatedStats): void;
//# sourceMappingURL=calculate-stats.d.ts.map