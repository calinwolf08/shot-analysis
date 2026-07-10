import { describe, expect, it } from "vitest";
import { createFakeIdGenerator, uuidIdGenerator } from "../id";

describe("uuidIdGenerator", () => {
  it("returns unique UUID-shaped ids", () => {
    const a = uuidIdGenerator.next();
    const b = uuidIdGenerator.next();
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("createFakeIdGenerator", () => {
  it("returns sequential prefixed ids", () => {
    const gen = createFakeIdGenerator("test");
    expect(gen.next()).toBe("test-1");
    expect(gen.next()).toBe("test-2");
    expect(gen.count).toBe(2);
  });

  it("uses the default prefix", () => {
    expect(createFakeIdGenerator().next()).toBe("id-1");
  });
});
