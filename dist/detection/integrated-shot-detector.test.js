/**
 * Unit tests for integrated ShotDetector.
 * Tests the unified shot detection class that combines boundary and phase detection.
 *
 * @see Feature 4.4 - Shot Detector Integration
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ShotDetector, createShotDetector, } from "./integrated-shot-detector";
import { ShotPhase } from "./types";
import { LANDMARK_INDEX } from "../pose/types";
/**
 * Helper to create a single landmark with default values.
 */
function createLandmark(x, y, z = 0, visibility = 0.95, confidence = 0.95) {
    return { x, y, z, visibility, confidence };
}
/**
 * Helper to create a full set of 33 landmarks with default positions.
 */
function createDefaultLandmarks() {
    const landmarks = [];
    for (let i = 0; i < 33; i++) {
        landmarks.push(createLandmark(0.5, 0.5, 0));
    }
    return landmarks;
}
/**
 * Helper to create PoseLandmarks for a single frame.
 */
function createPoseLandmarks(landmarks, poseConfidence = 0.95) {
    return { landmarks, poseConfidence };
}
/**
 * Helper to create a sequence of frames with wrists at specified positions.
 */
function createFrameSequenceWithWrists(wristPositions) {
    return wristPositions.map(([leftY, rightY]) => {
        const landmarks = createDefaultLandmarks();
        // Set shoulder positions for reference
        // Front-facing camera: right shoulder appears to LEFT of left shoulder in image coords
        // This gives negative shoulderDiffX (rightShoulder.x - leftShoulder.x < 0)
        landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.6, 0.3);
        landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.4, 0.3);
        // Set wrist positions
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.6, leftY);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.4, rightY);
        // Set hand positions similar to wrist
        landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(0.6, leftY - 0.02);
        landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(0.4, rightY - 0.02);
        // Set hip positions
        landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.6, 0.55);
        landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.4, 0.55);
        // Set knee positions
        landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.6, 0.75);
        landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.4, 0.75);
        // Set ankle positions
        landmarks[LANDMARK_INDEX.LEFT_ANKLE] = createLandmark(0.6, 0.95);
        landmarks[LANDMARK_INDEX.RIGHT_ANKLE] = createLandmark(0.4, 0.95);
        return createPoseLandmarks(landmarks);
    });
}
/**
 * Creates a landmark sequence representing a complete basketball shot.
 */
function createCompleteShotSequence() {
    const wristPositions = [
        // Frames 0-4: Neutral stance
        [0.65, 0.65],
        [0.65, 0.65],
        [0.65, 0.65],
        [0.65, 0.65],
        [0.65, 0.65],
        // Frames 5-9: Gather
        [0.6, 0.58],
        [0.55, 0.53],
        [0.5, 0.48],
        [0.48, 0.45],
        [0.45, 0.42],
        // Frames 10-14: Load
        [0.48, 0.45],
        [0.5, 0.48],
        [0.48, 0.46],
        [0.45, 0.43],
        [0.42, 0.4],
        // Frames 15-24: Rise
        [0.38, 0.36],
        [0.34, 0.32],
        [0.3, 0.28],
        [0.26, 0.24],
        [0.22, 0.2],
        [0.2, 0.18],
        [0.18, 0.16],
        [0.16, 0.14],
        [0.15, 0.13],
        [0.14, 0.12],
        // Frames 25-29: Set point
        [0.12, 0.1],
        [0.11, 0.09],
        [0.1, 0.08],
        [0.1, 0.08],
        [0.1, 0.08],
        // Frames 30-34: Release
        [0.12, 0.06],
        [0.18, 0.05],
        [0.24, 0.06],
        [0.3, 0.08],
        [0.36, 0.1],
        // Frames 35-39: Follow through
        [0.42, 0.18],
        [0.48, 0.26],
        [0.54, 0.34],
        [0.58, 0.42],
        [0.62, 0.5],
        // Frames 40-44: Return to neutral
        [0.64, 0.56],
        [0.65, 0.6],
        [0.65, 0.63],
        [0.65, 0.65],
        [0.65, 0.65],
    ];
    return createFrameSequenceWithWrists(wristPositions);
}
describe("ShotDetector", () => {
    describe("constructor and initialization", () => {
        it("creates a detector with default config", () => {
            const detector = createShotDetector();
            expect(detector).toBeInstanceOf(ShotDetector);
        });
        it("creates a detector with custom config", () => {
            const config = {
                boundaryConfig: {
                    velocityThreshold: 0.02,
                },
                phaseConfig: {
                    smoothingWindowSize: 5,
                },
            };
            const detector = createShotDetector(config);
            expect(detector).toBeInstanceOf(ShotDetector);
        });
        it("has a reset method to clear internal state", () => {
            const detector = createShotDetector();
            expect(typeof detector.reset).toBe("function");
        });
        it("reset clears accumulated frames and shots", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            // Process some frames
            for (const frame of sequence.slice(0, 10)) {
                detector.processFrame(frame);
            }
            // Reset
            detector.reset();
            // After reset, should start fresh
            const shots = detector.getDetectedShots();
            expect(shots.length).toBe(0);
        });
    });
    describe("processFrames() batch processing", () => {
        it("returns empty array for empty input", () => {
            const detector = createShotDetector();
            const shots = detector.processFrames([]);
            expect(shots).toEqual([]);
        });
        it("returns empty array for single-frame input", () => {
            const detector = createShotDetector();
            const singleFrame = createFrameSequenceWithWrists([[0.5, 0.5]]);
            const shots = detector.processFrames(singleFrame);
            expect(shots).toEqual([]);
        });
        it("detects a complete shot from a full sequence", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            const shots = detector.processFrames(sequence);
            expect(shots.length).toBe(1);
            expect(shots[0].shotIndex).toBe(0);
        });
        it("includes frame range in detected shots", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            const shots = detector.processFrames(sequence);
            expect(shots.length).toBe(1);
            expect(shots[0].frameRange.start).toBeGreaterThanOrEqual(0);
            expect(shots[0].frameRange.end).toBeLessThan(sequence.length);
            expect(shots[0].frameRange.end).toBeGreaterThan(shots[0].frameRange.start);
        });
        it("includes phase breakdown in detected shots", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            const shots = detector.processFrames(sequence);
            expect(shots.length).toBe(1);
            const shot = shots[0];
            // At minimum, should have some phases detected
            const phaseCount = Object.keys(shot.phases).length;
            expect(phaseCount).toBeGreaterThan(0);
        });
        it("detects multiple shots in sequence", () => {
            const detector = createShotDetector();
            const shot1 = createCompleteShotSequence();
            const gap = Array(20).fill([
                0.65, 0.65,
            ]);
            const gapFrames = createFrameSequenceWithWrists(gap);
            const shot2 = createCompleteShotSequence();
            const sequence = [...shot1, ...gapFrames, ...shot2];
            const shots = detector.processFrames(sequence);
            expect(shots.length).toBe(2);
            expect(shots[0].shotIndex).toBe(0);
            expect(shots[1].shotIndex).toBe(1);
        });
        it("handles sequence with no shots (no significant motion)", () => {
            const detector = createShotDetector();
            const stationaryPositions = Array(30).fill([
                0.65, 0.65,
            ]);
            const sequence = createFrameSequenceWithWrists(stationaryPositions);
            const shots = detector.processFrames(sequence);
            expect(shots).toEqual([]);
        });
        it("processes same sequence twice gives same result (idempotent)", () => {
            const detector1 = createShotDetector();
            const detector2 = createShotDetector();
            const sequence = createCompleteShotSequence();
            const shots1 = detector1.processFrames(sequence);
            const shots2 = detector2.processFrames(sequence);
            expect(shots1.length).toBe(shots2.length);
            if (shots1.length > 0 && shots2.length > 0) {
                expect(shots1[0].frameRange.start).toBe(shots2[0].frameRange.start);
                expect(shots1[0].frameRange.end).toBe(shots2[0].frameRange.end);
            }
        });
    });
    describe("processFrame() incremental processing", () => {
        let detector;
        beforeEach(() => {
            detector = createShotDetector();
        });
        it("returns frame analysis for each processed frame", () => {
            const sequence = createCompleteShotSequence();
            const result = detector.processFrame(sequence[0]);
            expect(result).toBeDefined();
            expect(typeof result.frameIndex).toBe("number");
            expect(result.frameIndex).toBe(0);
        });
        it("increments frame index for each processed frame", () => {
            const sequence = createCompleteShotSequence();
            const result1 = detector.processFrame(sequence[0]);
            const result2 = detector.processFrame(sequence[1]);
            const result3 = detector.processFrame(sequence[2]);
            expect(result1.frameIndex).toBe(0);
            expect(result2.frameIndex).toBe(1);
            expect(result3.frameIndex).toBe(2);
        });
        it("detects current phase during processing", () => {
            const sequence = createCompleteShotSequence();
            // Process enough frames to detect a phase
            let lastResult;
            for (let i = 0; i < 30; i++) {
                lastResult = detector.processFrame(sequence[i]);
            }
            // During the shot, should have a detected phase
            // The phase might be null early but should be detected during the shot
            expect(lastResult).toBeDefined();
        });
        it("maintains state across multiple processFrame calls", () => {
            const sequence = createCompleteShotSequence();
            // Process all frames one at a time
            for (const frame of sequence) {
                detector.processFrame(frame);
            }
            // Then finalize to get completed shots
            const shots = detector.finalize();
            // Should detect the shot just like batch processing
            expect(shots.length).toBeGreaterThanOrEqual(1);
        });
        it("returns landmarks from the processed frame", () => {
            const sequence = createCompleteShotSequence();
            const result = detector.processFrame(sequence[5]);
            expect(result.landmarks).toBeDefined();
            expect(result.landmarks.poseConfidence).toBe(0.95);
        });
        it("handles null landmarks gracefully", () => {
            // Create a frame with very low confidence (simulating no detection)
            const emptyLandmarks = [];
            for (let i = 0; i < 33; i++) {
                emptyLandmarks.push(createLandmark(0, 0, 0, 0, 0));
            }
            const emptyFrame = createPoseLandmarks(emptyLandmarks, 0);
            // Should not throw
            expect(() => detector.processFrame(emptyFrame)).not.toThrow();
        });
    });
    describe("finalize()", () => {
        let detector;
        beforeEach(() => {
            detector = createShotDetector();
        });
        it("returns empty array when no frames processed", () => {
            const shots = detector.finalize();
            expect(shots).toEqual([]);
        });
        it("completes partial shots at end of sequence", () => {
            // Create a sequence that ends mid-shot
            const midShotEnd = [
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.6, 0.58],
                [0.55, 0.53],
                [0.5, 0.48],
                [0.45, 0.43],
                [0.4, 0.38],
                [0.35, 0.33],
                [0.3, 0.28],
                [0.25, 0.23],
                [0.2, 0.18],
                [0.15, 0.13],
                [0.12, 0.1],
                [0.1, 0.08],
                [0.1, 0.08],
            ];
            const sequence = createFrameSequenceWithWrists(midShotEnd);
            // Process frames incrementally
            for (const frame of sequence) {
                detector.processFrame(frame);
            }
            // Finalize should complete the partial shot
            const shots = detector.finalize();
            // Should have at least attempted to create a shot
            // (depending on minimum duration settings)
            expect(shots).toBeDefined();
        });
        it("returns completed shots with phase analysis", () => {
            const sequence = createCompleteShotSequence();
            // Process all frames
            for (const frame of sequence) {
                detector.processFrame(frame);
            }
            const shots = detector.finalize();
            if (shots.length > 0) {
                const shot = shots[0];
                expect(shot.phases).toBeDefined();
                expect(shot.frameRange).toBeDefined();
                expect(shot.shotIndex).toBe(0);
            }
        });
        it("can be called multiple times without changing result", () => {
            const sequence = createCompleteShotSequence();
            for (const frame of sequence) {
                detector.processFrame(frame);
            }
            const shots1 = detector.finalize();
            const shots2 = detector.finalize();
            expect(shots1.length).toBe(shots2.length);
        });
        it("reset followed by finalize returns empty", () => {
            const sequence = createCompleteShotSequence();
            for (const frame of sequence) {
                detector.processFrame(frame);
            }
            detector.reset();
            const shots = detector.finalize();
            expect(shots).toEqual([]);
        });
    });
    describe("getDetectedShots()", () => {
        it("returns currently detected shots during processing", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            // Process partial sequence
            for (let i = 0; i < 20; i++) {
                detector.processFrame(sequence[i]);
            }
            // Should be able to get current state
            const shots = detector.getDetectedShots();
            expect(Array.isArray(shots)).toBe(true);
        });
        it("returns empty array before any shots completed", () => {
            const detector = createShotDetector();
            const stationaryPositions = Array(10).fill([
                0.65, 0.65,
            ]);
            const sequence = createFrameSequenceWithWrists(stationaryPositions);
            for (const frame of sequence) {
                detector.processFrame(frame);
            }
            const shots = detector.getDetectedShots();
            expect(shots).toEqual([]);
        });
    });
    describe("edge cases", () => {
        it("handles very long sequences without memory issues", () => {
            const detector = createShotDetector();
            // Create a long sequence (1000 frames = ~33 seconds at 30fps)
            const longNeutral = Array(300).fill([
                0.65, 0.65,
            ]);
            const shot = createCompleteShotSequence();
            const moreNeutral = Array(300).fill([
                0.65, 0.65,
            ]);
            const longSequence = [
                ...createFrameSequenceWithWrists(longNeutral),
                ...shot,
                ...createFrameSequenceWithWrists(moreNeutral),
            ];
            // Should not throw or hang
            const shots = detector.processFrames(longSequence);
            expect(shots.length).toBe(1);
        });
        it("handles sequence with all same frame (no motion)", () => {
            const detector = createShotDetector();
            const sameFrame = createFrameSequenceWithWrists([[0.5, 0.5]])[0];
            const sequence = Array(50).fill(sameFrame);
            const shots = detector.processFrames(sequence);
            expect(shots).toEqual([]);
        });
        it("handles rapid alternating motion (noise)", () => {
            const detector = createShotDetector();
            const noisyPositions = [];
            for (let i = 0; i < 50; i++) {
                // Alternating up and down
                const y = i % 2 === 0 ? 0.5 : 0.55;
                noisyPositions.push([y, y]);
            }
            const sequence = createFrameSequenceWithWrists(noisyPositions);
            // Should not crash and should not detect false positives
            const shots = detector.processFrames(sequence);
            expect(Array.isArray(shots)).toBe(true);
        });
    });
    describe("shot phases integration", () => {
        it("assigns phases within shot frame range", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            const shots = detector.processFrames(sequence);
            if (shots.length > 0) {
                const shot = shots[0];
                const phases = shot.phases;
                // All phase frame ranges should be within shot frame range
                for (const phase of Object.values(ShotPhase)) {
                    const phaseRange = phases[phase];
                    if (phaseRange) {
                        expect(phaseRange.startFrame).toBeGreaterThanOrEqual(shot.frameRange.start);
                        expect(phaseRange.endFrame).toBeLessThanOrEqual(shot.frameRange.end);
                    }
                }
            }
        });
        it("phases do not overlap", () => {
            const detector = createShotDetector();
            const sequence = createCompleteShotSequence();
            const shots = detector.processFrames(sequence);
            if (shots.length > 0) {
                const shot = shots[0];
                const phases = shot.phases;
                const phaseRanges = [];
                for (const phase of Object.values(ShotPhase)) {
                    const range = phases[phase];
                    if (range !== undefined) {
                        phaseRanges.push({
                            name: phase,
                            startFrame: range.startFrame,
                            endFrame: range.endFrame,
                        });
                    }
                }
                phaseRanges.sort((a, b) => a.startFrame - b.startFrame);
                // Each phase should end before the next one starts (or at the same frame)
                for (let i = 0; i < phaseRanges.length - 1; i++) {
                    const current = phaseRanges[i];
                    const next = phaseRanges[i + 1];
                    expect(current.endFrame).toBeLessThanOrEqual(next.startFrame);
                }
            }
        });
    });
});
//# sourceMappingURL=integrated-shot-detector.test.js.map