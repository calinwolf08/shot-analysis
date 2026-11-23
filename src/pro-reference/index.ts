/**
 * Reference (pro) data: labels format, per-metric camera-angle limits and the
 * attempt measurement shared by the review tool and the target build
 * (docs/pro-targets-plan.md). The node-only library listing lives in
 * ./library (not exported here: the browser bundle can't use fs).
 */
export * from "./labels";
export * from "./angle-limits";
export * from "./attempt";
export * from "./build";
export * from "./angle-trend";
export * from "./calibration";
