/**
 * Request contracts for the `/api/*` data endpoints — zod schemas shared by the
 * server routes (validation) and the client remote repos (Phase 5). One source
 * of truth keeps the wire protocol in sync on both sides.
 */
import { z } from "zod";

export const shootingHand = z.enum(["left", "right"]);
export const playerLevel = z.enum(["youth", "high-school", "advanced"]);
export const sessionType = z.enum(["assessment", "live_practice"]);
export const sessionStatus = z.enum(["in_progress", "completed", "aborted"]);
export const videoSource = z.enum(["upload", "live"]);
export const scoreScope = z.enum(["shot", "session"]);

// --- players ---------------------------------------------------------------
export const createPlayerBody = z.object({
  name: z.string().min(1),
  shootingHand,
  level: playerLevel,
});
export const updatePlayerBody = z.object({
  name: z.string().min(1).optional(),
  shootingHand: shootingHand.optional(),
  level: playerLevel.optional(),
});

// --- videos ----------------------------------------------------------------
export const createVideoBody = z.object({
  playerId: z.string().min(1),
  source: videoSource,
  fileUri: z.string().optional(),
  durationMs: z.number().optional(),
  fps: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// --- sessions --------------------------------------------------------------
export const createSessionBody = z.object({
  playerId: z.string().min(1),
  type: sessionType,
  planItemId: z.string().optional(),
  focusMetric: z.string().optional(),
  notes: z.string().optional(),
});
export const sessionActionBody = z.object({
  action: z.enum(["complete", "abort"]),
});

// --- shots -----------------------------------------------------------------
// The analysis blob is produced by our own library; validate the fields the
// repo reads and pass the rest through unchanged.
export const shotAnalysisSchema = z
  .object({
    shotIndex: z.number(),
    frameRange: z.object({ start: z.number(), end: z.number() }),
    orientation: z.string().nullish(),
    overallConfidence: z.number(),
    metrics: z.record(z.any()),
  })
  .passthrough();
export const saveAnalysisBody = z.object({
  sessionId: z.string().min(1),
  videoId: z.string().optional(),
  analysis: shotAnalysisSchema,
});
export const setExcludedBody = z.object({ excluded: z.boolean() });

// --- scores ----------------------------------------------------------------
export const insertScoreBody = z.object({
  scope: scoreScope,
  refId: z.string().min(1),
  benchmarkId: z.string().min(1),
  scoringVersion: z.number().int(),
  formScore: z.number().nullish(),
  consistencyScore: z.number().nullish(),
  efficiencyScore: z.number().nullish(),
  overallScore: z.number().nullish(),
  breakdown: z.unknown(),
});
export const latestForRefsBody = z.object({
  scope: scoreScope,
  refIds: z.array(z.string()),
});

// --- reps ------------------------------------------------------------------
export const createRepBody = z.object({
  sessionId: z.string().min(1),
  repIndex: z.number().int(),
  shotId: z.string().optional(),
  repScore: z.number().optional(),
  primaryCue: z.string().optional(),
  feedback: z.unknown().optional(),
});

// --- settings --------------------------------------------------------------
export const setSettingBody = z.object({ value: z.unknown() });

// --- training plans --------------------------------------------------------
export const generatePlanBody = z.object({
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
});
export const reassessPlanBody = z.object({
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
  planItemId: z.string().min(1),
});
