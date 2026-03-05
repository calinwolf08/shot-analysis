/**
 * Profile registry for managing form profiles.
 *
 * Provides a central registry for built-in and custom form profiles.
 * Supports the singleton pattern for global access and late registration
 * of profiles after initialization.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
import type { FormProfile } from "./types";
/**
 * Registry for managing form profiles.
 *
 * Provides methods to register, retrieve, and list form profiles.
 * Built-in profiles are pre-registered on construction.
 *
 * @example
 * ```typescript
 * // Using the singleton
 * const registry = getProfileRegistry();
 * const profile = registry.get("youth-fundamentals");
 *
 * // Registering a custom profile
 * registry.register({
 *   name: "my-custom-profile",
 *   description: "Custom profile for specific needs",
 *   targets: { ... }
 * });
 * ```
 */
export declare class ProfileRegistry {
    /** Internal map storing profiles by name */
    private readonly profiles;
    /**
     * Creates a new ProfileRegistry with built-in profiles pre-registered.
     */
    constructor();
    /**
     * Registers a profile in the registry.
     *
     * Validates the profile before registration. If a profile with the same name
     * already exists, it will be overridden and a warning will be logged.
     *
     * @param profile - The profile to register
     * @throws {Error} If the profile is invalid (fails Zod validation)
     *
     * @example
     * ```typescript
     * registry.register({
     *   name: "custom-profile",
     *   description: "A custom profile",
     *   targets: {
     *     elbowAngle: {
     *       ideal: 90,
     *       acceptable: { min: 80, max: 100 },
     *       priority: "high",
     *       feedback: { tooLow: "Bend more", tooHigh: "Straighten arm" }
     *     }
     *   }
     * });
     * ```
     */
    register(profile: FormProfile): void;
    /**
     * Gets a profile by name.
     *
     * @param name - The profile name to retrieve
     * @returns The profile
     * @throws {Error} If the profile does not exist
     *
     * @example
     * ```typescript
     * const profile = registry.get("youth-fundamentals");
     * console.log(profile.description);
     * ```
     */
    get(name: string): FormProfile;
    /**
     * Lists all registered profile names.
     *
     * Returns a sorted array of profile names for consistent ordering.
     *
     * @returns Array of profile names, sorted alphabetically
     *
     * @example
     * ```typescript
     * const names = registry.list();
     * // ["high-school", "pro-form", "youth-fundamentals"]
     * ```
     */
    list(): string[];
    /**
     * Checks if a profile exists in the registry.
     *
     * @param name - The profile name to check
     * @returns true if the profile exists, false otherwise
     *
     * @example
     * ```typescript
     * if (registry.has("custom-profile")) {
     *   const profile = registry.get("custom-profile");
     * }
     * ```
     */
    has(name: string): boolean;
}
/**
 * Gets the singleton ProfileRegistry instance.
 *
 * Use this for global access to the profile registry.
 * The singleton is created lazily on first access.
 *
 * @returns The singleton ProfileRegistry instance
 *
 * @example
 * ```typescript
 * import { getProfileRegistry } from "./profiles";
 *
 * const registry = getProfileRegistry();
 * const profile = registry.get("youth-fundamentals");
 * ```
 */
export declare function getProfileRegistry(): ProfileRegistry;
/**
 * Resets the singleton instance. Only for testing purposes.
 * @internal
 */
export declare function resetProfileRegistry(): void;
//# sourceMappingURL=registry.d.ts.map