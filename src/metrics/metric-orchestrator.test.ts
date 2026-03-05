/**
 * Unit tests for MetricOrchestrator class.
 * Tests the orchestration of multiple metric calculators on shot data.
 */

import { describe, it, expect, vi } from "vitest";
import { MetricOrchestrator } from "./metric-orchestrator";
import type { MetricCalculator, MetricCalculatorResult } from "./types";
import { ShotPhase } from "../detection/types";
import { DEFAULT_CONFIG } from "../config";
import type { AnalysisConfig } from "../config";
import type { PoseLandmarks, PoseLandmark } from "../types";

/**
 * Creates a mock PoseLandmark for testing.
 */
function createMockLandmark(
  x: number = 0.5,
  y: number = 0.5,
  z: number = 0,
  visibility: number = 1.0,
  presence: number = 1.0,
): PoseLandmark {
  return {
    position: { x, y, z },
    visibility,
    presence,
  };
}

/**
 * Creates mock PoseLandmarks with all 33 landmarks for testing.
 */
function createMockPoseLandmarks(
  frameIndex: number,
  confidence: number = 0.9,
): PoseLandmarks {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () =>
    createMockLandmark(),
  );
  return {
    landmarks,
    confidence,
    timestamp: frameIndex * 33.33, // Assuming 30fps
    frameIndex,
  };
}

/**
 * Creates a simple metric calculator for testing.
 */
function createMockCalculator(
  name: string,
  returnValue: MetricCalculatorResult,
): MetricCalculator {
  return {
    name,
    description: `Mock calculator for ${name}`,
    unit: "test",
    calculate: vi.fn().mockReturnValue(returnValue),
  };
}

describe("MetricOrchestrator", () => {
  describe("constructor", () => {
    it("creates an orchestrator with no calculators", () => {
      const orchestrator = new MetricOrchestrator();

      expect(orchestrator).toBeInstanceOf(MetricOrchestrator);
    });

    it("creates an orchestrator with initial calculators", () => {
      const calculator = createMockCalculator("test", {
        value: { value: 90, unit: "degrees", frame: 0, confidence: 0.9 },
      });
      const orchestrator = new MetricOrchestrator([calculator]);

      expect(orchestrator).toBeInstanceOf(MetricOrchestrator);
    });
  });

  describe("registerCalculator", () => {
    it("registers a single calculator", () => {
      const orchestrator = new MetricOrchestrator();
      const calculator = createMockCalculator("elbowAngle", {
        value: { value: 165, unit: "degrees", frame: 60, confidence: 0.95 },
      });

      orchestrator.registerCalculator(calculator);

      expect(orchestrator.getCalculatorNames()).toContain("elbowAngle");
    });

    it("registers multiple calculators", () => {
      const orchestrator = new MetricOrchestrator();
      const calc1 = createMockCalculator("elbowAngle", {
        value: { value: 165, unit: "degrees", frame: 60, confidence: 0.95 },
      });
      const calc2 = createMockCalculator("kneeAngle", {
        value: { value: 120, unit: "degrees", frame: 30, confidence: 0.88 },
      });

      orchestrator.registerCalculator(calc1);
      orchestrator.registerCalculator(calc2);

      const names = orchestrator.getCalculatorNames();
      expect(names).toContain("elbowAngle");
      expect(names).toContain("kneeAngle");
    });

    it("overwrites calculator with same name", () => {
      const orchestrator = new MetricOrchestrator();
      const calc1 = createMockCalculator("elbowAngle", {
        value: { value: 165, unit: "degrees", frame: 60, confidence: 0.95 },
      });
      const calc2 = createMockCalculator("elbowAngle", {
        value: { value: 170, unit: "degrees", frame: 65, confidence: 0.9 },
      });

      orchestrator.registerCalculator(calc1);
      orchestrator.registerCalculator(calc2);

      // Should only have one calculator with this name
      expect(
        orchestrator
          .getCalculatorNames()
          .filter((name) => name === "elbowAngle"),
      ).toHaveLength(1);
    });
  });

  describe("getCalculatorNames", () => {
    it("returns empty array when no calculators registered", () => {
      const orchestrator = new MetricOrchestrator();

      expect(orchestrator.getCalculatorNames()).toEqual([]);
    });

    it("returns all registered calculator names", () => {
      const orchestrator = new MetricOrchestrator();
      const calc1 = createMockCalculator("metric1", { error: "test" });
      const calc2 = createMockCalculator("metric2", { error: "test" });
      const calc3 = createMockCalculator("metric3", { error: "test" });

      orchestrator.registerCalculator(calc1);
      orchestrator.registerCalculator(calc2);
      orchestrator.registerCalculator(calc3);

      const names = orchestrator.getCalculatorNames();
      expect(names).toHaveLength(3);
      expect(names).toContain("metric1");
      expect(names).toContain("metric2");
      expect(names).toContain("metric3");
    });
  });

  describe("calculateMetrics", () => {
    const config: AnalysisConfig = { ...DEFAULT_CONFIG };

    it("returns empty metrics when no calculators registered", () => {
      const orchestrator = new MetricOrchestrator();
      const poseLandmarks = [createMockPoseLandmarks(0)];

      const result = orchestrator.calculateMetrics(
        poseLandmarks,
        { start: 0, end: 0 },
        {},
        config,
      );

      expect(result.metrics).toEqual({});
      expect(result.errors).toEqual({});
    });

    it("calculates metrics from all registered calculators", () => {
      const calc1 = createMockCalculator("elbowAngle", {
        value: { value: 165, unit: "degrees", frame: 60, confidence: 0.95 },
      });
      const calc2 = createMockCalculator("kneeAngle", {
        value: { value: 120, unit: "degrees", frame: 30, confidence: 0.88 },
      });
      const orchestrator = new MetricOrchestrator([calc1, calc2]);

      const poseLandmarks = [
        createMockPoseLandmarks(0),
        createMockPoseLandmarks(1),
      ];

      const result = orchestrator.calculateMetrics(
        poseLandmarks,
        { start: 0, end: 1 },
        {},
        config,
      );

      expect(Object.keys(result.metrics)).toHaveLength(2);
      expect(result.metrics["elbowAngle"]?.value).toBe(165);
      expect(result.metrics["kneeAngle"]?.value).toBe(120);
    });

    it("collects errors from failed calculators", () => {
      const successCalc = createMockCalculator("success", {
        value: { value: 100, unit: "test", frame: 0, confidence: 0.9 },
      });
      const failCalc = createMockCalculator("fail", {
        error: "Phase not detected",
      });
      const orchestrator = new MetricOrchestrator([successCalc, failCalc]);

      const poseLandmarks = [createMockPoseLandmarks(0)];

      const result = orchestrator.calculateMetrics(
        poseLandmarks,
        { start: 0, end: 0 },
        {},
        config,
      );

      expect(Object.keys(result.metrics)).toHaveLength(1);
      expect(result.metrics["success"]).toBeDefined();
      expect(result.errors["fail"]).toBe("Phase not detected");
    });

    it("passes correct context to calculators", () => {
      const calculator: MetricCalculator = {
        name: "contextTest",
        description: "Tests context passing",
        unit: "test",
        calculate: vi.fn().mockReturnValue({
          value: { value: 0, unit: "test", frame: 0, confidence: 1 },
        }),
      };
      const orchestrator = new MetricOrchestrator([calculator]);

      const poseLandmarks = [
        createMockPoseLandmarks(10),
        createMockPoseLandmarks(11),
        createMockPoseLandmarks(12),
      ];
      const frameRange = { start: 10, end: 12 };
      const phases = {
        [ShotPhase.Release]: { startFrame: 11, endFrame: 12 },
      };

      orchestrator.calculateMetrics(poseLandmarks, frameRange, phases, config);

      expect(calculator.calculate).toHaveBeenCalledWith({
        poseLandmarks,
        frameRange,
        phases,
        config,
      });
    });

    it("handles calculator that returns both value and error", () => {
      const calculator = createMockCalculator("partial", {
        value: { value: 90, unit: "degrees", frame: 0, confidence: 0.4 },
        error: "Low confidence due to occlusion",
      });
      const orchestrator = new MetricOrchestrator([calculator]);

      const result = orchestrator.calculateMetrics(
        [createMockPoseLandmarks(0)],
        { start: 0, end: 0 },
        {},
        config,
      );

      // Should include the value despite the error
      expect(result.metrics["partial"]).toBeDefined();
      expect(result.metrics["partial"]?.value).toBe(90);
      // Should also capture the error
      expect(result.errors["partial"]).toBe("Low confidence due to occlusion");
    });
  });

  describe("analyzeShot", () => {
    const config: AnalysisConfig = { ...DEFAULT_CONFIG };

    it("returns ShotAnalysis with calculated metrics", () => {
      const calculator = createMockCalculator("elbowAngle", {
        value: { value: 165, unit: "degrees", frame: 60, confidence: 0.95 },
      });
      const orchestrator = new MetricOrchestrator([calculator]);

      const poseLandmarks = Array.from({ length: 71 }, (_, i) =>
        createMockPoseLandmarks(10 + i),
      );
      const phases = {
        [ShotPhase.Gather]: { startFrame: 10, endFrame: 20 },
        [ShotPhase.Release]: { startFrame: 60, endFrame: 65 },
      };

      const analysis = orchestrator.analyzeShot(
        0,
        poseLandmarks,
        { start: 10, end: 80 },
        phases,
        config,
      );

      expect(analysis.shotIndex).toBe(0);
      expect(analysis.frameRange.start).toBe(10);
      expect(analysis.frameRange.end).toBe(80);
      expect(analysis.phases).toBe(phases);
      expect(analysis.metrics["elbowAngle"]).toBeDefined();
      expect(analysis.overallConfidence).toBeGreaterThan(0);
    });

    it("calculates overall confidence as average of metric confidences", () => {
      const calc1 = createMockCalculator("metric1", {
        value: { value: 100, unit: "test", frame: 0, confidence: 0.8 },
      });
      const calc2 = createMockCalculator("metric2", {
        value: { value: 200, unit: "test", frame: 0, confidence: 1.0 },
      });
      const orchestrator = new MetricOrchestrator([calc1, calc2]);

      const analysis = orchestrator.analyzeShot(
        0,
        [createMockPoseLandmarks(0)],
        { start: 0, end: 0 },
        {},
        config,
      );

      // (0.8 + 1.0) / 2 = 0.9
      expect(analysis.overallConfidence).toBeCloseTo(0.9, 10);
    });

    it("returns 0 overall confidence when no metrics calculated", () => {
      const failingCalc = createMockCalculator("failing", {
        error: "Cannot calculate",
      });
      const orchestrator = new MetricOrchestrator([failingCalc]);

      const analysis = orchestrator.analyzeShot(
        0,
        [createMockPoseLandmarks(0)],
        { start: 0, end: 0 },
        {},
        config,
      );

      expect(analysis.overallConfidence).toBe(0);
      expect(Object.keys(analysis.metrics)).toHaveLength(0);
    });

    it("correctly sets shot index", () => {
      const orchestrator = new MetricOrchestrator();

      const analysis1 = orchestrator.analyzeShot(
        0,
        [createMockPoseLandmarks(0)],
        { start: 0, end: 50 },
        {},
        config,
      );
      const analysis2 = orchestrator.analyzeShot(
        5,
        [createMockPoseLandmarks(100)],
        { start: 100, end: 150 },
        {},
        config,
      );

      expect(analysis1.shotIndex).toBe(0);
      expect(analysis2.shotIndex).toBe(5);
    });
  });

  describe("edge cases", () => {
    const config: AnalysisConfig = { ...DEFAULT_CONFIG };

    describe("calculator throws exception", () => {
      it("catches and records exception as error", () => {
        const throwingCalc: MetricCalculator = {
          name: "throwing",
          description: "Throws an error",
          unit: "test",
          calculate: vi.fn().mockImplementation(() => {
            throw new Error("Unexpected calculation error");
          }),
        };
        const orchestrator = new MetricOrchestrator([throwingCalc]);

        const result = orchestrator.calculateMetrics(
          [createMockPoseLandmarks(0)],
          { start: 0, end: 0 },
          {},
          config,
        );

        expect(result.errors["throwing"]).toContain(
          "Unexpected calculation error",
        );
        expect(result.metrics["throwing"]).toBeUndefined();
      });

      it("continues processing other calculators after exception", () => {
        const throwingCalc: MetricCalculator = {
          name: "throwing",
          description: "Throws an error",
          unit: "test",
          calculate: vi.fn().mockImplementation(() => {
            throw new Error("Error!");
          }),
        };
        const successCalc = createMockCalculator("success", {
          value: { value: 100, unit: "test", frame: 0, confidence: 0.9 },
        });
        const orchestrator = new MetricOrchestrator([
          throwingCalc,
          successCalc,
        ]);

        const result = orchestrator.calculateMetrics(
          [createMockPoseLandmarks(0)],
          { start: 0, end: 0 },
          {},
          config,
        );

        expect(result.metrics["success"]).toBeDefined();
        expect(result.errors["throwing"]).toBeDefined();
      });
    });

    describe("empty pose landmarks array", () => {
      it("handles empty pose landmarks gracefully", () => {
        const calculator = createMockCalculator("test", {
          value: { value: 0, unit: "test", frame: 0, confidence: 0.5 },
        });
        const orchestrator = new MetricOrchestrator([calculator]);

        orchestrator.calculateMetrics([], { start: 0, end: 0 }, {}, config);

        // Calculator should still be called
        expect(calculator.calculate).toHaveBeenCalled();
      });
    });

    describe("metric with zero confidence", () => {
      it("includes metrics with zero confidence", () => {
        const calculator = createMockCalculator("zeroConfidence", {
          value: { value: 100, unit: "test", frame: 0, confidence: 0 },
        });
        const orchestrator = new MetricOrchestrator([calculator]);

        const result = orchestrator.calculateMetrics(
          [createMockPoseLandmarks(0)],
          { start: 0, end: 0 },
          {},
          config,
        );

        expect(result.metrics["zeroConfidence"]).toBeDefined();
        expect(result.metrics["zeroConfidence"]?.confidence).toBe(0);
      });
    });

    describe("all calculators fail", () => {
      it("returns empty metrics and all errors", () => {
        const fail1 = createMockCalculator("fail1", { error: "Error 1" });
        const fail2 = createMockCalculator("fail2", { error: "Error 2" });
        const orchestrator = new MetricOrchestrator([fail1, fail2]);

        const result = orchestrator.calculateMetrics(
          [createMockPoseLandmarks(0)],
          { start: 0, end: 0 },
          {},
          config,
        );

        expect(Object.keys(result.metrics)).toHaveLength(0);
        expect(Object.keys(result.errors)).toHaveLength(2);
        expect(result.errors["fail1"]).toBe("Error 1");
        expect(result.errors["fail2"]).toBe("Error 2");
      });
    });
  });
});
