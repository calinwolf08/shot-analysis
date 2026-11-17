import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEBUG_ROUTES } from "../debug-routes";

describe("debug index", () => {
  it("lists every /__debug route folder", () => {
    const dir = join(process.cwd(), "src", "routes", "__debug");
    const folders = readdirSync(dir)
      .filter(
        (d) => !d.startsWith("__") && statSync(join(dir, d)).isDirectory(),
      )
      .map((d) => `/__debug/${d}`)
      .sort();
    expect(DEBUG_ROUTES.map((r) => r.path).sort()).toEqual(folders);
  });
});
