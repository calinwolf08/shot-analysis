/**
 * Type tests for metric extraction and shot analysis types.
 * These tests verify the type contracts and helper function behavior.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import { createEmptyMetricValue, createEmptyShotAnalysis, createEmptyVideoMetadata, createEmptyAnalysisResult, isSuccessfulMetricResult, getAverageMetricConfidence, filterMetricsByConfidence, } from "./types";
import { ShotPhase } from "../detection/types";
import { DEFAULT_CONFIG } from "../config";
describe("MetricValue type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const metric = {
                value: 165.5,
                unit: "degrees",
                frame: 42,
                confidence: 0.95,
            };
            expect(typeof metric.value).toBe("number");
            expect(typeof metric.unit).toBe("string");
            expect(typeof metric.frame).toBe("number");
            expect(typeof metric.confidence).toBe("number");
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
        it("accepts numeric values", () => {
            const metric = {
                value: 90,
                unit: "degrees",
                frame: 10,
                confidence: 0.88,
            };
            expect(metric.value).toBe(90);
        });
        it("accepts string values for categorical metrics", () => {
            const metric = {
                value: "aligned",
                unit: "alignment",
                frame: 15,
                confidence: 0.92,
            };
            expect(metric.value).toBe("aligned");
        });
    });
    describe("valid metric data", () => {
        it("accepts confidence values in 0-1 range", () => {
            const lowConfidence = {
                value: 45,
                unit: "degrees",
                frame: 0,
                confidence: 0.0,
            };
            const highConfidence = {
                value: 45,
                unit: "degrees",
                frame: 0,
                confidence: 1.0,
            };
            expect(lowConfidence.confidence).toBe(0.0);
            expect(highConfidence.confidence).toBe(1.0);
        });
        it("accepts zero-based frame indices", () => {
            const metric = {
                value: 100,
                unit: "percent",
                frame: 0,
                confidence: 0.9,
            };
            expect(metric.frame).toBe(0);
        });
    });
});
describe("ShotAnalysis type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const analysis = {
                shotIndex: 0,
                frameRange: { start: 10, end: 80 },
                phases: {},
                metrics: {},
                overallConfidence: 0.9,
            };
            expect(typeof analysis.shotIndex).toBe("number");
            expect(typeof analysis.frameRange.start).toBe("number");
            expect(typeof analysis.frameRange.end).toBe("number");
            expect(typeof analysis.phases).toBe("object");
            expect(typeof analysis.metrics).toBe("object");
            expect(typeof analysis.overallConfidence).toBe("number");
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("valid analysis data", () => {
        it("accepts empty metrics object", () => {
            const analysis = {
                shotIndex: 0,
                frameRange: { start: 0, end: 50 },
                phases: {},
                metrics: {},
                overallConfidence: 0.5,
            };
            expect(Object.keys(analysis.metrics)).toHaveLength(0);
        });
        it("accepts multiple metrics keyed by name", () => {
            const analysis = {
                shotIndex: 0,
                frameRange: { start: 10, end: 80 },
                phases: {
                    [ShotPhase.Release]: { startFrame: 60, endFrame: 65 },
                },
                metrics: {
                    elbowAngleAtRelease: {
                        value: 165,
                        unit: "degrees",
                        frame: 60,
                        confidence: 0.95,
                    },
                    kneeFlexionAtLoad: {
                        value: 120,
                        unit: "degrees",
                        frame: 25,
                        confidence: 0.88,
                    },
                    releaseHeight: {
                        value: 0.85,
                        unit: "normalized",
                        frame: 60,
                        confidence: 0.92,
                    },
                },
                overallConfidence: 0.91,
            };
            expect(Object.keys(analysis.metrics)).toHaveLength(3);
            expect(analysis.metrics["elbowAngleAtRelease"]?.value).toBe(165);
        });
        it("accepts partial phases for partial shots", () => {
            const analysis = {
                shotIndex: 0,
                frameRange: { start: 0, end: 40 },
                phases: {
                    [ShotPhase.Rise]: { startFrame: 0, endFrame: 15 },
                    [ShotPhase.SetPoint]: { startFrame: 16, endFrame: 25 },
                    [ShotPhase.Release]: { startFrame: 26, endFrame: 30 },
                },
                metrics: {},
                overallConfidence: 0.75,
            };
            expect(analysis.phases[ShotPhase.Gather]).toBeUndefined();
            expect(analysis.phases[ShotPhase.Rise]).toBeDefined();
        });
    });
});
describe("VideoMetadata type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const metadata = {
                width: 1920,
                height: 1080,
                fps: 30,
                totalFrames: 900,
            };
            expect(typeof metadata.width).toBe("number");
            expect(typeof metadata.height).toBe("number");
            expect(typeof metadata.fps).toBe("number");
            expect(typeof metadata.totalFrames).toBe("number");
        });
        it("allows optional duration", () => {
            const recordedVideo = {
                width: 1280,
                height: 720,
                duration: 30000,
                fps: 60,
                totalFrames: 1800,
            };
            const liveStream = {
                width: 1280,
                height: 720,
                fps: 30,
                totalFrames: 0,
            };
            expect(recordedVideo.duration).toBe(30000);
            expect(liveStream.duration).toBeUndefined();
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
});
describe("AnalysisResult type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const config = { ...DEFAULT_CONFIG };
            const result = {
                shots: [],
                videoMetadata: {
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    totalFrames: 900,
                },
                config,
            };
            expect(Array.isArray(result.shots)).toBe(true);
            expect(typeof result.videoMetadata).toBe("object");
            expect(typeof result.config).toBe("object");
        });
        it("enforces readonly arrays at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("valid result data", () => {
        it("accepts empty result for no shots detected", () => {
            const config = { ...DEFAULT_CONFIG };
            const result = {
                shots: [],
                videoMetadata: {
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    totalFrames: 100,
                },
                config,
            };
            expect(result.shots).toHaveLength(0);
        });
        it("accepts result with multiple shots", () => {
            const config = { ...DEFAULT_CONFIG };
            const result = {
                shots: [
                    {
                        shotIndex: 0,
                        frameRange: { start: 10, end: 80 },
                        phases: {},
                        metrics: {},
                        overallConfidence: 0.9,
                    },
                    {
                        shotIndex: 1,
                        frameRange: { start: 120, end: 190 },
                        phases: {},
                        metrics: {},
                        overallConfidence: 0.85,
                    },
                ],
                videoMetadata: {
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    totalFrames: 300,
                },
                config,
            };
            expect(result.shots).toHaveLength(2);
        });
    });
});
describe("MetricCalculatorContext type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const context = {
                poseLandmarks: [],
                phases: {},
                frameRange: { start: 10, end: 80 },
                config: { ...DEFAULT_CONFIG },
            };
            expect(Array.isArray(context.poseLandmarks)).toBe(true);
            expect(typeof context.phases).toBe("object");
            expect(typeof context.frameRange).toBe("object");
            expect(typeof context.config).toBe("object");
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
});
describe("MetricCalculatorResult type", () => {
    describe("structure", () => {
        it("allows successful result with value", () => {
            const success = {
                value: {
                    value: 165,
                    unit: "degrees",
                    frame: 60,
                    confidence: 0.95,
                },
            };
            expect(success.value).toBeDefined();
            expect(success.error).toBeUndefined();
        });
        it("allows error result without value", () => {
            const error = {
                error: "Release phase not detected",
            };
            expect(error.value).toBeUndefined();
            expect(error.error).toBe("Release phase not detected");
        });
        it("allows both value and error (partial success)", () => {
            const partial = {
                value: {
                    value: 140,
                    unit: "degrees",
                    frame: 55,
                    confidence: 0.45,
                },
                error: "Low confidence due to occluded landmarks",
            };
            expect(partial.value).toBeDefined();
            expect(partial.error).toBeDefined();
        });
        it("enforces readonly and optional properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
});
describe("MetricCalculator interface", () => {
    describe("structure", () => {
        it("requires name, description, unit, and calculate method", () => {
            const calculator = {
                name: "testMetric",
                description: "A test metric",
                unit: "degrees",
                calculate: () => ({
                    value: { value: 90, unit: "degrees", frame: 0, confidence: 1 },
                }),
            };
            expect(calculator.name).toBe("testMetric");
            expect(calculator.description).toBe("A test metric");
            expect(calculator.unit).toBe("degrees");
            expect(typeof calculator.calculate).toBe("function");
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
        it("calculate method accepts context and returns result", () => {
            const calculator = {
                name: "elbowAngle",
                description: "Elbow angle at release",
                unit: "degrees",
                calculate(context) {
                    const releasePhase = context.phases[ShotPhase.Release];
                    if (!releasePhase) {
                        return { error: "Release phase not detected" };
                    }
                    return {
                        value: {
                            value: 165,
                            unit: this.unit,
                            frame: releasePhase.startFrame,
                            confidence: 0.95,
                        },
                    };
                },
            };
            const context = {
                poseLandmarks: [],
                phases: {
                    [ShotPhase.Release]: { startFrame: 60, endFrame: 65 },
                },
                frameRange: { start: 10, end: 80 },
                config: { ...DEFAULT_CONFIG },
            };
            const result = calculator.calculate(context);
            expect(result.value?.value).toBe(165);
            expect(result.value?.frame).toBe(60);
        });
    });
});
describe("createEmptyMetricValue", () => {
    it("returns a MetricValue with default values", () => {
        const metric = createEmptyMetricValue();
        expect(metric.value).toBe(0);
        expect(metric.unit).toBe("");
        expect(metric.frame).toBe(0);
        expect(metric.confidence).toBe(0);
    });
    it("accepts custom frame index", () => {
        const metric = createEmptyMetricValue(42);
        expect(metric.frame).toBe(42);
    });
    it("returns a valid MetricValue type", () => {
        const metric = createEmptyMetricValue();
        expectTypeOf(metric).toEqualTypeOf();
    });
});
describe("createEmptyShotAnalysis", () => {
    it("returns a ShotAnalysis with default values", () => {
        const analysis = createEmptyShotAnalysis();
        expect(analysis.shotIndex).toBe(0);
        expect(analysis.frameRange.start).toBe(0);
        expect(analysis.frameRange.end).toBe(0);
        expect(Object.keys(analysis.phases)).toHaveLength(0);
        expect(Object.keys(analysis.metrics)).toHaveLength(0);
        expect(analysis.overallConfidence).toBe(0);
    });
    it("accepts custom shot index", () => {
        const analysis = createEmptyShotAnalysis(5);
        expect(analysis.shotIndex).toBe(5);
    });
    it("returns a valid ShotAnalysis type", () => {
        const analysis = createEmptyShotAnalysis();
        expectTypeOf(analysis).toEqualTypeOf();
    });
});
describe("createEmptyVideoMetadata", () => {
    it("returns a VideoMetadata with default values", () => {
        const metadata = createEmptyVideoMetadata();
        expect(metadata.width).toBe(0);
        expect(metadata.height).toBe(0);
        expect(metadata.fps).toBe(0);
        expect(metadata.totalFrames).toBe(0);
        expect(metadata.duration).toBeUndefined();
    });
    it("returns a valid VideoMetadata type", () => {
        const metadata = createEmptyVideoMetadata();
        expectTypeOf(metadata).toEqualTypeOf();
    });
});
describe("createEmptyAnalysisResult", () => {
    it("returns an AnalysisResult with default values", () => {
        const config = { ...DEFAULT_CONFIG };
        const result = createEmptyAnalysisResult(config);
        expect(result.shots).toHaveLength(0);
        expect(result.videoMetadata.width).toBe(0);
        expect(result.config).toBe(config);
    });
    it("returns a valid AnalysisResult type", () => {
        const config = { ...DEFAULT_CONFIG };
        const result = createEmptyAnalysisResult(config);
        expectTypeOf(result).toEqualTypeOf();
    });
});
describe("isSuccessfulMetricResult", () => {
    it("returns true for results with value", () => {
        const result = {
            value: {
                value: 90,
                unit: "degrees",
                frame: 10,
                confidence: 0.9,
            },
        };
        expect(isSuccessfulMetricResult(result)).toBe(true);
    });
    it("returns false for results without value", () => {
        const result = {
            error: "Calculation failed",
        };
        expect(isSuccessfulMetricResult(result)).toBe(false);
    });
    it("returns true for results with both value and error", () => {
        const result = {
            value: {
                value: 90,
                unit: "degrees",
                frame: 10,
                confidence: 0.5,
            },
            error: "Low confidence",
        };
        expect(isSuccessfulMetricResult(result)).toBe(true);
    });
    it("narrows type correctly for successful results", () => {
        const result = {
            value: {
                value: 90,
                unit: "degrees",
                frame: 10,
                confidence: 0.9,
            },
        };
        if (isSuccessfulMetricResult(result)) {
            // Type should be narrowed to include value
            expect(result.value.value).toBe(90);
        }
    });
});
describe("getAverageMetricConfidence", () => {
    it("returns 0 for analysis with no metrics", () => {
        const analysis = {
            shotIndex: 0,
            frameRange: { start: 0, end: 50 },
            phases: {},
            metrics: {},
            overallConfidence: 0.5,
        };
        expect(getAverageMetricConfidence(analysis)).toBe(0);
    });
    it("returns correct average for single metric", () => {
        const analysis = {
            shotIndex: 0,
            frameRange: { start: 0, end: 50 },
            phases: {},
            metrics: {
                elbowAngle: {
                    value: 165,
                    unit: "degrees",
                    frame: 30,
                    confidence: 0.9,
                },
            },
            overallConfidence: 0.9,
        };
        expect(getAverageMetricConfidence(analysis)).toBe(0.9);
    });
    it("returns correct average for multiple metrics", () => {
        const analysis = {
            shotIndex: 0,
            frameRange: { start: 0, end: 50 },
            phases: {},
            metrics: {
                metric1: { value: 100, unit: "degrees", frame: 10, confidence: 0.8 },
                metric2: { value: 200, unit: "percent", frame: 20, confidence: 0.9 },
                metric3: { value: 300, unit: "ratio", frame: 30, confidence: 1.0 },
            },
            overallConfidence: 0.9,
        };
        // (0.8 + 0.9 + 1.0) / 3 = 0.9
        expect(getAverageMetricConfidence(analysis)).toBeCloseTo(0.9, 10);
    });
});
describe("filterMetricsByConfidence", () => {
    const metrics = {
        highConfidence: { value: 90, unit: "degrees", frame: 10, confidence: 0.95 },
        mediumConfidence: {
            value: 85,
            unit: "degrees",
            frame: 20,
            confidence: 0.7,
        },
        lowConfidence: { value: 80, unit: "degrees", frame: 30, confidence: 0.4 },
    };
    it("returns all metrics when threshold is 0", () => {
        const filtered = filterMetricsByConfidence(metrics, 0);
        expect(Object.keys(filtered)).toHaveLength(3);
    });
    it("returns no metrics when threshold is 1", () => {
        const filtered = filterMetricsByConfidence(metrics, 1);
        // Only metrics with confidence >= 1.0 (none in this case since max is 0.95)
        expect(Object.keys(filtered)).toHaveLength(0);
    });
    it("filters metrics correctly at 0.5 threshold", () => {
        const filtered = filterMetricsByConfidence(metrics, 0.5);
        expect(Object.keys(filtered)).toHaveLength(2);
        expect(filtered["highConfidence"]).toBeDefined();
        expect(filtered["mediumConfidence"]).toBeDefined();
        expect(filtered["lowConfidence"]).toBeUndefined();
    });
    it("includes metrics at exactly the threshold", () => {
        const filtered = filterMetricsByConfidence(metrics, 0.7);
        expect(Object.keys(filtered)).toHaveLength(2);
        expect(filtered["mediumConfidence"]).toBeDefined();
    });
    it("returns readonly record", () => {
        const filtered = filterMetricsByConfidence(metrics, 0.5);
        expectTypeOf(filtered).toEqualTypeOf();
    });
});
describe("edge cases", () => {
    describe("metric calculation with low confidence landmarks", () => {
        it("handles calculator returning error for low confidence input", () => {
            const calculator = {
                name: "elbowAngle",
                description: "Elbow angle at release",
                unit: "degrees",
                calculate(context) {
                    // Simulate checking landmark confidence
                    const minConfidence = context.config.minConfidenceThreshold;
                    const landmarkConfidence = 0.3; // Simulated low confidence
                    if (landmarkConfidence < minConfidence) {
                        return { error: "Landmark confidence below threshold" };
                    }
                    return {
                        value: { value: 165, unit: "degrees", frame: 60, confidence: 0.95 },
                    };
                },
            };
            const context = {
                poseLandmarks: [],
                phases: {},
                frameRange: { start: 0, end: 100 },
                config: { ...DEFAULT_CONFIG, minConfidenceThreshold: 0.5 },
            };
            const result = calculator.calculate(context);
            expect(result.error).toBe("Landmark confidence below threshold");
            expect(result.value).toBeUndefined();
        });
    });
    describe("metrics unavailable for certain shots", () => {
        it("handles missing phase for metric calculation", () => {
            const calculator = {
                name: "releaseVelocity",
                description: "Wrist velocity at release",
                unit: "m/s",
                calculate(context) {
                    const releasePhase = context.phases[ShotPhase.Release];
                    if (!releasePhase) {
                        return { error: "Release phase not detected - metric unavailable" };
                    }
                    return {
                        value: {
                            value: 5.2,
                            unit: "m/s",
                            frame: releasePhase.startFrame,
                            confidence: 0.9,
                        },
                    };
                },
            };
            const context = {
                poseLandmarks: [],
                phases: {
                    [ShotPhase.Gather]: { startFrame: 0, endFrame: 20 },
                    [ShotPhase.Load]: { startFrame: 21, endFrame: 40 },
                    // No release phase - video ended early
                },
                frameRange: { start: 0, end: 40 },
                config: { ...DEFAULT_CONFIG },
            };
            const result = calculator.calculate(context);
            expect(result.error).toBe("Release phase not detected - metric unavailable");
        });
        it("handles occluded body parts", () => {
            const calculator = {
                name: "guideHandPosition",
                description: "Guide hand position relative to ball",
                unit: "position",
                calculate(_context) {
                    // Simulate guide hand being occluded
                    const guideHandVisible = false;
                    if (!guideHandVisible) {
                        return { error: "Guide hand occluded - cannot calculate metric" };
                    }
                    return {
                        value: {
                            value: "correct",
                            unit: "position",
                            frame: 50,
                            confidence: 0.85,
                        },
                    };
                },
            };
            const context = {
                poseLandmarks: [],
                phases: {},
                frameRange: { start: 0, end: 100 },
                config: { ...DEFAULT_CONFIG },
            };
            const result = calculator.calculate(context);
            expect(result.error).toBe("Guide hand occluded - cannot calculate metric");
        });
    });
    describe("multiple shots with different metric availability", () => {
        it("supports shots with varying metric counts", () => {
            const shots = [
                {
                    shotIndex: 0,
                    frameRange: { start: 0, end: 80 },
                    phases: {
                        [ShotPhase.Release]: { startFrame: 60, endFrame: 65 },
                    },
                    metrics: {
                        elbowAngle: {
                            value: 165,
                            unit: "degrees",
                            frame: 60,
                            confidence: 0.95,
                        },
                        kneeAngle: {
                            value: 120,
                            unit: "degrees",
                            frame: 25,
                            confidence: 0.88,
                        },
                    },
                    overallConfidence: 0.91,
                },
                {
                    shotIndex: 1,
                    frameRange: { start: 100, end: 150 },
                    phases: {},
                    metrics: {
                        // Only one metric available due to partial detection
                        kneeAngle: {
                            value: 115,
                            unit: "degrees",
                            frame: 110,
                            confidence: 0.72,
                        },
                    },
                    overallConfidence: 0.72,
                },
            ];
            expect(Object.keys(shots[0].metrics)).toHaveLength(2);
            expect(Object.keys(shots[1].metrics)).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=types.test.js.map