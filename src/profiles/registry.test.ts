/**
 * Unit tests for ProfileRegistry.
 * Following TDD: tests are written BEFORE implementation.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProfileRegistry, getProfileRegistry } from "./registry";
import type { FormProfile, MetricTarget } from "./types";
import { youthFundamentalsProfile } from "./youth";
import { highSchoolProfile } from "./high-school";
import { proFormProfile } from "./pro";

/**
 * Helper to create a valid test profile.
 */
function createTestProfile(
  name: string,
  targets: Record<string, MetricTarget> = {},
): FormProfile {
  return {
    name,
    description: `Test profile: ${name}`,
    targets,
  };
}

/**
 * Helper to create a numeric metric target.
 */
function createNumericTarget(
  ideal: number,
  min: number,
  max: number,
): MetricTarget {
  return {
    ideal,
    acceptable: { min, max },
    priority: "medium",
    feedback: {
      tooLow: `Value below ${min}`,
      tooHigh: `Value above ${max}`,
    },
  };
}

describe("ProfileRegistry", () => {
  describe("constructor and built-in profiles", () => {
    it("creates registry with built-in profiles pre-registered", () => {
      const registry = new ProfileRegistry();

      expect(registry.has("youth-fundamentals")).toBe(true);
      expect(registry.has("high-school")).toBe(true);
      expect(registry.has("pro-form")).toBe(true);
    });

    it("returns correct built-in profile objects", () => {
      const registry = new ProfileRegistry();

      expect(registry.get("youth-fundamentals")).toEqual(
        youthFundamentalsProfile,
      );
      expect(registry.get("high-school")).toEqual(highSchoolProfile);
      expect(registry.get("pro-form")).toEqual(proFormProfile);
    });

    it("lists all built-in profiles", () => {
      const registry = new ProfileRegistry();
      const names = registry.list();

      expect(names).toContain("youth-fundamentals");
      expect(names).toContain("high-school");
      expect(names).toContain("pro-form");
      expect(names.length).toBe(3);
    });

    it("creates isolated registry instances", () => {
      const registry1 = new ProfileRegistry();
      const registry2 = new ProfileRegistry();

      registry1.register(createTestProfile("custom-profile-1"));

      expect(registry1.has("custom-profile-1")).toBe(true);
      expect(registry2.has("custom-profile-1")).toBe(false);
    });
  });

  describe("registerProfile() with valid profiles", () => {
    let registry: ProfileRegistry;

    beforeEach(() => {
      registry = new ProfileRegistry();
    });

    it("registers a new custom profile", () => {
      const customProfile = createTestProfile("custom-profile", {
        elbowAngle: createNumericTarget(90, 85, 95),
      });

      registry.register(customProfile);

      expect(registry.has("custom-profile")).toBe(true);
      expect(registry.get("custom-profile")).toEqual(customProfile);
    });

    it("allows retrieving registered profile", () => {
      const customProfile = createTestProfile("my-profile", {
        releaseAngle: createNumericTarget(52, 45, 60),
      });

      registry.register(customProfile);
      const retrieved = registry.get("my-profile");

      expect(retrieved).toEqual(customProfile);
      expect(retrieved.name).toBe("my-profile");
    });

    it("includes custom profiles in list", () => {
      registry.register(createTestProfile("custom-1"));
      registry.register(createTestProfile("custom-2"));

      const names = registry.list();

      expect(names).toContain("custom-1");
      expect(names).toContain("custom-2");
      expect(names.length).toBe(5); // 3 built-in + 2 custom
    });

    it("registers profile with empty targets", () => {
      const emptyProfile = createTestProfile("empty-targets");

      registry.register(emptyProfile);

      expect(registry.has("empty-targets")).toBe(true);
      expect(registry.get("empty-targets")?.targets).toEqual({});
    });

    it("registers profile with categorical targets", () => {
      const categoricalProfile: FormProfile = {
        name: "categorical-profile",
        description: "Profile with categorical targets",
        targets: {
          handPosition: {
            ideal: "cup",
            acceptable: ["cup", "hinge", "neutral"],
            priority: "medium",
            feedback: {
              incorrect: "Invalid hand position",
            },
          },
        },
      };

      registry.register(categoricalProfile);

      expect(registry.has("categorical-profile")).toBe(true);
      expect(registry.get("categorical-profile")).toEqual(categoricalProfile);
    });
  });

  describe("registerProfile() with invalid profiles", () => {
    let registry: ProfileRegistry;

    beforeEach(() => {
      registry = new ProfileRegistry();
    });

    it("throws error for profile with empty name", () => {
      const invalidProfile = createTestProfile("");

      expect(() => registry.register(invalidProfile)).toThrow();
    });

    it("throws error with descriptive message for empty name", () => {
      const invalidProfile = createTestProfile("");

      expect(() => registry.register(invalidProfile)).toThrow(
        /name.*empty|empty.*name/i,
      );
    });

    it("throws error for profile with missing name property", () => {
      const invalidProfile = {
        description: "Missing name",
        targets: {},
      } as unknown as FormProfile;

      expect(() => registry.register(invalidProfile)).toThrow();
    });

    it("throws error for profile with invalid target (min > max)", () => {
      const invalidProfile: FormProfile = {
        name: "invalid-range",
        description: "Profile with invalid range",
        targets: {
          elbowAngle: {
            ideal: 90,
            acceptable: { min: 100, max: 50 }, // Invalid: min > max
            priority: "high",
            feedback: {},
          },
        },
      };

      expect(() => registry.register(invalidProfile)).toThrow();
    });

    it("throws error for null profile", () => {
      expect(() => registry.register(null as unknown as FormProfile)).toThrow();
    });

    it("throws error for undefined profile", () => {
      expect(() =>
        registry.register(undefined as unknown as FormProfile),
      ).toThrow();
    });

    it("throws error for profile with invalid priority", () => {
      const invalidProfile = {
        name: "invalid-priority",
        description: "Profile with invalid priority",
        targets: {
          elbowAngle: {
            ideal: 90,
            acceptable: { min: 85, max: 95 },
            priority: "critical" as "high", // Invalid priority
            feedback: {},
          },
        },
      };

      expect(() =>
        registry.register(invalidProfile as unknown as FormProfile),
      ).toThrow();
    });
  });

  describe("registerProfile() override behavior", () => {
    let registry: ProfileRegistry;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      registry = new ProfileRegistry();
      consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("allows overriding built-in profile with custom profile", () => {
      const customYouth: FormProfile = {
        name: "youth-fundamentals",
        description: "Custom youth profile",
        targets: {
          customMetric: createNumericTarget(100, 90, 110),
        },
      };

      registry.register(customYouth);

      expect(registry.get("youth-fundamentals")).toEqual(customYouth);
      expect(registry.get("youth-fundamentals")?.description).toBe(
        "Custom youth profile",
      );
    });

    it("logs warning when overriding existing profile", () => {
      const customProfile = createTestProfile("youth-fundamentals");

      registry.register(customProfile);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/overrid|replac|exist/i),
      );
    });

    it("logs warning when overriding custom profile with another", () => {
      const profile1 = createTestProfile("my-custom");
      const profile2: FormProfile = {
        name: "my-custom",
        description: "Replacement profile",
        targets: {},
      };

      registry.register(profile1);
      registry.register(profile2);

      expect(consoleSpy).toHaveBeenCalled();
      expect(registry.get("my-custom")?.description).toBe("Replacement profile");
    });

    it("does not log warning for new profile registration", () => {
      const newProfile = createTestProfile("brand-new-profile");

      registry.register(newProfile);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("getProfile()", () => {
    let registry: ProfileRegistry;

    beforeEach(() => {
      registry = new ProfileRegistry();
    });

    it("returns profile for existing name", () => {
      const profile = registry.get("youth-fundamentals");

      expect(profile).toBeDefined();
      expect(profile.name).toBe("youth-fundamentals");
    });

    it("throws error for non-existent profile", () => {
      expect(() => registry.get("non-existent")).toThrow();
    });

    it("throws descriptive error for non-existent profile", () => {
      expect(() => registry.get("unknown-profile")).toThrow(
        /unknown-profile.*not found|not found.*unknown-profile|does not exist/i,
      );
    });

    it("suggests available profiles in error message", () => {
      expect(() => registry.get("missing")).toThrow(
        /available|youth-fundamentals|high-school|pro-form/i,
      );
    });

    it("returns custom profile after registration", () => {
      const customProfile = createTestProfile("custom");
      registry.register(customProfile);

      const retrieved = registry.get("custom");

      expect(retrieved).toEqual(customProfile);
    });

    it("returns immutable profile reference", () => {
      const profile = registry.get("youth-fundamentals");
      const profile2 = registry.get("youth-fundamentals");

      expect(profile).toBe(profile2);
    });
  });

  describe("listProfiles()", () => {
    let registry: ProfileRegistry;

    beforeEach(() => {
      registry = new ProfileRegistry();
    });

    it("returns array of profile names", () => {
      const names = registry.list();

      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it("returns names in sorted order", () => {
      registry.register(createTestProfile("zebra-profile"));
      registry.register(createTestProfile("alpha-profile"));

      const names = registry.list();

      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it("includes both built-in and custom profiles", () => {
      registry.register(createTestProfile("custom-profile"));

      const names = registry.list();

      expect(names).toContain("youth-fundamentals");
      expect(names).toContain("high-school");
      expect(names).toContain("pro-form");
      expect(names).toContain("custom-profile");
    });

    it("returns fresh array each call (not shared reference)", () => {
      const names1 = registry.list();
      const names2 = registry.list();

      expect(names1).not.toBe(names2);
      expect(names1).toEqual(names2);
    });

    it("does not include duplicates after override", () => {
      registry.register(createTestProfile("youth-fundamentals"));

      const names = registry.list();
      const youthCount = names.filter(
        (n) => n === "youth-fundamentals",
      ).length;

      expect(youthCount).toBe(1);
    });
  });

  describe("has()", () => {
    let registry: ProfileRegistry;

    beforeEach(() => {
      registry = new ProfileRegistry();
    });

    it("returns true for existing built-in profile", () => {
      expect(registry.has("youth-fundamentals")).toBe(true);
      expect(registry.has("high-school")).toBe(true);
      expect(registry.has("pro-form")).toBe(true);
    });

    it("returns false for non-existent profile", () => {
      expect(registry.has("non-existent")).toBe(false);
      expect(registry.has("")).toBe(false);
    });

    it("returns true for registered custom profile", () => {
      registry.register(createTestProfile("custom"));

      expect(registry.has("custom")).toBe(true);
    });

    it("is case-sensitive", () => {
      expect(registry.has("Youth-Fundamentals")).toBe(false);
      expect(registry.has("YOUTH-FUNDAMENTALS")).toBe(false);
    });
  });

  describe("singleton pattern", () => {
    it("getProfileRegistry returns singleton instance", () => {
      const instance1 = getProfileRegistry();
      const instance2 = getProfileRegistry();

      expect(instance1).toBe(instance2);
    });

    it("singleton has built-in profiles", () => {
      const registry = getProfileRegistry();

      expect(registry.has("youth-fundamentals")).toBe(true);
      expect(registry.has("high-school")).toBe(true);
      expect(registry.has("pro-form")).toBe(true);
    });

    it("modifications to singleton persist", () => {
      const registry1 = getProfileRegistry();
      registry1.register(createTestProfile("singleton-test-profile"));

      const registry2 = getProfileRegistry();

      expect(registry2.has("singleton-test-profile")).toBe(true);
    });
  });

  describe("late registration", () => {
    it("allows registering profiles after initial setup", () => {
      const registry = new ProfileRegistry();

      // Simulate "initial setup" - just getting profiles
      registry.list();
      registry.get("youth-fundamentals");

      // Now register a profile later
      registry.register(createTestProfile("late-profile"));

      expect(registry.has("late-profile")).toBe(true);
      expect(registry.list()).toContain("late-profile");
    });

    it("late-registered profiles are immediately available", () => {
      const registry = new ProfileRegistry();
      const lateProfile = createTestProfile("late", {
        metric: createNumericTarget(50, 40, 60),
      });

      registry.register(lateProfile);
      const retrieved = registry.get("late");

      expect(retrieved).toEqual(lateProfile);
      expect(retrieved.targets.metric).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles profile names with special characters", () => {
      const registry = new ProfileRegistry();
      const profile = createTestProfile("profile-with-special_chars.v2");

      registry.register(profile);

      expect(registry.has("profile-with-special_chars.v2")).toBe(true);
      expect(registry.get("profile-with-special_chars.v2")).toEqual(profile);
    });

    it("handles profile names with unicode", () => {
      const registry = new ProfileRegistry();
      const profile = createTestProfile("プロファイル");

      registry.register(profile);

      expect(registry.has("プロファイル")).toBe(true);
    });

    it("handles very long profile names", () => {
      const registry = new ProfileRegistry();
      const longName = "a".repeat(200);
      const profile = createTestProfile(longName);

      registry.register(profile);

      expect(registry.has(longName)).toBe(true);
    });

    it("handles profiles with many targets", () => {
      const registry = new ProfileRegistry();
      const manyTargets: Record<string, MetricTarget> = {};
      for (let i = 0; i < 100; i++) {
        manyTargets[`metric${i}`] = createNumericTarget(i, i - 10, i + 10);
      }
      const profile = createTestProfile("many-targets", manyTargets);

      registry.register(profile);

      const retrieved = registry.get("many-targets");
      expect(Object.keys(retrieved.targets).length).toBe(100);
    });
  });
});
