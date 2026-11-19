import { describe, expect, it } from "vitest";
import {
  parsePositioningScript,
  scriptFrames,
} from "../replay/positioning-script";

describe("parsePositioningScript", () => {
  it("parses kinds with optional seconds", () => {
    expect(parsePositioningScript("facing:3,side,none:0.5")).toEqual([
      { kind: "facing", seconds: 3 },
      { kind: "side", seconds: 4 },
      { kind: "none", seconds: 0.5 },
    ]);
  });
  it("skips garbage", () => {
    expect(
      parsePositioningScript("bogus:2,side:-1,side:x,wrongside:1"),
    ).toEqual([{ kind: "wrongside", seconds: 1 }]);
    expect(parsePositioningScript(null)).toEqual([]);
  });
});

describe("scriptFrames", () => {
  it("expands to fps-spaced frames from t=0", () => {
    const f = scriptFrames(
      [
        { kind: "side", seconds: 1 },
        { kind: "none", seconds: 1 },
      ],
      30,
      "right",
    );
    expect(f).toHaveLength(60);
    expect(f[0]!.timestamp).toBe(0);
    expect(f[59]!.frameIndex).toBe(59);
    expect(f[29]!.landmarks).not.toBeNull();
    expect(f[30]!.landmarks).toBeNull();
  });
  it("puts the shooting side nearest for 'side' and the guide side for 'wrongside'", () => {
    const [side] = scriptFrames([{ kind: "side", seconds: 0.1 }], 30, "right");
    const [wrong] = scriptFrames(
      [{ kind: "wrongside", seconds: 0.1 }],
      30,
      "right",
    );
    // Right shoulder (12) nearer (smaller z) and clearer in "side".
    expect(side!.landmarks![12]!.z).toBeLessThan(side!.landmarks![11]!.z);
    expect(side!.landmarks![12]!.visibility).toBeGreaterThan(
      side!.landmarks![11]!.visibility,
    );
    expect(wrong!.landmarks![11]!.z).toBeLessThan(wrong!.landmarks![12]!.z);
  });
});
