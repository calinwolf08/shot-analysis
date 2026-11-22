/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
import type { ShotAnalysis } from "basketball-shot-analysis";
import type { ShotRecord, ShotReviewPoses } from "./types";

export interface SaveAnalysisInput {
  /** Owning player. Required for de-sessioned live shots; derived from the
   * session when omitted (assessment path). */
  playerId?: string;
  /** Owning session, or null/omitted for live shots. */
  sessionId?: string | null;
  videoId?: string;
  analysis: ShotAnalysis;
  /** Optional review pose track to persist alongside the shot (step 7). */
  reviewPoses?: ShotReviewPoses;
}

/** Filters for the player-rooted shot listing (Shots / Insights reads). */
export interface ListByPlayerOptions {
  includeExcluded?: boolean;
  /** Only shots with created_at >= this epoch-ms. */
  since?: number;
  /** Cap the number of (newest-first) shots returned. */
  limit?: number;
}

export interface ShotRepo {
  /**
   * Persists one analyzed shot: full ShotAnalysis JSON into `shots` plus a
   * normalized `shot_metrics` projection — atomically (one transaction).
   */
  saveAnalysis(input: SaveAnalysisInput): Promise<ShotRecord>;
  get(id: string): Promise<ShotRecord | null>;
  /**
   * Assessment/upload path only — the de-sessioned live flow uses
   * {@link ShotRepo.listByPlayer}. Kept for the hidden upload feature.
   */
  listBySession(
    sessionId: string,
    opts?: { includeExcluded?: boolean },
  ): Promise<ShotRecord[]>;
  /** All of a player's shots, newest first (the de-sessioned live history). */
  listByPlayer(
    playerId: string,
    opts?: ListByPlayerOptions,
  ): Promise<ShotRecord[]>;
  setExcluded(id: string, excluded: boolean): Promise<void>;
  /**
   * Replaces a shot's stored analysis (read-time migration: v3 metrics
   * recomputed from the pose track are persisted so it only happens once).
   */
  updateAnalysis(id: string, analysis: ShotAnalysis): Promise<void>;
  /** The persisted review pose track for a shot, or null when none was stored. */
  getPoses(id: string): Promise<ShotReviewPoses | null>;
}
