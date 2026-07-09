import { describe, expect, it, vi } from "vitest";
import {
  computeDownsampleSize,
  downsampleToImageData,
  type CanvasLike,
} from "../downsample";

describe("computeDownsampleSize", () => {
  it("keeps small frames untouched", () => {
    expect(computeDownsampleSize(320, 240, 640)).toEqual({
      width: 320,
      height: 240,
      scale: 1,
    });
  });

  it("scales landscape down to the max edge", () => {
    const s = computeDownsampleSize(1920, 1080, 640);
    expect(s.width).toBe(640);
    expect(s.height).toBe(360);
    expect(s.scale).toBeCloseTo(1 / 3);
  });

  it("scales portrait down to the max edge", () => {
    const s = computeDownsampleSize(1080, 1920, 640);
    expect(s.height).toBe(640);
    expect(s.width).toBe(360);
  });

  it("never upscales at exact boundary", () => {
    expect(computeDownsampleSize(640, 480, 640).scale).toBe(1);
  });

  it("rejects invalid sizes", () => {
    expect(() => computeDownsampleSize(0, 100, 640)).toThrow();
    expect(() => computeDownsampleSize(100, -1, 640)).toThrow();
  });

  it("preserves aspect ratio within rounding", () => {
    const s = computeDownsampleSize(1234, 771, 500);
    expect(s.width).toBe(500);
    expect(Math.abs(s.height / s.width - 771 / 1234)).toBeLessThan(0.01);
  });
});

describe("downsampleToImageData", () => {
  it("draws into a canvas at target size and returns its ImageData", () => {
    const drawImage = vi.fn();
    const fakeImageData = { width: 640, height: 360 };
    const getImageData = vi.fn(() => fakeImageData as ImageData);
    const factory = vi.fn(
      (width: number, height: number): CanvasLike => ({
        width,
        height,
        getContext: () => ({ drawImage, getImageData }),
      }),
    );

    const source = {} as CanvasImageSource;
    const out = downsampleToImageData(source, 1920, 1080, 640, factory);

    expect(factory).toHaveBeenCalledWith(640, 360);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 640, 360);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(out).toBe(fakeImageData);
  });

  it("throws when the context is unavailable", () => {
    const factory = (): CanvasLike => ({
      width: 1,
      height: 1,
      getContext: () => null,
    });
    expect(() =>
      downsampleToImageData({} as CanvasImageSource, 100, 100, 50, factory),
    ).toThrow(/context/);
  });
});
