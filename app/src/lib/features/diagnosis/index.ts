// Public barrel for the diagnosis feature.
export {
  createFocusAreaRepo,
  type FocusAreaRepo,
  type FocusAreaRow,
} from "./repo/focus-area-repo";
export {
  DEFAULT_DIAGNOSIS_WEIGHTS,
  diagnose,
  type DiagnosisWeights,
  type FocusArea,
  type MetricDiagnosis,
} from "./engine";
export {
  ISSUE_GROUP_INFO,
  ISSUE_GROUPS,
  issueGroupForMetric,
  type IssueGroupId,
  type IssueGroupInfo,
} from "./issue-groups";
export {
  createDiagnosisService,
  type DiagnosisService,
  type DiagnosisServiceDeps,
} from "./service";
