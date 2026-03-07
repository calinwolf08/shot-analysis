/**
 * Unit tests for server utility functions.
 */

import { describe, it, expect } from "vitest";

/**
 * Sanitizes a video filename for use as a directory name.
 * - Removes file extension
 * - Replaces spaces with hyphens
 * - Removes special characters (keeps alphanumeric, hyphens, underscores)
 * - Converts to lowercase
 *
 * Extracted here for testability.
 */
export function sanitizeVideoName(videoName: string): string {
  return videoName
    .replace(/\.[^.]+$/, "") // Remove file extension
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9_-]/g, "") // Remove special characters
    .toLowerCase();
}

describe("sanitizeVideoName", () => {
  describe("extension removal", () => {
    it("removes .mp4 extension", () => {
      expect(sanitizeVideoName("video.mp4")).toBe("video");
    });

    it("removes .mov extension", () => {
      expect(sanitizeVideoName("my-video.mov")).toBe("my-video");
    });

    it("removes .webm extension", () => {
      expect(sanitizeVideoName("test.webm")).toBe("test");
    });

    it("handles multiple dots (removes only last extension)", () => {
      expect(sanitizeVideoName("video.shot.1.mp4")).toBe("videoshot1");
    });

    it("handles no extension", () => {
      expect(sanitizeVideoName("video")).toBe("video");
    });
  });

  describe("space handling", () => {
    it("replaces single space with hyphen", () => {
      expect(sanitizeVideoName("my video.mp4")).toBe("my-video");
    });

    it("replaces multiple spaces with hyphens", () => {
      expect(sanitizeVideoName("my   video   file.mp4")).toBe("my-video-file");
    });

    it("handles leading/trailing spaces", () => {
      expect(sanitizeVideoName(" video .mp4")).toBe("-video-");
    });
  });

  describe("special character removal", () => {
    it("removes parentheses", () => {
      expect(sanitizeVideoName("video (1).mp4")).toBe("video-1");
    });

    it("removes brackets", () => {
      expect(sanitizeVideoName("video[test].mp4")).toBe("videotest");
    });

    it("removes apostrophes and quotes", () => {
      expect(sanitizeVideoName("john's video.mp4")).toBe("johns-video");
    });

    it("removes hash and ampersand", () => {
      expect(sanitizeVideoName("test#1&2.mp4")).toBe("test12");
    });

    it("removes @ and $ symbols", () => {
      expect(sanitizeVideoName("video@home$now.mp4")).toBe("videohomenow");
    });

    it("preserves hyphens", () => {
      expect(sanitizeVideoName("my-video-file.mp4")).toBe("my-video-file");
    });

    it("preserves underscores", () => {
      expect(sanitizeVideoName("my_video_file.mp4")).toBe("my_video_file");
    });
  });

  describe("case conversion", () => {
    it("converts uppercase to lowercase", () => {
      expect(sanitizeVideoName("MyVideo.MP4")).toBe("myvideo");
    });

    it("converts mixed case to lowercase", () => {
      expect(sanitizeVideoName("Basketball Shot Analysis.mp4")).toBe(
        "basketball-shot-analysis",
      );
    });
  });

  describe("combined transformations", () => {
    it("handles complex filename", () => {
      expect(sanitizeVideoName("My Shot (Copy 2) - Final.mov")).toBe(
        "my-shot-copy-2---final",
      );
    });

    it("handles filename with numbers", () => {
      expect(sanitizeVideoName("shot_2024_01_15.mp4")).toBe("shot_2024_01_15");
    });

    it("handles real-world example: basketball video", () => {
      expect(sanitizeVideoName("Basketball Free Throw Practice.mp4")).toBe(
        "basketball-free-throw-practice",
      );
    });

    it("handles real-world example: phone video", () => {
      expect(sanitizeVideoName("IMG_1234.MOV")).toBe("img_1234");
    });

    it("handles real-world example: screen recording", () => {
      expect(
        sanitizeVideoName("Screen Recording 2024-01-15 at 3.45.23 PM.mov"),
      ).toBe("screen-recording-2024-01-15-at-34523-pm");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(sanitizeVideoName("")).toBe("");
    });

    it("handles only extension", () => {
      expect(sanitizeVideoName(".mp4")).toBe("");
    });

    it("handles only special characters", () => {
      expect(sanitizeVideoName("@#$%.mp4")).toBe("");
    });

    it("handles unicode characters", () => {
      expect(sanitizeVideoName("vidéo.mp4")).toBe("vido");
    });
  });
});
