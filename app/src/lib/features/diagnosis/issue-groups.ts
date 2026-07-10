import type { MetricName } from "$lib/features/benchmarks";

/**
 * Static issue-group mapping: every benchmarked metric belongs to exactly
 * one coaching theme so the player gets themes, not 26 numbers.
 * (Enforced complete + disjoint by unit test.)
 */
export const ISSUE_GROUPS = [
  "alignment",
  "rhythm",
  "release-follow-through",
  "lower-body",
  "ball-path",
  "guide-hand",
  "posture",
] as const;

export type IssueGroupId = (typeof ISSUE_GROUPS)[number];

export interface IssueGroupInfo {
  id: IssueGroupId;
  displayName: string;
  /** "Why it matters" copy for the results screen. */
  whyItMatters: string;
  metrics: readonly MetricName[];
}

export const ISSUE_GROUP_INFO: Record<IssueGroupId, IssueGroupInfo> = {
  alignment: {
    id: "alignment",
    displayName: "Alignment",
    whyItMatters:
      "When your elbow and shoulders line up with the rim, the ball has no choice but to fly straight. Misalignment is the #1 cause of left-right misses.",
    metrics: ["shootingElbowFlare", "shootingElbowAngle", "shoulderAlignment"],
  },
  rhythm: {
    id: "rhythm",
    displayName: "Rhythm",
    whyItMatters:
      "Great shooters move like one spring: legs and ball rise together and the release flows out of it. Broken timing leaks power and wrecks touch.",
    metrics: [
      "ballRiseStart",
      "legRiseStart",
      "ballLegSync",
      "releaseStart",
      "totalShotDuration",
    ],
  },
  "release-follow-through": {
    id: "release-follow-through",
    displayName: "Release & follow-through",
    whyItMatters:
      "The last thing to touch the ball decides everything: full extension, wrist snap, and a held follow-through create backspin and soft misses.",
    metrics: [
      "wristSnapAngle",
      "followThroughHold",
      "maxArmExtension",
      "releaseAngle",
      "handCupVsHinge",
    ],
  },
  "lower-body": {
    id: "lower-body",
    displayName: "Lower body",
    whyItMatters:
      "Range comes from the ground. The right knee bend and leg drive make deep shots feel effortless — arms-only shooting breaks down when you're tired.",
    metrics: ["kneeFlexion", "hipDrop", "legExtensionStart"],
  },
  "ball-path": {
    id: "ball-path",
    displayName: "Ball path",
    whyItMatters:
      "The straighter and simpler the ball's trip from catch to release, the fewer things can go wrong. Extra dips and drifts add moving parts.",
    metrics: [
      "ballDip",
      "ballPath",
      "setPointHeight",
      "setPointDuration",
      "ballBehindHead",
    ],
  },
  "guide-hand": {
    id: "guide-hand",
    displayName: "Guide hand",
    whyItMatters:
      "Your off-hand should be a passenger, not a driver. Guide-hand interference causes unpredictable side-spin misses.",
    metrics: ["guideElbowFlare", "guideHandPosition", "guideHandRelease"],
  },
  posture: {
    id: "posture",
    displayName: "Posture",
    whyItMatters:
      "A tall spine and still head keep your eyes calibrated and your shot line identical every rep.",
    metrics: ["backPosture", "headTilt"],
  },
};

const METRIC_TO_GROUP = new Map<MetricName, IssueGroupId>();
for (const info of Object.values(ISSUE_GROUP_INFO)) {
  for (const metric of info.metrics) METRIC_TO_GROUP.set(metric, info.id);
}

export function issueGroupForMetric(metric: MetricName): IssueGroupId | null {
  return METRIC_TO_GROUP.get(metric) ?? null;
}
