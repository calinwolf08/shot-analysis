/**
 * Unit tests for server utility functions.
 */
/**
 * Sanitizes a video filename for use as a directory name.
 * - Removes file extension
 * - Replaces spaces with hyphens
 * - Removes special characters (keeps alphanumeric, hyphens, underscores)
 * - Converts to lowercase
 *
 * Extracted here for testability.
 */
export declare function sanitizeVideoName(videoName: string): string;
//# sourceMappingURL=server-utils.test.d.ts.map