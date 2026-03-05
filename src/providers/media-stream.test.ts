/**
 * Unit tests for MediaStreamProvider class.
 * Following TDD: tests are written BEFORE implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FrameProvider } from "./types";

// Mock browser APIs
const mockVideoElement = {
  srcObject: null as MediaStream | null,
  videoWidth: 0,
  videoHeight: 0,
  readyState: 0,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockCanvasContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray(640 * 480 * 4),
  }),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn().mockReturnValue(mockCanvasContext),
};

// Mock document.createElement
const originalCreateElement = global.document?.createElement;

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  mockVideoElement.srcObject = null;
  mockVideoElement.videoWidth = 640;
  mockVideoElement.videoHeight = 480;
  mockVideoElement.readyState = 4; // HAVE_ENOUGH_DATA

  // Mock document.createElement
  global.document = {
    createElement: vi.fn((tag: string) => {
      if (tag === "video")
        return mockVideoElement as unknown as HTMLVideoElement;
      if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return {} as HTMLElement;
    }),
  } as unknown as Document;
});

afterEach(() => {
  if (originalCreateElement) {
    global.document = {
      createElement: originalCreateElement,
    } as unknown as Document;
  }
});

// Create mock MediaStream
function createMockMediaStream(active = true): MediaStream {
  const mockTrack = {
    getSettings: () => ({ width: 640, height: 480, frameRate: 30 }),
    readyState: "live" as MediaStreamTrackState,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  return {
    active,
    getVideoTracks: () => [mockTrack],
    getTracks: () => [mockTrack],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream;
}

// Import after mocking
import {
  MediaStreamProvider,
  createMediaStreamProvider,
  MediaStreamEndedError,
  MediaStreamInactiveError,
  NoVideoTrackError,
} from "./media-stream";

describe("MediaStreamProvider", () => {
  describe("constructor and error cases", () => {
    describe("MediaStreamEndedError", () => {
      it("extends Error", () => {
        const error = new MediaStreamEndedError();
        expect(error).toBeInstanceOf(Error);
      });

      it("has correct name", () => {
        const error = new MediaStreamEndedError();
        expect(error.name).toBe("MediaStreamEndedError");
      });

      it("has descriptive message", () => {
        const error = new MediaStreamEndedError();
        expect(error.message).toContain("stream");
        expect(error.message.toLowerCase()).toContain("ended");
      });
    });

    describe("MediaStreamInactiveError", () => {
      it("extends Error", () => {
        const error = new MediaStreamInactiveError();
        expect(error).toBeInstanceOf(Error);
      });

      it("has correct name", () => {
        const error = new MediaStreamInactiveError();
        expect(error.name).toBe("MediaStreamInactiveError");
      });

      it("has descriptive message", () => {
        const error = new MediaStreamInactiveError();
        expect(error.message).toContain("stream");
        expect(error.message.toLowerCase()).toContain("inactive");
      });
    });

    describe("NoVideoTrackError", () => {
      it("extends Error", () => {
        const error = new NoVideoTrackError();
        expect(error).toBeInstanceOf(Error);
      });

      it("has correct name", () => {
        const error = new NoVideoTrackError();
        expect(error.name).toBe("NoVideoTrackError");
      });

      it("has descriptive message", () => {
        const error = new NoVideoTrackError();
        expect(error.message).toContain("video track");
      });
    });
  });

  describe("createMediaStreamProvider factory", () => {
    it("returns a MediaStreamProvider instance", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);
      expect(provider).toBeInstanceOf(MediaStreamProvider);
    });

    it("throws MediaStreamInactiveError for inactive stream", async () => {
      const stream = createMockMediaStream(false);
      await expect(createMediaStreamProvider(stream)).rejects.toThrow(
        MediaStreamInactiveError,
      );
    });

    it("throws NoVideoTrackError when stream has no video tracks", async () => {
      const stream = {
        active: true,
        getVideoTracks: () => [],
        getTracks: () => [],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaStream;

      await expect(createMediaStreamProvider(stream)).rejects.toThrow(
        NoVideoTrackError,
      );
    });

    it("accepts optional fps parameter", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream, { fps: 15 });
      expect(provider.getFps()).toBe(15);
    });

    it("uses stream track frame rate by default", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);
      expect(provider.getFps()).toBe(30);
    });
  });

  describe("getMetadata()", () => {
    it("returns FrameMetadata with correct structure", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      const metadata = provider.getMetadata();
      expect(metadata.width).toBe(640);
      expect(metadata.height).toBe(480);
    });

    it("returns undefined duration for live streams", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      const metadata = provider.getMetadata();
      expect(metadata.duration).toBeUndefined();
    });
  });

  describe("getFps()", () => {
    it("returns the configured frame rate", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream, { fps: 24 });
      expect(provider.getFps()).toBe(24);
    });

    it("returns stream track frame rate when not configured", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);
      expect(provider.getFps()).toBe(30);
    });
  });

  describe("getNextFrame()", () => {
    it("returns first frame with frameIndex 0", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      const frame = await provider.getNextFrame();
      expect(frame).not.toBeNull();
      expect(frame!.frameIndex).toBe(0);
    });

    it("returns frames with incrementing frameIndex", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      const frame0 = await provider.getNextFrame();
      const frame1 = await provider.getNextFrame();
      const frame2 = await provider.getNextFrame();

      expect(frame0!.frameIndex).toBe(0);
      expect(frame1!.frameIndex).toBe(1);
      expect(frame2!.frameIndex).toBe(2);
    });

    it("returns frame with correct width and height", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      const frame = await provider.getNextFrame();
      expect(frame!.width).toBe(640);
      expect(frame!.height).toBe(480);
    });

    it("returns frame with RGBA data", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      const frame = await provider.getNextFrame();
      expect(frame!.data).toBeInstanceOf(Uint8ClampedArray);
      expect(frame!.data.length).toBe(640 * 480 * 4);
    });

    it("returns null when stream ends", async () => {
      const mockTrack = {
        getSettings: () => ({ width: 640, height: 480, frameRate: 30 }),
        readyState: "ended" as MediaStreamTrackState,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const stream = {
        active: true,
        getVideoTracks: () => [mockTrack],
        getTracks: () => [mockTrack],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaStream;

      const provider = await createMediaStreamProvider(stream);

      // Simulate stream ending after creation
      mockTrack.readyState = "ended";
      (stream as { active: boolean }).active = false;

      const frame = await provider.getNextFrame();
      expect(frame).toBeNull();
    });
  });

  describe("stream attachment", () => {
    it("attaches stream to video element", async () => {
      const stream = createMockMediaStream();
      await createMediaStreamProvider(stream);

      expect(mockVideoElement.srcObject).toBe(stream);
    });

    it("calls video.play() after attachment", async () => {
      const stream = createMockMediaStream();
      await createMediaStreamProvider(stream);

      expect(mockVideoElement.play).toHaveBeenCalled();
    });
  });

  describe("frame extraction", () => {
    it("draws video frame to canvas", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      await provider.getNextFrame();

      expect(mockCanvasContext.drawImage).toHaveBeenCalledWith(
        mockVideoElement,
        0,
        0,
      );
    });

    it("extracts image data from canvas", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      await provider.getNextFrame();

      expect(mockCanvasContext.getImageData).toHaveBeenCalledWith(
        0,
        0,
        640,
        480,
      );
    });

    it("sets canvas dimensions to match video", async () => {
      const stream = createMockMediaStream();
      await createMediaStreamProvider(stream);

      expect(mockCanvas.width).toBe(640);
      expect(mockCanvas.height).toBe(480);
    });
  });

  describe("frame rate limiting", () => {
    it("calculates correct frame interval from fps", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream, { fps: 30 });

      // Frame interval should be ~33.33ms for 30fps
      const expectedInterval = 1000 / 30;
      expect((provider as MediaStreamProvider).getFrameInterval()).toBeCloseTo(
        expectedInterval,
      );
    });

    it("timestamps increase based on frame interval", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream, { fps: 30 });

      const frame0 = await provider.getNextFrame();
      const frame1 = await provider.getNextFrame();

      expect(frame0!.timestamp).toBe(0);
      expect(frame1!.timestamp).toBeCloseTo(1000 / 30);
    });

    it("applies frame rate limiting when fps is specified", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream, { fps: 10 });

      // At 10fps, frame interval should be 100ms
      expect((provider as MediaStreamProvider).getFrameInterval()).toBe(100);
    });
  });

  describe("FrameProvider interface compliance", () => {
    it("implements FrameProvider interface", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      // Type check: provider should satisfy FrameProvider
      const frameProvider: FrameProvider = provider;
      expect(typeof frameProvider.getNextFrame).toBe("function");
      expect(typeof frameProvider.getFps).toBe("function");
      expect(typeof frameProvider.getMetadata).toBe("function");
    });
  });

  describe("stream lifecycle", () => {
    it("handles stream ending gracefully", async () => {
      const mockTrack = {
        getSettings: () => ({ width: 640, height: 480, frameRate: 30 }),
        readyState: "live" as MediaStreamTrackState,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const stream = {
        active: true,
        getVideoTracks: () => [mockTrack],
        getTracks: () => [mockTrack],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaStream;

      const provider = await createMediaStreamProvider(stream);

      // Get a frame while stream is active
      const frame1 = await provider.getNextFrame();
      expect(frame1).not.toBeNull();

      // Simulate stream ending
      mockTrack.readyState = "ended";
      (stream as { active: boolean }).active = false;

      // Should return null gracefully
      const frame2 = await provider.getNextFrame();
      expect(frame2).toBeNull();
    });

    it("registers ended event listener on video track", async () => {
      const mockTrack = {
        getSettings: () => ({ width: 640, height: 480, frameRate: 30 }),
        readyState: "live" as MediaStreamTrackState,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const stream = {
        active: true,
        getVideoTracks: () => [mockTrack],
        getTracks: () => [mockTrack],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaStream;

      await createMediaStreamProvider(stream);

      expect(mockTrack.addEventListener).toHaveBeenCalledWith(
        "ended",
        expect.any(Function),
      );
    });
  });

  describe("dispose()", () => {
    it("pauses the video element", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      provider.dispose();

      expect(mockVideoElement.pause).toHaveBeenCalled();
    });

    it("clears video srcObject", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      provider.dispose();

      expect(mockVideoElement.srcObject).toBeNull();
    });

    it("returns null for getNextFrame after dispose", async () => {
      const stream = createMockMediaStream();
      const provider = await createMediaStreamProvider(stream);

      provider.dispose();

      const frame = await provider.getNextFrame();
      expect(frame).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("throws Error when canvas.getContext returns null", async () => {
      // Mock getContext to return null
      mockCanvas.getContext = vi.fn().mockReturnValue(null);

      const stream = createMockMediaStream();

      await expect(createMediaStreamProvider(stream)).rejects.toThrow(
        "Failed to get 2D rendering context",
      );

      // Reset mock for other tests
      mockCanvas.getContext = vi.fn().mockReturnValue(mockCanvasContext);
    });

    it("returns null when getVideoTracks returns empty array during getNextFrame", async () => {
      // Create a stream that initially has tracks
      const mockTrack = {
        getSettings: () => ({ width: 640, height: 480, frameRate: 30 }),
        readyState: "live" as MediaStreamTrackState,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      let trackArray = [mockTrack];

      const stream = {
        active: true,
        getVideoTracks: () => trackArray,
        getTracks: () => trackArray,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as MediaStream;

      const provider = await createMediaStreamProvider(stream);

      // Verify first frame works
      const frame1 = await provider.getNextFrame();
      expect(frame1).not.toBeNull();

      // Remove tracks to simulate track loss
      trackArray = [];

      // Should return null when no video tracks
      const frame2 = await provider.getNextFrame();
      expect(frame2).toBeNull();
    });
  });
});
