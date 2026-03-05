/**
 * Unit tests for ShotAnalyzer class.
 *
 * Tests are organized by subtask following TDD approach.
 *
 * @see Feature 7.0 - Main Analyzer Integration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShotAnalyzer, createShotAnalyzer, ShotAnalyzerAlreadyInitializedError, } from "./analyzer";
import { createConfig, createDefaultConfig, } from "./config";
import { getProfileRegistry, resetProfileRegistry } from "./profiles/registry";
// Mock the pose detector factory to avoid loading MediaPipe during tests
vi.mock("./pose/factory", () => ({
    createPoseDetector: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue(null),
        close: vi.fn().mockResolvedValue(undefined),
    }),
}));
describe("ShotAnalyzer", () => {
    beforeEach(() => {
        // Reset profile registry before each test to ensure clean state
        resetProfileRegistry();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
    // =========================================================================
    // 7.1.1 - Constructor with valid config
    // =========================================================================
    describe("constructor with valid config", () => {
        it("creates instance with default configuration", () => {
            const config = createDefaultConfig();
            const analyzer = new ShotAnalyzer(config);
            expect(analyzer).toBeInstanceOf(ShotAnalyzer);
        });
        it("creates instance with custom configuration", () => {
            const config = createConfig({
                shootingHand: "left",
                profile: "high-school",
                minConfidenceThreshold: 0.7,
                outputTimingUnit: "ms",
            });
            const analyzer = new ShotAnalyzer(config);
            expect(analyzer).toBeInstanceOf(ShotAnalyzer);
        });
        it("creates instance with custom profile", () => {
            const customProfile = {
                name: "custom-test-profile",
                description: "Test profile",
                targets: {
                    shootingElbowAngle: {
                        ideal: 90,
                        acceptable: { min: 85, max: 95 },
                        priority: "high",
                        feedback: {
                            tooLow: "Elbow too low",
                            tooHigh: "Elbow too high",
                        },
                    },
                },
            };
            const config = createConfig({
                profile: "custom-test-profile",
                customProfile,
            });
            const analyzer = new ShotAnalyzer(config);
            expect(analyzer).toBeInstanceOf(ShotAnalyzer);
        });
        it("stores the provided configuration", () => {
            const config = createConfig({
                shootingHand: "left",
                profile: "pro-form",
                minConfidenceThreshold: 0.8,
            });
            const analyzer = new ShotAnalyzer(config);
            expect(analyzer.getConfig()).toEqual(config);
        });
        it("accepts all valid shooting hands", () => {
            const configRight = createConfig({ shootingHand: "right" });
            const configLeft = createConfig({ shootingHand: "left" });
            expect(() => new ShotAnalyzer(configRight)).not.toThrow();
            expect(() => new ShotAnalyzer(configLeft)).not.toThrow();
        });
        it("accepts all valid timing units", () => {
            const configFrames = createConfig({ outputTimingUnit: "frames" });
            const configMs = createConfig({ outputTimingUnit: "ms" });
            const configPercent = createConfig({ outputTimingUnit: "percent" });
            expect(() => new ShotAnalyzer(configFrames)).not.toThrow();
            expect(() => new ShotAnalyzer(configMs)).not.toThrow();
            expect(() => new ShotAnalyzer(configPercent)).not.toThrow();
        });
        it("accepts confidence threshold at boundaries", () => {
            const configZero = createConfig({ minConfidenceThreshold: 0 });
            const configOne = createConfig({ minConfidenceThreshold: 1 });
            expect(() => new ShotAnalyzer(configZero)).not.toThrow();
            expect(() => new ShotAnalyzer(configOne)).not.toThrow();
        });
        it("is not initialized after construction", () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            expect(analyzer.isInitialized()).toBe(false);
        });
    });
    // =========================================================================
    // 7.1.3 - Constructor with invalid config
    // =========================================================================
    describe("constructor with invalid config", () => {
        it("throws on invalid shootingHand", () => {
            const invalidConfig = {
                shootingHand: "both",
                profile: "youth-fundamentals",
                minConfidenceThreshold: 0.5,
                outputTimingUnit: "percent",
            };
            expect(() => new ShotAnalyzer(invalidConfig)).toThrow();
        });
        it("throws on empty profile name", () => {
            const invalidConfig = {
                shootingHand: "right",
                profile: "",
                minConfidenceThreshold: 0.5,
                outputTimingUnit: "percent",
            };
            expect(() => new ShotAnalyzer(invalidConfig)).toThrow();
        });
        it("throws on minConfidenceThreshold below 0", () => {
            const invalidConfig = {
                shootingHand: "right",
                profile: "test",
                minConfidenceThreshold: -0.1,
                outputTimingUnit: "percent",
            };
            expect(() => new ShotAnalyzer(invalidConfig)).toThrow();
        });
        it("throws on minConfidenceThreshold above 1", () => {
            const invalidConfig = {
                shootingHand: "right",
                profile: "test",
                minConfidenceThreshold: 1.5,
                outputTimingUnit: "percent",
            };
            expect(() => new ShotAnalyzer(invalidConfig)).toThrow();
        });
        it("throws on invalid outputTimingUnit", () => {
            const invalidConfig = {
                shootingHand: "right",
                profile: "test",
                minConfidenceThreshold: 0.5,
                outputTimingUnit: "seconds",
            };
            expect(() => new ShotAnalyzer(invalidConfig)).toThrow();
        });
        it("throws on missing required config fields", () => {
            expect(() => new ShotAnalyzer({})).toThrow();
        });
        it("throws on null config", () => {
            expect(() => new ShotAnalyzer(null)).toThrow();
        });
        it("throws on undefined config", () => {
            expect(() => new ShotAnalyzer(undefined)).toThrow();
        });
        it("throws with descriptive error message for invalid config", () => {
            const invalidConfig = {
                shootingHand: "invalid",
                profile: "test",
                minConfidenceThreshold: 0.5,
                outputTimingUnit: "percent",
            };
            expect(() => new ShotAnalyzer(invalidConfig)).toThrow(/invalid/i);
        });
    });
    // =========================================================================
    // 7.1.5 - Async initialize() method
    // =========================================================================
    describe("initialize()", () => {
        it("initializes the pose detector", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await analyzer.initialize();
            expect(analyzer.isInitialized()).toBe(true);
        });
        it("resolves successfully on first call", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await expect(analyzer.initialize()).resolves.not.toThrow();
        });
        it("throws ShotAnalyzerAlreadyInitializedError on second call", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await analyzer.initialize();
            await expect(analyzer.initialize()).rejects.toThrow(ShotAnalyzerAlreadyInitializedError);
        });
        it("throws descriptive error message on re-initialization", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await analyzer.initialize();
            await expect(analyzer.initialize()).rejects.toThrow(/already initialized/i);
        });
        it("sets initialized state correctly", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            expect(analyzer.isInitialized()).toBe(false);
            await analyzer.initialize();
            expect(analyzer.isInitialized()).toBe(true);
        });
        it("can be called multiple times with re-initialization after dispose", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await analyzer.initialize();
            await analyzer.dispose();
            // Should be able to re-initialize after dispose
            await expect(analyzer.initialize()).resolves.not.toThrow();
            expect(analyzer.isInitialized()).toBe(true);
        });
    });
    // =========================================================================
    // 7.1.7 - getProfiles() and getConfig()
    // =========================================================================
    describe("getProfiles()", () => {
        it("returns available profile names", () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            const profiles = analyzer.getProfiles();
            expect(Array.isArray(profiles)).toBe(true);
            expect(profiles.length).toBeGreaterThan(0);
        });
        it("includes built-in profiles", () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            const profiles = analyzer.getProfiles();
            expect(profiles).toContain("youth-fundamentals");
            expect(profiles).toContain("high-school");
            expect(profiles).toContain("pro-form");
        });
        it("returns profile names in sorted order", () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            const profiles = analyzer.getProfiles();
            const sortedProfiles = [...profiles].sort();
            expect(profiles).toEqual(sortedProfiles);
        });
        it("includes custom profile if registered", () => {
            const customProfile = {
                name: "custom-analyzer-profile",
                description: "Custom profile for analyzer",
                targets: {},
            };
            // Register via registry
            getProfileRegistry().register(customProfile);
            const config = createConfig({
                profile: "custom-analyzer-profile",
                customProfile,
            });
            const analyzer = new ShotAnalyzer(config);
            const profiles = analyzer.getProfiles();
            expect(profiles).toContain("custom-analyzer-profile");
        });
    });
    describe("getConfig()", () => {
        it("returns the configuration used to create the analyzer", () => {
            const config = createDefaultConfig();
            const analyzer = new ShotAnalyzer(config);
            const retrievedConfig = analyzer.getConfig();
            expect(retrievedConfig).toEqual(config);
        });
        it("returns configuration with custom values", () => {
            const config = createConfig({
                shootingHand: "left",
                profile: "pro-form",
                minConfidenceThreshold: 0.75,
                outputTimingUnit: "ms",
            });
            const analyzer = new ShotAnalyzer(config);
            const retrievedConfig = analyzer.getConfig();
            expect(retrievedConfig.shootingHand).toBe("left");
            expect(retrievedConfig.profile).toBe("pro-form");
            expect(retrievedConfig.minConfidenceThreshold).toBe(0.75);
            expect(retrievedConfig.outputTimingUnit).toBe("ms");
        });
        it("returns immutable config reference", () => {
            const config = createDefaultConfig();
            const analyzer = new ShotAnalyzer(config);
            const retrievedConfig = analyzer.getConfig();
            // Verify it returns the same reference (immutable config pattern)
            expect(retrievedConfig).toEqual(config);
        });
        it("includes customProfile if provided", () => {
            const customProfile = {
                name: "my-profile",
                description: "My profile",
                targets: {},
            };
            const config = createConfig({
                profile: "my-profile",
                customProfile,
            });
            const analyzer = new ShotAnalyzer(config);
            const retrievedConfig = analyzer.getConfig();
            expect(retrievedConfig.customProfile).toBeDefined();
            expect(retrievedConfig.customProfile?.name).toBe("my-profile");
        });
    });
    // =========================================================================
    // Factory function tests
    // =========================================================================
    describe("createShotAnalyzer()", () => {
        it("creates and initializes analyzer in one call", async () => {
            const config = createDefaultConfig();
            const analyzer = await createShotAnalyzer(config);
            expect(analyzer).toBeInstanceOf(ShotAnalyzer);
            expect(analyzer.isInitialized()).toBe(true);
        });
        it("throws on invalid config", async () => {
            const invalidConfig = {
                shootingHand: "invalid",
            };
            await expect(createShotAnalyzer(invalidConfig)).rejects.toThrow();
        });
        it("returns properly configured analyzer", async () => {
            const config = createConfig({
                shootingHand: "left",
                profile: "high-school",
            });
            const analyzer = await createShotAnalyzer(config);
            expect(analyzer.getConfig().shootingHand).toBe("left");
            expect(analyzer.getConfig().profile).toBe("high-school");
        });
    });
    // =========================================================================
    // Dispose tests
    // =========================================================================
    describe("dispose()", () => {
        it("sets initialized to false after dispose", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await analyzer.initialize();
            expect(analyzer.isInitialized()).toBe(true);
            await analyzer.dispose();
            expect(analyzer.isInitialized()).toBe(false);
        });
        it("does not throw when called on uninitialized analyzer", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await expect(analyzer.dispose()).resolves.not.toThrow();
        });
        it("can be called multiple times without error", async () => {
            const analyzer = new ShotAnalyzer(createDefaultConfig());
            await analyzer.initialize();
            await expect(analyzer.dispose()).resolves.not.toThrow();
            await expect(analyzer.dispose()).resolves.not.toThrow();
        });
    });
});
//# sourceMappingURL=analyzer.test.js.map