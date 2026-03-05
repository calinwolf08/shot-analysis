/**
 * Unit tests for geometry utility functions.
 * Following TDD: tests are written BEFORE implementation.
 */

import { describe, it, expect } from "vitest";
import {
  calculateAngle,
  calculateDistance,
  calculateDistance2D,
} from "./geometry";
import type { Point3D, Point2D } from "../types";

describe("calculateAngle", () => {
  describe("basic angle calculations", () => {
    it("calculates a right angle (90 degrees)", () => {
      // Points forming a right angle: vertex at origin
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 1, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it("calculates a straight angle (180 degrees) for collinear points", () => {
      // Collinear points should return 180 degrees
      const a: Point3D = { x: -1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 1, y: 0, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(180, 1);
    });

    it("calculates a 45 degree angle", () => {
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 1, y: 1, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(45, 1);
    });

    it("calculates a 60 degree angle", () => {
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0.5, y: Math.sqrt(3) / 2, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(60, 1);
    });

    it("calculates a 120 degree angle", () => {
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: -0.5, y: Math.sqrt(3) / 2, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(120, 1);
    });
  });

  describe("3D angle calculations", () => {
    it("calculates angle with z-axis involvement", () => {
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 0, z: 1 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it("calculates angle in 3D space", () => {
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 1, z: 1 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(90, 1);
    });
  });

  describe("edge cases", () => {
    it("returns 0 when point a and vertex are identical", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 1, y: 0, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBe(0);
    });

    it("returns 0 when point c and vertex are identical", () => {
      const a: Point3D = { x: 1, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 0, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBe(0);
    });

    it("returns 0 when all three points are identical", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 0, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBe(0);
    });

    it("handles negative coordinates correctly", () => {
      const a: Point3D = { x: -1, y: -1, z: 0 };
      const vertex: Point3D = { x: -2, y: -2, z: 0 };
      const c: Point3D = { x: -3, y: -1, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it("handles very small distances", () => {
      const a: Point3D = { x: 0.0001, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 0.0001, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(90, 1);
    });

    it("handles very large coordinates", () => {
      const a: Point3D = { x: 1000000, y: 0, z: 0 };
      const vertex: Point3D = { x: 0, y: 0, z: 0 };
      const c: Point3D = { x: 0, y: 1000000, z: 0 };

      const angle = calculateAngle(a, vertex, c);
      expect(angle).toBeCloseTo(90, 1);
    });
  });

  describe("biomechanics-relevant angles", () => {
    it("calculates elbow angle correctly (shoulder-elbow-wrist)", () => {
      // Simulating an arm with bent elbow
      const shoulder: Point3D = { x: 0, y: 0, z: 0 };
      const elbow: Point3D = { x: 1, y: 0, z: 0 };
      const wrist: Point3D = { x: 1, y: -1, z: 0 };

      const angle = calculateAngle(shoulder, elbow, wrist);
      expect(angle).toBeCloseTo(90, 1);
    });

    it("calculates fully extended arm angle (close to 180)", () => {
      const shoulder: Point3D = { x: 0, y: 0, z: 0 };
      const elbow: Point3D = { x: 1, y: 0, z: 0 };
      const wrist: Point3D = { x: 2, y: 0, z: 0 };

      const angle = calculateAngle(shoulder, elbow, wrist);
      expect(angle).toBeCloseTo(180, 1);
    });
  });
});

describe("calculateDistance", () => {
  describe("basic distance calculations", () => {
    it("calculates distance between two points on x-axis", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 3, y: 0, z: 0 };

      expect(calculateDistance(a, b)).toBeCloseTo(3, 5);
    });

    it("calculates distance between two points on y-axis", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 0, y: 4, z: 0 };

      expect(calculateDistance(a, b)).toBeCloseTo(4, 5);
    });

    it("calculates distance between two points on z-axis", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 0, y: 0, z: 5 };

      expect(calculateDistance(a, b)).toBeCloseTo(5, 5);
    });

    it("calculates 3-4-5 triangle hypotenuse in 2D", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 3, y: 4, z: 0 };

      expect(calculateDistance(a, b)).toBeCloseTo(5, 5);
    });

    it("calculates distance in full 3D space", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 1, y: 2, z: 2 };

      // sqrt(1 + 4 + 4) = sqrt(9) = 3
      expect(calculateDistance(a, b)).toBeCloseTo(3, 5);
    });
  });

  describe("edge cases", () => {
    it("returns 0 for identical points", () => {
      const a: Point3D = { x: 5, y: 10, z: 15 };
      const b: Point3D = { x: 5, y: 10, z: 15 };

      expect(calculateDistance(a, b)).toBe(0);
    });

    it("handles negative coordinates correctly", () => {
      const a: Point3D = { x: -1, y: -2, z: -3 };
      const b: Point3D = { x: 2, y: 2, z: 0 };

      // sqrt(9 + 16 + 9) = sqrt(34)
      expect(calculateDistance(a, b)).toBeCloseTo(Math.sqrt(34), 5);
    });

    it("handles mixed positive and negative coordinates", () => {
      const a: Point3D = { x: -3, y: 0, z: 0 };
      const b: Point3D = { x: 3, y: 0, z: 0 };

      expect(calculateDistance(a, b)).toBeCloseTo(6, 5);
    });

    it("handles very small distances", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 0.0001, y: 0.0001, z: 0.0001 };

      expect(calculateDistance(a, b)).toBeCloseTo(Math.sqrt(3) * 0.0001, 8);
    });

    it("handles very large distances", () => {
      const a: Point3D = { x: 0, y: 0, z: 0 };
      const b: Point3D = { x: 1000000, y: 1000000, z: 1000000 };

      expect(calculateDistance(a, b)).toBeCloseTo(Math.sqrt(3) * 1000000, 0);
    });

    it("is symmetric (distance a to b equals distance b to a)", () => {
      const a: Point3D = { x: 1, y: 2, z: 3 };
      const b: Point3D = { x: 4, y: 6, z: 8 };

      expect(calculateDistance(a, b)).toBe(calculateDistance(b, a));
    });
  });
});

describe("calculateDistance2D", () => {
  describe("basic distance calculations", () => {
    it("calculates distance between two points on x-axis", () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 3, y: 0 };

      expect(calculateDistance2D(a, b)).toBeCloseTo(3, 5);
    });

    it("calculates distance between two points on y-axis", () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 0, y: 4 };

      expect(calculateDistance2D(a, b)).toBeCloseTo(4, 5);
    });

    it("calculates 3-4-5 triangle hypotenuse", () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 3, y: 4 };

      expect(calculateDistance2D(a, b)).toBeCloseTo(5, 5);
    });

    it("calculates diagonal distance", () => {
      const a: Point2D = { x: 0, y: 0 };
      const b: Point2D = { x: 1, y: 1 };

      expect(calculateDistance2D(a, b)).toBeCloseTo(Math.sqrt(2), 5);
    });
  });

  describe("edge cases", () => {
    it("returns 0 for identical points", () => {
      const a: Point2D = { x: 5, y: 10 };
      const b: Point2D = { x: 5, y: 10 };

      expect(calculateDistance2D(a, b)).toBe(0);
    });

    it("handles negative coordinates correctly", () => {
      const a: Point2D = { x: -1, y: -2 };
      const b: Point2D = { x: 2, y: 2 };

      // sqrt(9 + 16) = sqrt(25) = 5
      expect(calculateDistance2D(a, b)).toBeCloseTo(5, 5);
    });

    it("is symmetric", () => {
      const a: Point2D = { x: 1, y: 2 };
      const b: Point2D = { x: 4, y: 6 };

      expect(calculateDistance2D(a, b)).toBe(calculateDistance2D(b, a));
    });
  });

  describe("accepts Point3D (ignores z coordinate)", () => {
    it("ignores z coordinate in distance calculation", () => {
      const a: Point3D = { x: 0, y: 0, z: 100 };
      const b: Point3D = { x: 3, y: 4, z: 200 };

      expect(calculateDistance2D(a, b)).toBeCloseTo(5, 5);
    });
  });
});
