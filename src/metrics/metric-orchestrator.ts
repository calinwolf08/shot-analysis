/**
 * MetricOrchestrator - Orchestrates metric calculation for shot analysis.
 *
 * This class manages a collection of metric calculators and runs them
 * against shot data to produce comprehensive analysis results.
 *
 * @see Feature 5.0 - Metric Extraction
 */

import type { AnalysisConfig } from "../config";
import type { ShotPhases } from "../detection/types";
import type { PoseLandmarks } from "../types";
import type {
  MetricCalculator,
  MetricCalculatorContext,
  MetricValue,
  ShotAnalysis,
} from "./types";
import { getAverageMetricConfidence } from "./types";

/**
 * Result from calculating metrics via the orchestrator.
 */
export interface MetricsCalculationResult {
  /** Successfully calculated metrics keyed by name */
  readonly metrics: Readonly<Record<string, MetricValue>>;
  /** Errors from failed calculations keyed by calculator name */
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * Orchestrates the execution of multiple metric calculators on shot data.
 *
 * Uses the strategy pattern to allow flexible composition of metric
 * calculations. Each calculator operates independently and can be
 * added or removed without affecting others.
 *
 * @example
 * ```typescript
 * const orchestrator = new MetricOrchestrator();
 * orchestrator.registerCalculator(new ElbowAngleCalculator());
 * orchestrator.registerCalculator(new KneeFlexionCalculator());
 *
 * const analysis = orchestrator.analyzeShot(
 *   0,
 *   poseLandmarks,
 *   { start: 10, end: 80 },
 *   phases,
 *   config
 * );
 * ```
 */
export class MetricOrchestrator {
  /** Registered calculators keyed by name */
  private readonly calculators: Map<string, MetricCalculator> = new Map();

  /**
   * Creates a new MetricOrchestrator.
   *
   * @param initialCalculators - Optional array of calculators to register on creation
   */
  constructor(initialCalculators: readonly MetricCalculator[] = []) {
    for (const calculator of initialCalculators) {
      this.registerCalculator(calculator);
    }
  }

  /**
   * Registers a metric calculator with the orchestrator.
   *
   * If a calculator with the same name already exists, it will be replaced.
   *
   * @param calculator - The calculator to register
   */
  registerCalculator(calculator: MetricCalculator): void {
    this.calculators.set(calculator.name, calculator);
  }

  /**
   * Returns the names of all registered calculators.
   *
   * @returns Array of calculator names
   */
  getCalculatorNames(): string[] {
    return Array.from(this.calculators.keys());
  }

  /**
   * Calculates metrics from all registered calculators.
   *
   * Each calculator is invoked with the provided context. Calculators
   * that fail or throw exceptions have their errors recorded but do
   * not prevent other calculators from running.
   *
   * @param poseLandmarks - Pose landmarks for frames in the shot
   * @param frameRange - Frame range of the shot
   * @param phases - Detected phases for the shot
   * @param config - Analysis configuration
   * @returns Object containing calculated metrics and any errors
   */
  calculateMetrics(
    poseLandmarks: readonly PoseLandmarks[],
    frameRange: { readonly start: number; readonly end: number },
    phases: ShotPhases,
    config: AnalysisConfig,
  ): MetricsCalculationResult {
    const metrics: Record<string, MetricValue> = {};
    const errors: Record<string, string> = {};

    const context: MetricCalculatorContext = {
      poseLandmarks,
      frameRange,
      phases,
      config,
    };

    for (const [name, calculator] of this.calculators) {
      try {
        const result = calculator.calculate(context);

        if (result.value !== undefined) {
          metrics[name] = result.value;
        }

        if (result.error !== undefined) {
          errors[name] = result.error;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors[name] = `Calculator threw exception: ${errorMessage}`;
      }
    }

    return { metrics, errors };
  }

  /**
   * Analyzes a single shot using all registered calculators.
   *
   * Creates a complete ShotAnalysis including the shot's frame range,
   * phases, calculated metrics, and overall confidence score.
   *
   * @param shotIndex - Zero-based index of the shot
   * @param poseLandmarks - Pose landmarks for frames in the shot
   * @param frameRange - Frame range of the shot
   * @param phases - Detected phases for the shot
   * @param config - Analysis configuration
   * @returns Complete shot analysis
   */
  analyzeShot(
    shotIndex: number,
    poseLandmarks: readonly PoseLandmarks[],
    frameRange: { readonly start: number; readonly end: number },
    phases: ShotPhases,
    config: AnalysisConfig,
  ): ShotAnalysis {
    const { metrics } = this.calculateMetrics(
      poseLandmarks,
      frameRange,
      phases,
      config,
    );

    const analysis: ShotAnalysis = {
      shotIndex,
      frameRange: {
        start: frameRange.start,
        end: frameRange.end,
      },
      phases,
      metrics,
      overallConfidence: 0,
    };

    // Calculate overall confidence from metrics
    const overallConfidence = getAverageMetricConfidence(analysis);

    return {
      ...analysis,
      overallConfidence,
    };
  }
}
