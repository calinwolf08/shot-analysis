import type { ShotAnalysis } from "basketball-shot-analysis";
import { fromBool, parseJson, toBool, type RepoContext } from "../repo-base";
import type { ShotRecord } from "./types";

export interface SaveAnalysisInput {
  sessionId: string;
  videoId?: string;
  analysis: ShotAnalysis;
}

export interface ShotRepo {
  /**
   * Persists one analyzed shot: full ShotAnalysis JSON into `shots` plus a
   * normalized `shot_metrics` projection — atomically (one transaction).
   */
  saveAnalysis(input: SaveAnalysisInput): Promise<ShotRecord>;
  get(id: string): Promise<ShotRecord | null>;
  listBySession(
    sessionId: string,
    opts?: { includeExcluded?: boolean },
  ): Promise<ShotRecord[]>;
  setExcluded(id: string, excluded: boolean): Promise<void>;
}

interface ShotRow {
  id: string;
  session_id: string;
  video_id: string | null;
  shot_index: number;
  orientation: string | null;
  start_frame: number | null;
  end_frame: number | null;
  overall_confidence: number | null;
  excluded: number;
  analysis_json: string;
  created_at: number;
}

function toShot(r: ShotRow): ShotRecord {
  return {
    id: r.id,
    sessionId: r.session_id,
    videoId: r.video_id,
    shotIndex: r.shot_index,
    orientation: r.orientation,
    startFrame: r.start_frame,
    endFrame: r.end_frame,
    overallConfidence: r.overall_confidence,
    excluded: toBool(r.excluded),
    analysis: parseJson<ShotAnalysis>(r.analysis_json, `shots.${r.id}`),
    createdAt: r.created_at,
  };
}

export function createShotRepo(ctx: RepoContext): ShotRepo {
  const { db, clock, ids } = ctx;
  return {
    async saveAnalysis(input) {
      const { analysis } = input;
      const shot: ShotRecord = {
        id: ids.next(),
        sessionId: input.sessionId,
        videoId: input.videoId ?? null,
        shotIndex: analysis.shotIndex,
        orientation: analysis.orientation ?? null,
        startFrame: analysis.frameRange.start,
        endFrame: analysis.frameRange.end,
        overallConfidence: analysis.overallConfidence,
        excluded: false,
        analysis,
        createdAt: clock.now(),
      };

      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO shots (id, session_id, video_id, shot_index, orientation,
             start_frame, end_frame, overall_confidence, excluded, analysis_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shot.id,
            shot.sessionId,
            shot.videoId,
            shot.shotIndex,
            shot.orientation,
            shot.startFrame,
            shot.endFrame,
            shot.overallConfidence,
            fromBool(shot.excluded),
            JSON.stringify(analysis),
            shot.createdAt,
          ],
        );
        for (const [name, metric] of Object.entries(analysis.metrics)) {
          const isNumeric = typeof metric.value === "number";
          await tx.run(
            `INSERT INTO shot_metrics (shot_id, metric_name, value_num, value_text, unit, frame, confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              shot.id,
              name,
              isNumeric ? (metric.value as number) : null,
              isNumeric ? null : String(metric.value),
              metric.unit,
              metric.frame,
              metric.confidence,
            ],
          );
        }
      });
      return shot;
    },

    async get(id) {
      const rows = await db.query<ShotRow>("SELECT * FROM shots WHERE id = ?", [
        id,
      ]);
      return rows[0] ? toShot(rows[0]) : null;
    },

    async listBySession(sessionId, opts = {}) {
      const where = opts.includeExcluded
        ? "session_id = ?"
        : "session_id = ? AND excluded = 0";
      const rows = await db.query<ShotRow>(
        `SELECT * FROM shots WHERE ${where} ORDER BY shot_index`,
        [sessionId],
      );
      return rows.map(toShot);
    },

    async setExcluded(id, excluded) {
      await db.run("UPDATE shots SET excluded = ? WHERE id = ?", [
        fromBool(excluded),
        id,
      ]);
    },
  };
}
