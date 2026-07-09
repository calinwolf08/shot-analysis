/**
 * Domain row types for the core tables (schema v1). JSON-carrying tables
 * keep their parsed payload as the source of truth (`shots.analysis_json`).
 */
import type { ShotAnalysis } from "basketball-shot-analysis";

export type ShootingHand = "left" | "right";
export type PlayerLevel = "youth" | "high-school" | "advanced";

export interface Player {
  id: string;
  name: string;
  shootingHand: ShootingHand;
  level: PlayerLevel;
  createdAt: number;
  updatedAt: number;
}

export type VideoSource = "upload" | "live";

export interface Video {
  id: string;
  playerId: string;
  source: VideoSource;
  fileUri: string | null;
  durationMs: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  createdAt: number;
}

export type SessionType = "assessment" | "live_practice";
export type SessionStatus = "in_progress" | "completed" | "aborted";

export interface Session {
  id: string;
  playerId: string;
  type: SessionType;
  status: SessionStatus;
  planItemId: string | null;
  focusMetric: string | null;
  startedAt: number;
  completedAt: number | null;
  notes: string | null;
}

export interface ShotRecord {
  id: string;
  sessionId: string;
  videoId: string | null;
  shotIndex: number;
  orientation: string | null;
  startFrame: number | null;
  endFrame: number | null;
  overallConfidence: number | null;
  excluded: boolean;
  /** Full library ShotAnalysis — the analysis source of truth. */
  analysis: ShotAnalysis;
  createdAt: number;
}

export type ScoreScope = "shot" | "session";

export interface ScoreRecord {
  id: string;
  scope: ScoreScope;
  refId: string;
  benchmarkId: string;
  scoringVersion: number;
  formScore: number | null;
  consistencyScore: number | null;
  efficiencyScore: number | null;
  overallScore: number | null;
  /** Structured, versioned explanation of how the score was computed. */
  breakdown: unknown;
  createdAt: number;
}

export interface RepRecord {
  id: string;
  sessionId: string;
  repIndex: number;
  shotId: string | null;
  repScore: number | null;
  primaryCue: string | null;
  feedback: unknown;
  createdAt: number;
}
