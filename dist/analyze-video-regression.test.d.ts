/**
 * Analyze Video Regression Tests
 *
 * These tests verify that the existing "Analyze Video" functionality continues
 * to work correctly after implementing the manual labeling workflow features.
 *
 * Tests document and verify the expected behavior contracts for:
 * - Full analysis pipeline (pose detection + shot detection + metrics)
 * - Auto-detected shots appearing in shot list
 * - Metrics calculated and displayed for each shot
 * - appState.poseData populated after analysis
 * - appState.analysisData populated after analysis
 * - Export Poses working immediately after analysis (no re-detection)
 *
 * For true end-to-end testing with DOM interaction, use Playwright tests
 * in the e2e/ directory.
 *
 * @see Feature 4.0 - Verify Existing Analyze Video Unchanged
 * @see Task 4.1 - Verify Analyze Video regression tests
 */
export {};
//# sourceMappingURL=analyze-video-regression.test.d.ts.map