import { describe, expect, it } from "vitest";
import { formatVideoTime } from "../services/frame-thumbnails";

describe("formatVideoTime", () => {
  it("formats seconds as m:ss.t", () => {
    expect(formatVideoTime(0)).toBe("0:00.0");
    expect(formatVideoTime(1.56)).toBe("0:01.5");
    expect(formatVideoTime(59.99)).toBe("0:59.9");
    expect(formatVideoTime(61.2)).toBe("1:01.2");
    expect(formatVideoTime(600)).toBe("10:00.0");
  });
});
