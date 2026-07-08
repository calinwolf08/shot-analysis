import * as fs from 'fs';
export const KEYFRAME_ORDER = [
    'legs_start_bending',
    'leg_bend_low_point',
    'ball_low_point',
    'legs_start_extending',
    'ball_starts_upward',
    'set_point',
    'release',
    'arms_fully_extended',
    'feet_leave_ground',
    'feet_land'
];
/**
 * Calculates per-keyframe and overall statistics from test results.
 */
export function calculateStats(data) {
    // Initialize stats for each keyframe
    const keyframeStats = {};
    KEYFRAME_ORDER.forEach((kf) => {
        keyframeStats[kf] = {
            diffs: [],
            passed: 0,
            failed: 0,
            notDetected: 0,
            excluded: 0
        };
    });
    // Count totals
    let totalShots = 0;
    let passedShots = 0;
    let excludedShots = 0;
    let totalLabeledKeyframes = 0;
    let passedKeyframes = 0;
    // Process each result
    data.results.forEach((video) => {
        video.shots.forEach((shot) => {
            totalShots++;
            if (shot.keyframeValidationExcluded) {
                excludedShots++;
                shot.keyframes.forEach((kf) => {
                    const stats = keyframeStats[kf.keyframeId];
                    if (stats) {
                        stats.excluded++;
                    }
                });
                return;
            }
            let shotPassed = true;
            shot.keyframes.forEach((kf) => {
                const stats = keyframeStats[kf.keyframeId];
                if (!stats)
                    return;
                if (kf.labeled !== null && kf.labeled !== undefined) {
                    totalLabeledKeyframes++;
                    if (kf.detected === null) {
                        stats.notDetected++;
                        shotPassed = false;
                    }
                    else if (kf.passed) {
                        stats.passed++;
                        stats.diffs.push(Math.abs(kf.diff));
                        passedKeyframes++;
                    }
                    else {
                        stats.failed++;
                        stats.diffs.push(Math.abs(kf.diff));
                        shotPassed = false;
                    }
                }
            });
            if (shotPassed)
                passedShots++;
        });
    });
    return {
        keyframeStats,
        overallStats: {
            totalShots,
            passedShots,
            excludedShots,
            totalLabeledKeyframes,
            passedKeyframes
        }
    };
}
/**
 * Calculates average error for a keyframe.
 */
export function calculateAvgError(stats) {
    if (stats.diffs.length === 0)
        return null;
    return stats.diffs.reduce((a, b) => a + b, 0) / stats.diffs.length;
}
/**
 * Calculates max error for a keyframe.
 */
export function calculateMaxError(stats) {
    if (stats.diffs.length === 0)
        return null;
    return Math.max(...stats.diffs);
}
/**
 * Calculates pass rate for a keyframe.
 */
export function calculatePassRate(stats) {
    const total = stats.passed + stats.failed + stats.notDetected;
    if (total === 0)
        return null;
    return (stats.passed / total) * 100;
}
/**
 * Formats and prints statistics to console.
 */
export function printStats(calculatedStats) {
    const { keyframeStats, overallStats } = calculatedStats;
    console.log('# Keyframe Detection Statistics (8 Videos, ' +
        overallStats.totalShots +
        ' shots)\n');
    console.log('| Keyframe | Avg Error | Max Error | Pass Count | Fail Count | Not Detected | Excluded | Pass Rate |');
    console.log('|----------|-----------|-----------|------------|------------|--------------|----------|-----------|');
    KEYFRAME_ORDER.forEach((kf) => {
        const stats = keyframeStats[kf];
        if (!stats)
            return;
        const avgError = calculateAvgError(stats);
        const maxError = calculateMaxError(stats);
        const passRate = calculatePassRate(stats);
        console.log('| ' +
            kf +
            ' | ' +
            (avgError !== null ? avgError.toFixed(2) : 'N/A') +
            ' | ' +
            (maxError !== null ? maxError : 'N/A') +
            ' | ' +
            stats.passed +
            ' | ' +
            stats.failed +
            ' | ' +
            stats.notDetected +
            ' | ' +
            stats.excluded +
            ' | ' +
            (passRate !== null ? passRate.toFixed(1) + '%' : 'N/A') +
            ' |');
    });
    console.log('\n## Overall Statistics\n');
    console.log('- **Total Shots Tested**: ' + overallStats.totalShots);
    console.log('- **Shots Excluded (behind views)**: ' + overallStats.excludedShots);
    console.log('- **Shots Validated**: ' +
        (overallStats.totalShots - overallStats.excludedShots));
    console.log('- **Shots Passing**: ' +
        overallStats.passedShots +
        '/' +
        (overallStats.totalShots - overallStats.excludedShots) +
        ' (' +
        ((overallStats.passedShots /
            (overallStats.totalShots - overallStats.excludedShots)) *
            100).toFixed(1) +
        '%)');
    console.log('- **Total Labeled Keyframes**: ' + overallStats.totalLabeledKeyframes);
    console.log('- **Keyframes Passing**: ' +
        overallStats.passedKeyframes +
        '/' +
        overallStats.totalLabeledKeyframes +
        ' (' +
        ((overallStats.passedKeyframes / overallStats.totalLabeledKeyframes) *
            100).toFixed(1) +
        '%)');
    console.log('- **Frame Tolerance**: ±8 frames');
}
// CLI entry point - only runs when executed directly via npx tsx
import { fileURLToPath } from 'url';
const isMain = typeof import.meta?.url !== 'undefined' &&
    process.argv[1] &&
    fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    const data = JSON.parse(fs.readFileSync('test-data/test-results.json', 'utf8'));
    const stats = calculateStats(data);
    printStats(stats);
}
//# sourceMappingURL=calculate-stats.js.map