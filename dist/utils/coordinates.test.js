/**
 * Unit tests for coordinate normalization utility functions.
 * Following TDD: tests are written BEFORE implementation.
 */
import { describe, it, expect } from "vitest";
import { normalizeToBodyScale, calculateRelativePosition } from "./coordinates";
describe("normalizeToBodyScale", () => {
    describe("basic normalization", () => {
        it("normalizes distance using shoulder width as reference", () => {
            // If shoulder width is 0.4 and distance is 0.4, ratio should be 1.0
            const distance = 0.4;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(1.0, 5);
        });
        it("normalizes distance to half when distance is half of shoulder width", () => {
            const distance = 0.2;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(0.5, 5);
        });
        it("normalizes distance to double when distance is twice shoulder width", () => {
            const distance = 0.8;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(2.0, 5);
        });
        it("handles decimal shoulder widths correctly", () => {
            const distance = 0.15;
            const shoulderWidth = 0.3;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(0.5, 5);
        });
    });
    describe("edge cases", () => {
        it("throws error when shoulder width is zero", () => {
            const distance = 0.4;
            const shoulderWidth = 0;
            expect(() => normalizeToBodyScale(distance, shoulderWidth)).toThrow("Shoulder width must be greater than zero");
        });
        it("throws error when shoulder width is negative", () => {
            const distance = 0.4;
            const shoulderWidth = -0.3;
            expect(() => normalizeToBodyScale(distance, shoulderWidth)).toThrow("Shoulder width must be greater than zero");
        });
        it("returns 0 when distance is 0", () => {
            const distance = 0;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBe(0);
        });
        it("handles negative distances (returns positive ratio)", () => {
            // Distance should always be positive in practice, but function should handle it
            const distance = -0.4;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(-1.0, 5);
        });
        it("handles very small shoulder widths", () => {
            const distance = 0.0001;
            const shoulderWidth = 0.0001;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(1.0, 5);
        });
        it("handles very large distances", () => {
            const distance = 100;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(distance, shoulderWidth);
            expect(normalized).toBeCloseTo(250, 5);
        });
    });
    describe("biomechanics context", () => {
        it("normalizes typical arm reach relative to shoulder width", () => {
            // Typical arm reach might be ~2x shoulder width
            const armReach = 0.8;
            const shoulderWidth = 0.4;
            const normalized = normalizeToBodyScale(armReach, shoulderWidth);
            expect(normalized).toBeCloseTo(2.0, 5);
        });
    });
});
describe("calculateRelativePosition", () => {
    describe("basic relative position", () => {
        it("calculates position relative to reference point at origin", () => {
            const point = { x: 1, y: 2, z: 3 };
            const reference = { x: 0, y: 0, z: 0 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(1);
            expect(relative.y).toBe(2);
            expect(relative.z).toBe(3);
        });
        it("calculates position relative to non-origin reference", () => {
            const point = { x: 5, y: 7, z: 9 };
            const reference = { x: 2, y: 3, z: 4 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(3);
            expect(relative.y).toBe(4);
            expect(relative.z).toBe(5);
        });
        it("returns zero vector when point equals reference", () => {
            const point = { x: 5, y: 5, z: 5 };
            const reference = { x: 5, y: 5, z: 5 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(0);
            expect(relative.y).toBe(0);
            expect(relative.z).toBe(0);
        });
    });
    describe("negative coordinates", () => {
        it("handles point with negative coordinates", () => {
            const point = { x: -1, y: -2, z: -3 };
            const reference = { x: 0, y: 0, z: 0 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(-1);
            expect(relative.y).toBe(-2);
            expect(relative.z).toBe(-3);
        });
        it("handles reference with negative coordinates", () => {
            const point = { x: 1, y: 2, z: 3 };
            const reference = { x: -1, y: -2, z: -3 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(2);
            expect(relative.y).toBe(4);
            expect(relative.z).toBe(6);
        });
        it("handles both with negative coordinates", () => {
            const point = { x: -3, y: -5, z: -7 };
            const reference = { x: -1, y: -2, z: -3 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(-2);
            expect(relative.y).toBe(-3);
            expect(relative.z).toBe(-4);
        });
    });
    describe("edge cases", () => {
        it("handles very small coordinate differences", () => {
            const point = { x: 0.0001, y: 0.0002, z: 0.0003 };
            const reference = { x: 0, y: 0, z: 0 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBeCloseTo(0.0001, 8);
            expect(relative.y).toBeCloseTo(0.0002, 8);
            expect(relative.z).toBeCloseTo(0.0003, 8);
        });
        it("handles very large coordinates", () => {
            const point = { x: 1000001, y: 1000002, z: 1000003 };
            const reference = { x: 1000000, y: 1000000, z: 1000000 };
            const relative = calculateRelativePosition(point, reference);
            expect(relative.x).toBe(1);
            expect(relative.y).toBe(2);
            expect(relative.z).toBe(3);
        });
    });
    describe("biomechanics context", () => {
        it("calculates wrist position relative to head", () => {
            // Simulating wrist position relative to head (reference)
            const wrist = { x: 0.6, y: 0.3, z: 0.1 };
            const head = { x: 0.5, y: 0.8, z: 0 };
            const relative = calculateRelativePosition(wrist, head);
            expect(relative.x).toBeCloseTo(0.1, 5); // slightly right of head
            expect(relative.y).toBeCloseTo(-0.5, 5); // below head
            expect(relative.z).toBeCloseTo(0.1, 5); // slightly forward
        });
        it("calculates elbow position relative to shoulder", () => {
            const elbow = { x: 0.3, y: 0.5, z: 0.1 };
            const shoulder = { x: 0.2, y: 0.6, z: 0 };
            const relative = calculateRelativePosition(elbow, shoulder);
            expect(relative.x).toBeCloseTo(0.1, 5);
            expect(relative.y).toBeCloseTo(-0.1, 5);
            expect(relative.z).toBeCloseTo(0.1, 5);
        });
    });
});
//# sourceMappingURL=coordinates.test.js.map