/**
 * Unit tests for smoothing utility functions.
 * Following TDD: tests are written BEFORE implementation.
 */
import { describe, it, expect } from "vitest";
import { movingAverage, movingAveragePoint3D, smoothLandmarkSequence, } from "./smoothing";
describe("movingAverage", () => {
    describe("basic smoothing", () => {
        it("returns same values for window size 1", () => {
            const values = [1, 2, 3, 4, 5];
            const result = movingAverage(values, 1);
            expect(result).toEqual([1, 2, 3, 4, 5]);
        });
        it("calculates correct moving average with window size 3", () => {
            const values = [1, 2, 3, 4, 5];
            const result = movingAverage(values, 3);
            // For window 3: average of [current, previous, previous-1]
            // Index 0: only has 1 value -> 1
            // Index 1: has 2 values -> (1+2)/2 = 1.5
            // Index 2: has 3 values -> (1+2+3)/3 = 2
            // Index 3: (2+3+4)/3 = 3
            // Index 4: (3+4+5)/3 = 4
            expect(result[0]).toBeCloseTo(1, 5);
            expect(result[1]).toBeCloseTo(1.5, 5);
            expect(result[2]).toBeCloseTo(2, 5);
            expect(result[3]).toBeCloseTo(3, 5);
            expect(result[4]).toBeCloseTo(4, 5);
        });
        it("smooths out noise in data", () => {
            // Simulating noisy data with a spike
            const values = [10, 10, 100, 10, 10];
            const result = movingAverage(values, 3);
            // The spike at index 2 should be smoothed out
            expect(result[2]).toBeCloseTo(40, 5); // (10+10+100)/3
            expect(result[3]).toBeCloseTo(40, 5); // (10+100+10)/3
            expect(result[4]).toBeCloseTo(40, 5); // (100+10+10)/3
        });
        it("handles window size 5", () => {
            const values = [1, 2, 3, 4, 5, 6, 7];
            const result = movingAverage(values, 5);
            // First few have partial windows
            expect(result[0]).toBeCloseTo(1, 5); // only 1
            expect(result[1]).toBeCloseTo(1.5, 5); // (1+2)/2
            expect(result[2]).toBeCloseTo(2, 5); // (1+2+3)/3
            expect(result[3]).toBeCloseTo(2.5, 5); // (1+2+3+4)/4
            expect(result[4]).toBeCloseTo(3, 5); // (1+2+3+4+5)/5
            expect(result[5]).toBeCloseTo(4, 5); // (2+3+4+5+6)/5
            expect(result[6]).toBeCloseTo(5, 5); // (3+4+5+6+7)/5
        });
    });
    describe("edge cases", () => {
        it("returns empty array for empty input", () => {
            const result = movingAverage([], 3);
            expect(result).toEqual([]);
        });
        it("handles single value", () => {
            const result = movingAverage([5], 3);
            expect(result).toEqual([5]);
        });
        it("handles window larger than array", () => {
            const values = [1, 2, 3];
            const result = movingAverage(values, 10);
            // Should still work with partial windows
            expect(result[0]).toBeCloseTo(1, 5);
            expect(result[1]).toBeCloseTo(1.5, 5);
            expect(result[2]).toBeCloseTo(2, 5);
        });
        it("throws error for window size less than 1", () => {
            expect(() => movingAverage([1, 2, 3], 0)).toThrow("Window size must be at least 1");
        });
        it("throws error for negative window size", () => {
            expect(() => movingAverage([1, 2, 3], -1)).toThrow("Window size must be at least 1");
        });
        it("handles negative values", () => {
            const values = [-3, -2, -1, 0, 1, 2, 3];
            const result = movingAverage(values, 3);
            expect(result[3]).toBeCloseTo(-1, 5); // (-2 + -1 + 0)/3
            expect(result[4]).toBeCloseTo(0, 5); // (-1 + 0 + 1)/3
        });
        it("handles decimal values", () => {
            const values = [0.1, 0.2, 0.3, 0.4, 0.5];
            const result = movingAverage(values, 3);
            expect(result[2]).toBeCloseTo(0.2, 5);
            expect(result[4]).toBeCloseTo(0.4, 5);
        });
    });
});
describe("movingAveragePoint3D", () => {
    describe("basic smoothing", () => {
        it("returns same points for window size 1", () => {
            const points = [
                { x: 1, y: 2, z: 3 },
                { x: 4, y: 5, z: 6 },
            ];
            const result = movingAveragePoint3D(points, 1);
            expect(result).toEqual(points);
        });
        it("smooths each coordinate independently", () => {
            const points = [
                { x: 1, y: 10, z: 100 },
                { x: 2, y: 20, z: 200 },
                { x: 3, y: 30, z: 300 },
            ];
            const result = movingAveragePoint3D(points, 3);
            // Index 2: full window of 3
            expect(result[2].x).toBeCloseTo(2, 5); // (1+2+3)/3
            expect(result[2].y).toBeCloseTo(20, 5); // (10+20+30)/3
            expect(result[2].z).toBeCloseTo(200, 5); // (100+200+300)/3
        });
        it("smooths noisy point sequence", () => {
            const points = [
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                { x: 10, y: 10, z: 10 }, // spike
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
            ];
            const result = movingAveragePoint3D(points, 3);
            // The spike should be smoothed
            expect(result[2].x).toBeCloseTo(10 / 3, 5);
            expect(result[2].y).toBeCloseTo(10 / 3, 5);
            expect(result[2].z).toBeCloseTo(10 / 3, 5);
        });
    });
    describe("edge cases", () => {
        it("returns empty array for empty input", () => {
            const result = movingAveragePoint3D([], 3);
            expect(result).toEqual([]);
        });
        it("handles single point", () => {
            const points = [{ x: 1, y: 2, z: 3 }];
            const result = movingAveragePoint3D(points, 3);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ x: 1, y: 2, z: 3 });
        });
        it("throws error for window size less than 1", () => {
            const points = [{ x: 1, y: 2, z: 3 }];
            expect(() => movingAveragePoint3D(points, 0)).toThrow("Window size must be at least 1");
        });
        it("handles negative coordinates", () => {
            const points = [
                { x: -3, y: -2, z: -1 },
                { x: 0, y: 0, z: 0 },
                { x: 3, y: 2, z: 1 },
            ];
            const result = movingAveragePoint3D(points, 3);
            expect(result[2].x).toBeCloseTo(0, 5);
            expect(result[2].y).toBeCloseTo(0, 5);
            expect(result[2].z).toBeCloseTo(0, 5);
        });
    });
    describe("preserves Point3D structure", () => {
        it("returns readonly Point3D objects", () => {
            const points = [
                { x: 1, y: 2, z: 3 },
                { x: 4, y: 5, z: 6 },
            ];
            const result = movingAveragePoint3D(points, 2);
            // Should have x, y, z properties
            expect(result[0]).toHaveProperty("x");
            expect(result[0]).toHaveProperty("y");
            expect(result[0]).toHaveProperty("z");
        });
    });
});
describe("smoothLandmarkSequence", () => {
    describe("basic smoothing", () => {
        it("smooths a sequence of Point3D landmarks", () => {
            const sequence = [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 1, z: 1 },
                { x: 2, y: 2, z: 2 },
                { x: 3, y: 3, z: 3 },
                { x: 4, y: 4, z: 4 },
            ];
            const result = smoothLandmarkSequence(sequence, 3);
            expect(result).toHaveLength(5);
            // Values should be smoothed
            expect(result[2].x).toBeCloseTo(1, 5);
            expect(result[3].x).toBeCloseTo(2, 5);
            expect(result[4].x).toBeCloseTo(3, 5);
        });
        it("uses default window size when not specified", () => {
            const sequence = [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 1, z: 1 },
                { x: 2, y: 2, z: 2 },
                { x: 3, y: 3, z: 3 },
                { x: 4, y: 4, z: 4 },
            ];
            // Should not throw and return smoothed values
            const result = smoothLandmarkSequence(sequence);
            expect(result).toHaveLength(5);
        });
    });
    describe("edge cases", () => {
        it("returns empty array for empty input", () => {
            const result = smoothLandmarkSequence([]);
            expect(result).toEqual([]);
        });
        it("handles single point", () => {
            const sequence = [{ x: 1, y: 2, z: 3 }];
            const result = smoothLandmarkSequence(sequence, 3);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ x: 1, y: 2, z: 3 });
        });
    });
    describe("noise reduction", () => {
        it("reduces noise from jittery landmark detection", () => {
            // Simulating jittery landmark detection (small random variations)
            const sequence = [
                { x: 0.5, y: 0.5, z: 0.1 },
                { x: 0.52, y: 0.48, z: 0.11 }, // slight jitter
                { x: 0.51, y: 0.51, z: 0.09 }, // slight jitter
                { x: 0.5, y: 0.5, z: 0.1 },
                { x: 0.49, y: 0.52, z: 0.11 }, // slight jitter
            ];
            const result = smoothLandmarkSequence(sequence, 3);
            // Smoothed values should be closer to the average
            // The variations should be reduced
            expect(result[2].x).toBeGreaterThan(0.49);
            expect(result[2].x).toBeLessThan(0.53);
            expect(result[2].y).toBeGreaterThan(0.48);
            expect(result[2].y).toBeLessThan(0.52);
        });
        it("preserves overall trend while reducing noise", () => {
            // Linear trend with noise
            const sequence = [
                { x: 0, y: 0, z: 0 },
                { x: 1.5, y: 1.5, z: 1.5 }, // above trend
                { x: 2, y: 2, z: 2 },
                { x: 2.5, y: 2.5, z: 2.5 }, // below trend (relative to next)
                { x: 4, y: 4, z: 4 },
            ];
            const result = smoothLandmarkSequence(sequence, 3);
            // The trend should still be upward
            expect(result[4].x).toBeGreaterThan(result[0].x);
            expect(result[4].y).toBeGreaterThan(result[0].y);
        });
    });
});
//# sourceMappingURL=smoothing.test.js.map