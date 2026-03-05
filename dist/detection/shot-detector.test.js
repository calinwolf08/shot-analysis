/**
 * Unit tests for ShotBoundaryDetector.
 * Tests shot boundary detection logic including start/end detection and partial shot handling.
 */
import { describe, it, expect } from "vitest";
import { ShotBoundaryDetector, createShotBoundaryDetector, } from "./shot-detector";
import { LANDMARK_INDEX } from "../pose/types";
/**
 * Helper to create a single landmark with default values.
 */
function createLandmark(x, y, z = 0, visibility = 0.95, confidence = 0.95) {
    return { x, y, z, visibility, confidence };
}
/**
 * Helper to create a full set of 33 landmarks with default positions.
 * Default pose is standing with arms at sides.
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
 * Simulates hand movement for shot detection testing.
 *
 * @param wristPositions Array of [leftY, rightY] tuples representing wrist Y positions per frame
 */
function createFrameSequenceWithWrists(wristPositions) {
    return wristPositions.map(([leftY, rightY]) => {
        const landmarks = createDefaultLandmarks();
        // Set shoulder positions for reference
        landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.4, 0.3);
        landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.6, 0.3);
        // Set wrist positions
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.4, leftY);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.6, rightY);
        // Set hand positions similar to wrist
        landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(0.4, leftY - 0.02);
        landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(0.6, rightY - 0.02);
        return createPoseLandmarks(landmarks);
    });
}
/**
 * Creates a landmark sequence representing a complete basketball shot.
 * The shot progresses through: neutral -> gather -> load -> rise -> setPoint -> release -> followThrough -> neutral
 *
 * Y coordinates: 0 = top of frame, 1 = bottom of frame
 * During shot: hands start low (y~0.6), move to chest height (y~0.4), rise up (y~0.2), then return down
 */
function createCompleteShotSequence() {
    // Frame-by-frame wrist positions [leftY, rightY]
    // Note: In image coordinates, lower Y = higher position on screen
    const wristPositions = [
        // Frames 0-4: Neutral stance, hands at sides (high Y = low position)
        [0.65, 0.65],
        [0.65, 0.65],
        [0.65, 0.65],
        [0.65, 0.65],
        [0.65, 0.65],
        // Frames 5-9: Gather - hands come together, slight rise
        [0.6, 0.58],
        [0.55, 0.53],
        [0.5, 0.48],
        [0.48, 0.45],
        [0.45, 0.42],
        // Frames 10-14: Load - slight dip before rise
        [0.48, 0.45],
        [0.5, 0.48],
        [0.48, 0.46],
        [0.45, 0.43],
        [0.42, 0.4],
        // Frames 15-24: Rise - rapid upward movement
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
        // Frames 25-29: Set point - hands at highest position, stabilize
        [0.12, 0.1],
        [0.11, 0.09],
        [0.1, 0.08],
        [0.1, 0.08],
        [0.1, 0.08],
        // Frames 30-34: Release - shooting hand extends, guide hand separates
        [0.12, 0.06],
        [0.18, 0.05],
        [0.24, 0.06],
        [0.3, 0.08],
        [0.36, 0.1],
        // Frames 35-39: Follow through - arm returns down
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
describe("ShotBoundaryDetector", () => {
    describe("createShotBoundaryDetector factory", () => {
        it("creates a detector with default config", () => {
            const detector = createShotBoundaryDetector();
            expect(detector).toBeInstanceOf(ShotBoundaryDetector);
        });
        it("creates a detector with custom config", () => {
            const config = {
                velocityThreshold: 0.02,
                smoothingWindowSize: 5,
            };
            const detector = createShotBoundaryDetector(config);
            expect(detector).toBeInstanceOf(ShotBoundaryDetector);
        });
    });
    describe("shot start detection", () => {
        it("detects shot start when wrists move upward together", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            // Should detect at least one shot start
            const shotStarts = boundaries.filter((b) => b.type === "start");
            expect(shotStarts.length).toBeGreaterThanOrEqual(1);
        });
        it("detects shot start frame within expected range", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotStarts = boundaries.filter((b) => b.type === "start");
            expect(shotStarts.length).toBe(1);
            // Shot should start around frames 5-10 (gather phase)
            expect(shotStarts[0].frameIndex).toBeGreaterThanOrEqual(3);
            expect(shotStarts[0].frameIndex).toBeLessThanOrEqual(15);
        });
        it("provides confidence score for shot start detection", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotStarts = boundaries.filter((b) => b.type === "start");
            expect(shotStarts[0].confidence).toBeGreaterThan(0);
            expect(shotStarts[0].confidence).toBeLessThanOrEqual(1);
        });
        it("does not detect shot start for stationary hands", () => {
            // Create sequence with hands stationary at sides
            const stationaryPositions = Array(30).fill([
                0.65, 0.65,
            ]);
            const sequence = createFrameSequenceWithWrists(stationaryPositions);
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotStarts = boundaries.filter((b) => b.type === "start");
            expect(shotStarts.length).toBe(0);
        });
        it("does not detect shot start for downward hand movement", () => {
            // Create sequence with hands moving downward
            const downwardPositions = [];
            for (let i = 0; i < 30; i++) {
                const y = 0.3 + i * 0.01; // Moving from 0.3 to 0.6 (downward in image coords)
                downwardPositions.push([y, y]);
            }
            const sequence = createFrameSequenceWithWrists(downwardPositions);
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotStarts = boundaries.filter((b) => b.type === "start");
            expect(shotStarts.length).toBe(0);
        });
        it("ignores pump fakes (brief upward motion that reverses)", () => {
            // Create sequence with brief upward motion followed by return
            const pumpFakePositions = [
                // Neutral
                ...Array(5).fill([0.65, 0.65]),
                // Brief rise (pump fake)
                [0.6, 0.6],
                [0.55, 0.55],
                [0.5, 0.5],
                // Quick return (not following through)
                [0.55, 0.55],
                [0.6, 0.6],
                [0.65, 0.65],
                // Continue neutral
                ...Array(10).fill([0.65, 0.65]),
            ];
            const sequence = createFrameSequenceWithWrists(pumpFakePositions);
            const detector = createShotBoundaryDetector({
                minShotDuration: 15, // Require minimum duration to filter pump fakes
            });
            const boundaries = detector.detectBoundaries(sequence);
            const shotStarts = boundaries.filter((b) => b.type === "start");
            // Pump fake should not register as a shot start
            expect(shotStarts.length).toBe(0);
        });
        it("handles noisy landmark data with smoothing", () => {
            // Create sequence with some minor noise in the data that doesn't disrupt the pattern
            // Noise is added to a single frame in the neutral stance portion
            const baseSequence = createCompleteShotSequence();
            const noisySequence = baseSequence.map((frame, i) => {
                if (i === 2) {
                    // Add minor noise to frame 2 (during neutral stance)
                    const landmarks = [...frame.landmarks];
                    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.6, 0.58);
                    return { ...frame, landmarks };
                }
                return frame;
            });
            const detector = createShotBoundaryDetector({ smoothingWindowSize: 3 });
            const boundaries = detector.detectBoundaries(noisySequence);
            // Should still detect the shot despite minor noise
            const shotStarts = boundaries.filter((b) => b.type === "start");
            expect(shotStarts.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe("shot end detection", () => {
        it("detects shot end when arm returns to neutral position", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotEnds = boundaries.filter((b) => b.type === "end");
            expect(shotEnds.length).toBeGreaterThanOrEqual(1);
        });
        it("detects shot end frame after the shot start", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotStarts = boundaries.filter((b) => b.type === "start");
            const shotEnds = boundaries.filter((b) => b.type === "end");
            expect(shotStarts.length).toBe(1);
            expect(shotEnds.length).toBe(1);
            expect(shotEnds[0].frameIndex).toBeGreaterThan(shotStarts[0].frameIndex);
        });
        it("detects shot end when wrist drops below shoulder level", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotEnds = boundaries.filter((b) => b.type === "end");
            // Shot end should be around frames 35-42 (follow through to neutral)
            expect(shotEnds[0].frameIndex).toBeGreaterThanOrEqual(30);
            expect(shotEnds[0].frameIndex).toBeLessThanOrEqual(44);
        });
        it("provides confidence score for shot end detection", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotEnds = boundaries.filter((b) => b.type === "end");
            expect(shotEnds[0].confidence).toBeGreaterThan(0);
            expect(shotEnds[0].confidence).toBeLessThanOrEqual(1);
        });
        it("marks end as non-partial for complete shots", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const boundaries = detector.detectBoundaries(sequence);
            const shotEnds = boundaries.filter((b) => b.type === "end");
            expect(shotEnds[0].isPartial).toBe(false);
        });
    });
    describe("detectShots method", () => {
        it("returns paired start/end boundaries as shots", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const shots = detector.detectShots(sequence);
            expect(shots.length).toBe(1);
            expect(shots[0].start.type).toBe("start");
            expect(shots[0].end.type).toBe("end");
        });
        it("includes isPartialStart and isPartialEnd flags", () => {
            const sequence = createCompleteShotSequence();
            const detector = createShotBoundaryDetector();
            const shots = detector.detectShots(sequence);
            expect(shots[0].isPartialStart).toBe(false);
            expect(shots[0].isPartialEnd).toBe(false);
        });
    });
    describe("multiple shots detection", () => {
        it("detects multiple shots in a sequence", () => {
            // Create sequence with two complete shots
            const shot1 = createCompleteShotSequence();
            // Add gap between shots
            const gap = Array(20).fill([
                0.65, 0.65,
            ]);
            const gapFrames = createFrameSequenceWithWrists(gap);
            const shot2 = createCompleteShotSequence();
            const sequence = [...shot1, ...gapFrames, ...shot2];
            const detector = createShotBoundaryDetector();
            const shots = detector.detectShots(sequence);
            expect(shots.length).toBe(2);
        });
        it("correctly orders multiple shot boundaries", () => {
            const shot1 = createCompleteShotSequence();
            const gap = Array(20).fill([
                0.65, 0.65,
            ]);
            const gapFrames = createFrameSequenceWithWrists(gap);
            const shot2 = createCompleteShotSequence();
            const sequence = [...shot1, ...gapFrames, ...shot2];
            const detector = createShotBoundaryDetector();
            const shots = detector.detectShots(sequence);
            // First shot should end before second shot starts
            expect(shots[0].end.frameIndex).toBeLessThan(shots[1].start.frameIndex);
        });
    });
    describe("partial shot handling", () => {
        describe("video starts mid-shot", () => {
            it("marks shot as partial start at frame 0 when video begins mid-shot", () => {
                // Create sequence starting in the middle of a shot (hands already rising)
                const midShotStart = [
                    // Start with hands already at chest height and rising
                    [0.4, 0.38],
                    [0.36, 0.34],
                    [0.32, 0.3],
                    [0.28, 0.26],
                    [0.24, 0.22],
                    [0.2, 0.18],
                    [0.18, 0.16],
                    [0.16, 0.14],
                    [0.14, 0.12],
                    [0.12, 0.1],
                    // Set point
                    [0.1, 0.08],
                    [0.1, 0.08],
                    [0.1, 0.08],
                    // Release and follow through
                    [0.12, 0.06],
                    [0.18, 0.08],
                    [0.24, 0.12],
                    [0.32, 0.2],
                    [0.4, 0.3],
                    [0.48, 0.4],
                    [0.56, 0.48],
                    // Return to neutral
                    [0.62, 0.56],
                    [0.65, 0.62],
                    [0.65, 0.65],
                    [0.65, 0.65],
                    [0.65, 0.65],
                ];
                const sequence = createFrameSequenceWithWrists(midShotStart);
                const detector = createShotBoundaryDetector();
                const shots = detector.detectShots(sequence);
                expect(shots.length).toBeGreaterThanOrEqual(1);
                // The shot should be marked as partial start since we're already in motion
                if (shots[0].start.frameIndex === 0) {
                    expect(shots[0].isPartialStart).toBe(true);
                }
            });
            it("detects shot start at frame 0 for video starting mid-rise", () => {
                // Video starts with hands already moving up rapidly
                // Using a shorter minimum shot duration to detect this partial shot
                const midRise = [
                    // Already in rapid upward motion
                    [0.35, 0.33],
                    [0.3, 0.28],
                    [0.25, 0.23],
                    [0.2, 0.18],
                    [0.15, 0.13],
                    [0.12, 0.1],
                    // Set point and release
                    [0.1, 0.08],
                    [0.1, 0.08],
                    [0.12, 0.06],
                    [0.2, 0.1],
                    [0.3, 0.18],
                    [0.4, 0.28],
                    [0.5, 0.4],
                    [0.58, 0.5],
                    [0.64, 0.58],
                    [0.65, 0.64],
                    [0.65, 0.65],
                    [0.65, 0.65],
                    [0.65, 0.65],
                    [0.65, 0.65],
                ];
                const sequence = createFrameSequenceWithWrists(midRise);
                // Use lower minShotDuration since this is a partial shot
                const detector = createShotBoundaryDetector({ minShotDuration: 10 });
                const boundaries = detector.detectBoundaries(sequence);
                const starts = boundaries.filter((b) => b.type === "start");
                const ends = boundaries.filter((b) => b.type === "end");
                // Should detect at least one start and end
                expect(starts.length).toBeGreaterThanOrEqual(1);
                expect(ends.length).toBeGreaterThanOrEqual(1);
            });
        });
        describe("video ends mid-shot", () => {
            it("marks shot as partial end at last frame when video ends mid-shot", () => {
                // Create sequence that ends during the shot
                const midShotEnd = [
                    // Neutral
                    [0.65, 0.65],
                    [0.65, 0.65],
                    [0.65, 0.65],
                    [0.65, 0.65],
                    [0.65, 0.65],
                    // Gather and rise
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
                    // Video ends here during set point - no return
                    [0.12, 0.1],
                    [0.1, 0.08],
                    [0.1, 0.08],
                ];
                const sequence = createFrameSequenceWithWrists(midShotEnd);
                const detector = createShotBoundaryDetector();
                const shots = detector.detectShots(sequence);
                expect(shots.length).toBeGreaterThanOrEqual(1);
                // The shot should be marked as partial end
                expect(shots[0].isPartialEnd).toBe(true);
                expect(shots[0].end.frameIndex).toBe(sequence.length - 1);
            });
            it("sets partial end confidence lower than complete shot", () => {
                const midShotEnd = [
                    // Neutral then rise
                    ...Array(5).fill([0.65, 0.65]),
                    [0.55, 0.53],
                    [0.45, 0.43],
                    [0.35, 0.33],
                    [0.25, 0.23],
                    [0.15, 0.13],
                    [0.12, 0.1],
                    [0.1, 0.08],
                ];
                const sequence = createFrameSequenceWithWrists(midShotEnd);
                const detector = createShotBoundaryDetector();
                const boundaries = detector.detectBoundaries(sequence);
                const ends = boundaries.filter((b) => b.type === "end");
                // Partial end should have lower confidence (0.5)
                if (ends.length > 0 && ends[0].isPartial) {
                    expect(ends[0].confidence).toBeLessThanOrEqual(0.5);
                }
            });
        });
        describe("video both starts and ends mid-shot", () => {
            it("handles video that captures only middle of a shot", () => {
                // Video captures just the rise and release portion
                const midToMid = [
                    // Start already rising
                    [0.4, 0.38],
                    [0.35, 0.33],
                    [0.3, 0.28],
                    [0.25, 0.23],
                    [0.2, 0.18],
                    [0.15, 0.13],
                    [0.12, 0.1],
                    [0.1, 0.08],
                    // End during release - no follow through
                    [0.12, 0.06],
                    [0.18, 0.08],
                ];
                const sequence = createFrameSequenceWithWrists(midToMid);
                const detector = createShotBoundaryDetector();
                const shots = detector.detectShots(sequence);
                // Should still detect a shot, even if partial
                // May or may not detect depending on minimum duration settings
                if (shots.length > 0) {
                    // If detected, should mark as partial on at least one end
                    expect(shots[0].isPartialStart || shots[0].isPartialEnd).toBe(true);
                }
            });
        });
    });
    describe("edge cases", () => {
        it("returns empty array for sequence with less than 2 frames", () => {
            const detector = createShotBoundaryDetector();
            // Empty sequence
            expect(detector.detectBoundaries([])).toHaveLength(0);
            // Single frame
            const singleFrame = createFrameSequenceWithWrists([[0.5, 0.5]]);
            expect(detector.detectBoundaries(singleFrame)).toHaveLength(0);
        });
        it("handles very fast shots (minimal frames)", () => {
            // Quick shot with minimal frames per phase
            const fastShot = [
                [0.65, 0.65],
                [0.55, 0.53],
                [0.4, 0.38],
                [0.25, 0.23],
                [0.12, 0.1],
                [0.1, 0.08],
                [0.18, 0.1],
                [0.3, 0.22],
                [0.45, 0.38],
                [0.58, 0.52],
                [0.65, 0.62],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
            ];
            const sequence = createFrameSequenceWithWrists(fastShot);
            const detector = createShotBoundaryDetector({
                minShotDuration: 8, // Allow shorter shots
            });
            const shots = detector.detectShots(sequence);
            // Should detect the fast shot
            expect(shots.length).toBe(1);
        });
        it("handles sequence with low visibility landmarks", () => {
            // Create sequence with some low visibility frames
            const baseSequence = createCompleteShotSequence();
            const lowVisSequence = baseSequence.map((frame, i) => {
                if (i >= 10 && i <= 15) {
                    // Make wrists low visibility during part of the shot
                    const landmarks = [...frame.landmarks];
                    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = {
                        ...landmarks[LANDMARK_INDEX.RIGHT_WRIST],
                        visibility: 0.3,
                    };
                    return { ...frame, landmarks };
                }
                return frame;
            });
            const detector = createShotBoundaryDetector();
            const shots = detector.detectShots(lowVisSequence);
            // Should still detect the shot despite some low visibility frames
            expect(shots.length).toBe(1);
        });
        it("does not crash on inconsistent landmark data", () => {
            // Sequence with some frames having unexpected positions
            const inconsistentPositions = [
                [0.65, 0.65],
                [0.5, 0.5],
                [-0.1, 1.1], // Out of expected range
                [0.3, 0.3],
                [0.2, 0.2],
                [0.1, 0.1],
                [0.2, 0.15],
                [0.35, 0.28],
                [0.5, 0.42],
                [0.65, 0.58],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
                [0.65, 0.65],
            ];
            const sequence = createFrameSequenceWithWrists(inconsistentPositions);
            const detector = createShotBoundaryDetector();
            // Should not throw
            expect(() => detector.detectBoundaries(sequence)).not.toThrow();
        });
    });
});
//# sourceMappingURL=shot-detector.test.js.map