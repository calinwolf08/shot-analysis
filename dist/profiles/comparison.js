/**
 * Profile comparison engine for comparing shot metrics against form profiles.
 *
 * This module implements the comparison logic for evaluating shot analysis results
 * against target profiles. It handles both numeric and categorical metrics,
 * determines pass/fail/warning status, and generates prioritized feedback.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
import { isNumericTarget, isCategoricalTarget, getFeedbackMessage, } from "./types";
/**
 * Default configuration values.
 */
const DEFAULT_OPTIONS = {
    warningThreshold: 0.2,
    lowConfidenceThreshold: 0.5,
};
/**
 * Priority order for sorting (lower number = higher priority).
 */
const PRIORITY_ORDER = {
    high: 0,
    medium: 1,
    low: 2,
};
/**
 * Engine for comparing shot analysis metrics against form profiles.
 *
 * The engine evaluates each metric in the shot analysis against corresponding
 * targets in the profile, determining status and generating feedback.
 *
 * @example
 * ```typescript
 * const engine = new ProfileComparisonEngine();
 * const result = engine.compareToProfile(shotAnalysis, youthProfile);
 * console.log(result.summary.priorityIssues);
 * ```
 */
export class ProfileComparisonEngine {
    options;
    /**
     * Creates a new ProfileComparisonEngine with the specified options.
     *
     * @param options - Configuration options for the engine
     */
    constructor(options = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
        };
    }
    /**
     * Compares a shot analysis against a form profile.
     *
     * Only metrics present in both the shot and the profile are compared.
     * Metrics in the shot but not in the profile are ignored.
     * Profile targets without corresponding shot metrics are skipped.
     *
     * @param shot - The shot analysis containing measured metrics
     * @param profile - The form profile with target specifications
     * @returns Complete comparison result with per-metric results and summary
     */
    compareToProfile(shot, profile) {
        const metrics = {};
        const issueDetails = [];
        // Compare each metric that exists in both shot and profile
        for (const [metricName, target] of Object.entries(profile.targets)) {
            const metricValue = shot.metrics[metricName];
            // Skip if metric not present in shot
            if (!metricValue) {
                continue;
            }
            // Compare the metric against the target
            const result = this.compareMetric(metricValue, target);
            metrics[metricName] = result;
            // Collect issues (fail or warning) for priority sorting
            if (result.status !== "pass" && result.feedback) {
                issueDetails.push({
                    metricName,
                    priority: target.priority,
                    feedback: result.feedback,
                    status: result.status,
                });
            }
        }
        // Generate summary
        const summary = this.generateSummary(metrics, issueDetails);
        return {
            profile: profile.name,
            metrics,
            summary,
        };
    }
    /**
     * Compares a single metric value against its target.
     *
     * @param metricValue - The measured metric value
     * @param target - The target specification to compare against
     * @returns Comparison result with status, deviation, and feedback
     */
    compareMetric(metricValue, target) {
        const value = metricValue.value;
        const isLowConfidence = metricValue.confidence < this.options.lowConfidenceThreshold;
        // Determine if this is numeric or categorical
        if (isNumericTarget(target) && typeof value === "number") {
            return this.compareNumericMetric(value, target, metricValue.confidence, isLowConfidence);
        }
        else if (isCategoricalTarget(target) && typeof value === "string") {
            return this.compareCategoricalMetric(value, target, isLowConfidence);
        }
        // Type mismatch - treat as fail
        return {
            value,
            target,
            status: "fail",
            feedback: "Metric type mismatch",
        };
    }
    /**
     * Compares a numeric metric value against its numeric range target.
     */
    compareNumericMetric(value, target, _confidence, isLowConfidence) {
        const { min, max } = target.acceptable;
        const ideal = target.ideal;
        const deviation = value - ideal;
        // Calculate if value is within acceptable range
        const isInRange = value >= min && value <= max;
        // Calculate warning zone boundaries
        const range = max - min;
        const warningZone = range * this.options.warningThreshold;
        const innerMin = min + warningZone;
        const innerMax = max - warningZone;
        // Determine the raw status
        let status;
        let isTooLow = false;
        if (!isInRange) {
            status = "fail";
            isTooLow = value < min;
        }
        else if (range > 0 &&
            value !== min &&
            value !== max &&
            (value < innerMin || value > innerMax)) {
            // In warning zone (only applies if range is > 0 and value is not exactly at boundary)
            // Exact boundary values pass - only values strictly inside but near boundary are warnings
            status = "warning";
            isTooLow = value < innerMin;
        }
        else {
            status = "pass";
        }
        // Low confidence overrides to warning (but not fail -> warning)
        if (isLowConfidence && status === "pass") {
            status = "warning";
        }
        else if (isLowConfidence && status === "fail") {
            // Low confidence metrics can't be trusted, so mark as warning
            status = "warning";
        }
        // Get feedback for non-pass statuses
        const feedback = status !== "pass"
            ? getFeedbackMessage(target, status, true, isTooLow)
            : undefined;
        // Build result with optional properties only included when defined
        if (status !== "pass" && feedback !== undefined) {
            return {
                value,
                target,
                status,
                deviation,
                feedback,
            };
        }
        if (status !== "pass") {
            return {
                value,
                target,
                status,
                deviation,
            };
        }
        return {
            value,
            target,
            status,
        };
    }
    /**
     * Compares a categorical metric value against its list of acceptable values.
     */
    compareCategoricalMetric(value, target, isLowConfidence) {
        const acceptable = target.acceptable;
        const isInAcceptable = acceptable.includes(value);
        let status;
        if (!isInAcceptable) {
            status = "fail";
        }
        else {
            status = "pass";
        }
        // Low confidence overrides to warning
        if (isLowConfidence && status === "pass") {
            status = "warning";
        }
        else if (isLowConfidence && status === "fail") {
            status = "warning";
        }
        // Get feedback for non-pass statuses
        const feedback = status !== "pass" ? getFeedbackMessage(target, status, false) : undefined;
        // Build result - no deviation for categorical metrics
        if (feedback !== undefined) {
            return {
                value,
                target,
                status,
                feedback,
            };
        }
        return {
            value,
            target,
            status,
        };
    }
    /**
     * Generates the comparison summary from the metric results.
     */
    generateSummary(metrics, issueDetails) {
        let passCount = 0;
        let failCount = 0;
        let warningCount = 0;
        for (const result of Object.values(metrics)) {
            switch (result.status) {
                case "pass":
                    passCount++;
                    break;
                case "fail":
                    failCount++;
                    break;
                case "warning":
                    warningCount++;
                    break;
            }
        }
        // Sort issues by priority (high > medium > low)
        const sortedIssues = [...issueDetails].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        // Format priority issues as "metricName: feedback"
        const priorityIssues = sortedIssues.map((issue) => `${issue.metricName}: ${issue.feedback}`);
        return {
            passCount,
            failCount,
            warningCount,
            priorityIssues,
        };
    }
}
//# sourceMappingURL=comparison.js.map