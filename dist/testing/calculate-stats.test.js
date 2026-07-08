import { describe, it, expect } from 'vitest';
import { calculateStats, calculateAvgError, calculateMaxError, calculatePassRate, KEYFRAME_ORDER } from './calculate-stats';
describe('calculate-stats', () => {
    describe('calculateStats', () => {
        it('handles empty results', () => {
            const data = { results: [] };
            const stats = calculateStats(data);
            expect(stats.overallStats.totalShots).toBe(0);
            expect(stats.overallStats.passedShots).toBe(0);
            expect(stats.overallStats.excludedShots).toBe(0);
            expect(stats.overallStats.totalLabeledKeyframes).toBe(0);
            expect(stats.overallStats.passedKeyframes).toBe(0);
        });
        it('counts total shots correctly', () => {
            const data = {
                results: [
                    {
                        video: 'test1.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [],
                                keyframeValidationExcluded: false
                            },
                            {
                                shotNumber: 2,
                                keyframes: [],
                                keyframeValidationExcluded: false
                            }
                        ]
                    },
                    {
                        video: 'test2.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.overallStats.totalShots).toBe(3);
        });
        it('counts excluded shots correctly', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'legs_start_bending',
                                        labeled: 10,
                                        detected: 12,
                                        diff: 2,
                                        passed: true
                                    }
                                ],
                                keyframeValidationExcluded: true
                            },
                            {
                                shotNumber: 2,
                                keyframes: [
                                    {
                                        keyframeId: 'legs_start_bending',
                                        labeled: 50,
                                        detected: 52,
                                        diff: 2,
                                        passed: true
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.overallStats.totalShots).toBe(2);
            expect(stats.overallStats.excludedShots).toBe(1);
            const legsStats = stats.keyframeStats['legs_start_bending'];
            expect(legsStats).toBeDefined();
            expect(legsStats.excluded).toBe(1);
            expect(legsStats.passed).toBe(1);
        });
        it('counts passed keyframes correctly', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'legs_start_bending',
                                        labeled: 10,
                                        detected: 12,
                                        diff: 2,
                                        passed: true
                                    },
                                    {
                                        keyframeId: 'leg_bend_low_point',
                                        labeled: 20,
                                        detected: 22,
                                        diff: 2,
                                        passed: true
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.overallStats.totalLabeledKeyframes).toBe(2);
            expect(stats.overallStats.passedKeyframes).toBe(2);
            expect(stats.keyframeStats['legs_start_bending'].passed).toBe(1);
            expect(stats.keyframeStats['leg_bend_low_point'].passed).toBe(1);
        });
        it('counts failed keyframes correctly', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'fail',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'legs_start_bending',
                                        labeled: 10,
                                        detected: 25,
                                        diff: 15,
                                        passed: false
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.keyframeStats['legs_start_bending'].failed).toBe(1);
            expect(stats.keyframeStats['legs_start_bending'].passed).toBe(0);
            expect(stats.overallStats.passedKeyframes).toBe(0);
        });
        it('counts not detected keyframes correctly', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'fail',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'feet_leave_ground',
                                        labeled: 50,
                                        detected: null,
                                        diff: null,
                                        passed: false
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.keyframeStats['feet_leave_ground'].notDetected).toBe(1);
            expect(stats.keyframeStats['feet_leave_ground'].passed).toBe(0);
        });
        it('skips unlabeled keyframes in count', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'release',
                                        labeled: null,
                                        detected: 100,
                                        diff: null,
                                        passed: true
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.overallStats.totalLabeledKeyframes).toBe(0);
            expect(stats.keyframeStats['release'].passed).toBe(0);
        });
        it('records diffs for error calculation', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'set_point',
                                        labeled: 50,
                                        detected: 55,
                                        diff: 5,
                                        passed: true
                                    },
                                    {
                                        keyframeId: 'set_point',
                                        labeled: 150,
                                        detected: 147,
                                        diff: -3,
                                        passed: true
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.keyframeStats['set_point'].diffs).toContain(5);
            expect(stats.keyframeStats['set_point'].diffs).toContain(3); // abs value
        });
        it('marks shot as passed only if all keyframes pass', () => {
            const data = {
                results: [
                    {
                        video: 'test.mp4',
                        status: 'pass',
                        shots: [
                            {
                                shotNumber: 1,
                                keyframes: [
                                    {
                                        keyframeId: 'legs_start_bending',
                                        labeled: 10,
                                        detected: 12,
                                        diff: 2,
                                        passed: true
                                    },
                                    {
                                        keyframeId: 'leg_bend_low_point',
                                        labeled: 20,
                                        detected: 35,
                                        diff: 15,
                                        passed: false
                                    }
                                ],
                                keyframeValidationExcluded: false
                            }
                        ]
                    }
                ]
            };
            const stats = calculateStats(data);
            expect(stats.overallStats.passedShots).toBe(0);
        });
        it('initializes all keyframe types in KEYFRAME_ORDER', () => {
            const data = { results: [] };
            const stats = calculateStats(data);
            KEYFRAME_ORDER.forEach((kf) => {
                const keyframeStats = stats.keyframeStats[kf];
                expect(keyframeStats).toBeDefined();
                expect(keyframeStats.passed).toBe(0);
                expect(keyframeStats.failed).toBe(0);
                expect(keyframeStats.notDetected).toBe(0);
                expect(keyframeStats.excluded).toBe(0);
                expect(keyframeStats.diffs).toEqual([]);
            });
        });
    });
    describe('calculateAvgError', () => {
        it('returns null for empty diffs', () => {
            const stats = {
                diffs: [],
                passed: 0,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculateAvgError(stats)).toBeNull();
        });
        it('calculates average correctly', () => {
            const stats = {
                diffs: [2, 4, 6],
                passed: 3,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculateAvgError(stats)).toBe(4);
        });
        it('handles single value', () => {
            const stats = {
                diffs: [7],
                passed: 1,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculateAvgError(stats)).toBe(7);
        });
    });
    describe('calculateMaxError', () => {
        it('returns null for empty diffs', () => {
            const stats = {
                diffs: [],
                passed: 0,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculateMaxError(stats)).toBeNull();
        });
        it('finds maximum correctly', () => {
            const stats = {
                diffs: [2, 8, 4],
                passed: 3,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculateMaxError(stats)).toBe(8);
        });
    });
    describe('calculatePassRate', () => {
        it('returns null for no samples', () => {
            const stats = {
                diffs: [],
                passed: 0,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculatePassRate(stats)).toBeNull();
        });
        it('calculates 100% pass rate', () => {
            const stats = {
                diffs: [2, 3],
                passed: 5,
                failed: 0,
                notDetected: 0,
                excluded: 0
            };
            expect(calculatePassRate(stats)).toBe(100);
        });
        it('calculates partial pass rate', () => {
            const stats = {
                diffs: [2, 12],
                passed: 3,
                failed: 1,
                notDetected: 1,
                excluded: 0
            };
            // 3 / (3 + 1 + 1) = 3/5 = 60%
            expect(calculatePassRate(stats)).toBe(60);
        });
        it('excludes excluded count from rate calculation', () => {
            const stats = {
                diffs: [2],
                passed: 1,
                failed: 0,
                notDetected: 0,
                excluded: 5
            };
            // excluded doesn't count in total for pass rate
            expect(calculatePassRate(stats)).toBe(100);
        });
    });
    describe('KEYFRAME_ORDER', () => {
        it('contains all 10 keyframes', () => {
            expect(KEYFRAME_ORDER.length).toBe(10);
        });
        it('has correct order', () => {
            expect(KEYFRAME_ORDER[0]).toBe('legs_start_bending');
            expect(KEYFRAME_ORDER[9]).toBe('feet_land');
        });
    });
});
//# sourceMappingURL=calculate-stats.test.js.map