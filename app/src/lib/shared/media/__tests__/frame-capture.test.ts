import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	startFrameCapture,
	createLiveFrameCapture,
	type FrameData
} from "../frame-capture";

describe("startFrameCapture", () => {
	let mockVideo: HTMLVideoElement;
	let capturedFrames: FrameData[];

	beforeEach(() => {
		vi.useFakeTimers();
		capturedFrames = [];

		// Create a mock video element with valid dimensions.
		mockVideo = {
			videoWidth: 640,
			videoHeight: 480,
			readyState: 4 // HAVE_ENOUGH_DATA
		} as HTMLVideoElement;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("captures frames at the configured FPS", () => {
		const handle = startFrameCapture(
			mockVideo,
			(frame) => capturedFrames.push(frame),
			{ fps: 10 }
		);

		expect(handle.running).toBe(true);

		// Advance time by 500ms (should capture ~5 frames at 10fps).
		vi.advanceTimersByTime(500);

		// First frame is captured immediately, then ~5 more at intervals.
		expect(capturedFrames.length).toBeGreaterThanOrEqual(5);

		handle.stop();
		expect(handle.running).toBe(false);
	});

	it("skips capture when video is not ready", () => {
		mockVideo.readyState = 1; // HAVE_METADATA but not enough data

		const handle = startFrameCapture(mockVideo, (frame) =>
			capturedFrames.push(frame)
		);

		vi.advanceTimersByTime(200);

		// No frames captured because video is not ready.
		expect(capturedFrames.length).toBe(0);

		handle.stop();
	});

	it("skips capture when video has no dimensions", () => {
		mockVideo.videoWidth = 0;
		mockVideo.videoHeight = 0;

		const handle = startFrameCapture(mockVideo, (frame) =>
			capturedFrames.push(frame)
		);

		vi.advanceTimersByTime(200);

		expect(capturedFrames.length).toBe(0);

		handle.stop();
	});

	it("increments frame index and timestamp", () => {
		const handle = startFrameCapture(
			mockVideo,
			(frame) => capturedFrames.push(frame),
			{ fps: 30 }
		);

		vi.advanceTimersByTime(100);
		handle.stop();

		expect(capturedFrames.length).toBeGreaterThan(0);

		// Check frame indices are sequential.
		for (let i = 0; i < capturedFrames.length; i++) {
			expect(capturedFrames[i].frameIndex).toBe(i);
		}

		// Check timestamps are increasing.
		for (let i = 1; i < capturedFrames.length; i++) {
			expect(capturedFrames[i].timestamp).toBeGreaterThanOrEqual(
				capturedFrames[i - 1].timestamp
			);
		}
	});

	it("stops capturing when stop() is called", () => {
		const handle = startFrameCapture(mockVideo, (frame) =>
			capturedFrames.push(frame)
		);

		vi.advanceTimersByTime(100);
		const countBeforeStop = capturedFrames.length;

		handle.stop();

		vi.advanceTimersByTime(100);
		const countAfterStop = capturedFrames.length;

		// No new frames after stop.
		expect(countAfterStop).toBe(countBeforeStop);
	});
});

describe("createLiveFrameCapture", () => {
	it("returns null when session has no pushFrame method", () => {
		const mockVideo = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
		const session = {}; // No pushFrame method

		const handle = createLiveFrameCapture(mockVideo, session);

		expect(handle).toBeNull();
	});

	it("creates a frame capture when session has pushFrame", () => {
		vi.useFakeTimers();

		const mockVideo = {
			videoWidth: 640,
			videoHeight: 480,
			readyState: 4
		} as HTMLVideoElement;
		const frames: FrameData[] = [];
		const session = {
			pushFrame: (frame: FrameData) => frames.push(frame)
		};

		const handle = createLiveFrameCapture(mockVideo, session);

		expect(handle).not.toBeNull();
		expect(handle!.running).toBe(true);

		vi.advanceTimersByTime(100);
		handle!.stop();

		expect(frames.length).toBeGreaterThan(0);

		vi.useRealTimers();
	});
});
