/**
 * User-scoped repositories for the server.
 *
 * `createServerRepos(db, userId)` returns the same {@link AppRepos} interfaces
 * the app already uses, but every read is filtered to `userId` and every write
 * verifies ownership first — so one user can never see or mutate another user's
 * data, even with a guessed id. `players.user_id` is the ownership root;
 * `sessions`/`videos` carry `user_id` directly; deeper tables (shots, scores,
 * reps) are scoped by joining up to their owning session.
 *
 * Server-only.
 */
import type { ShotAnalysis } from "basketball-shot-analysis";
import type { DatabaseAdapter } from "$lib/shared/db";
import { fromBool, parseJson, toBool } from "$lib/shared/db/repo-base";
import { systemClock, uuidIdGenerator, type Clock } from "$lib/shared/utils";
import type { AppRepos } from "$lib/shared/config/services";
import {
  SETTINGS,
  type CreatePlayerInput,
  type CreateRepInput,
  type CreateSessionInput,
  type CreateVideoInput,
  type InsertScoreInput,
  type PlayerLevel,
  type PlayerRepo,
  type RepRecord,
  type RepRepo,
  type SaveAnalysisInput,
  type ScoreRecord,
  type ScoreRepo,
  type ScoreScope,
  type Session,
  type SessionRepo,
  type SessionStatus,
  type SessionType,
  type SettingsRepo,
  type ShootingHand,
  type ShotRecord,
  type ShotRepo,
  type Player,
  type Video,
  type VideoRepo,
  type VideoSource,
} from "$lib/shared/db/repos";
import { ForbiddenError } from "./errors";

// ---------------------------------------------------------------------------
// Row types + mappers (server-local copies of the private repo mappers)
// ---------------------------------------------------------------------------

interface PlayerRow {
  id: string;
  name: string;
  shooting_hand: ShootingHand;
  level: PlayerLevel;
  created_at: number;
  updated_at: number;
  user_id: string | null;
}
const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  name: r.name,
  shootingHand: r.shooting_hand,
  level: r.level,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface VideoRow {
  id: string;
  player_id: string;
  source: VideoSource;
  file_uri: string | null;
  duration_ms: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  created_at: number;
}
const toVideo = (r: VideoRow): Video => ({
  id: r.id,
  playerId: r.player_id,
  source: r.source,
  fileUri: r.file_uri,
  durationMs: r.duration_ms,
  fps: r.fps,
  width: r.width,
  height: r.height,
  createdAt: r.created_at,
});

interface SessionRow {
  id: string;
  player_id: string;
  type: SessionType;
  status: SessionStatus;
  plan_item_id: string | null;
  focus_metric: string | null;
  started_at: number;
  completed_at: number | null;
  notes: string | null;
}
const toSession = (r: SessionRow): Session => ({
  id: r.id,
  playerId: r.player_id,
  type: r.type,
  status: r.status,
  planItemId: r.plan_item_id,
  focusMetric: r.focus_metric,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  notes: r.notes,
});

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
const toShot = (r: ShotRow): ShotRecord => ({
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
});

interface ScoreRow {
  id: string;
  scope: ScoreScope;
  ref_id: string;
  benchmark_id: string;
  scoring_version: number;
  form_score: number | null;
  consistency_score: number | null;
  efficiency_score: number | null;
  overall_score: number | null;
  breakdown_json: string;
  created_at: number;
}
const toScore = (r: ScoreRow): ScoreRecord => ({
  id: r.id,
  scope: r.scope,
  refId: r.ref_id,
  benchmarkId: r.benchmark_id,
  scoringVersion: r.scoring_version,
  formScore: r.form_score,
  consistencyScore: r.consistency_score,
  efficiencyScore: r.efficiency_score,
  overallScore: r.overall_score,
  breakdown: parseJson(r.breakdown_json, `scores.${r.id}`),
  createdAt: r.created_at,
});

interface RepRow {
  id: string;
  session_id: string;
  rep_index: number;
  shot_id: string | null;
  rep_score: number | null;
  primary_cue: string | null;
  feedback_json: string | null;
  created_at: number;
}
const toRep = (r: RepRow): RepRecord => ({
  id: r.id,
  sessionId: r.session_id,
  repIndex: r.rep_index,
  shotId: r.shot_id,
  repScore: r.rep_score,
  primaryCue: r.primary_cue,
  feedback: r.feedback_json ? parseJson(r.feedback_json, `reps.${r.id}`) : null,
  createdAt: r.created_at,
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createServerRepos(
  db: DatabaseAdapter,
  userId: string,
  clock: Clock = systemClock,
  ids = uuidIdGenerator,
): AppRepos {
  // --- ownership guards ----------------------------------------------------
  const owns = async (sql: string, params: (string | number)[]) =>
    (await db.query(sql, params)).length > 0;

  const playerOwned = (id: string) =>
    owns("SELECT 1 FROM players WHERE id = ? AND user_id = ?", [id, userId]);
  const sessionOwned = (id: string) =>
    owns("SELECT 1 FROM sessions WHERE id = ? AND user_id = ?", [id, userId]);
  const shotOwned = (id: string) =>
    owns(
      `SELECT 1 FROM shots s JOIN sessions se ON s.session_id = se.id
       WHERE s.id = ? AND se.user_id = ?`,
      [id, userId],
    );
  const videoOwned = (id: string) =>
    owns("SELECT 1 FROM videos WHERE id = ? AND user_id = ?", [id, userId]);
  const refOwned = (scope: ScoreScope, refId: string) =>
    scope === "shot" ? shotOwned(refId) : sessionOwned(refId);

  async function assert(check: Promise<boolean>, what: string): Promise<void> {
    if (!(await check)) throw new ForbiddenError(`not your ${what}`);
  }

  // --- player --------------------------------------------------------------
  const player: PlayerRepo = {
    setCurrentUser() {
      /* fixed at construction on the server; no-op */
    },
    async claimUnowned() {
      /* no pre-auth rows exist server-side; no-op */
    },
    async create(input: CreatePlayerInput) {
      const now = clock.now();
      const p: Player = {
        id: ids.next(),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      await db.run(
        `INSERT INTO players (id, name, shooting_hand, level, created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          p.shootingHand,
          p.level,
          p.createdAt,
          p.updatedAt,
          userId,
        ],
      );
      return p;
    },
    async get(id) {
      const rows = await db.query<PlayerRow>(
        "SELECT * FROM players WHERE id = ? AND user_id = ?",
        [id, userId],
      );
      return rows[0] ? toPlayer(rows[0]) : null;
    },
    async getFirst() {
      const rows = await db.query<PlayerRow>(
        "SELECT * FROM players WHERE user_id = ? ORDER BY created_at LIMIT 1",
        [userId],
      );
      return rows[0] ? toPlayer(rows[0]) : null;
    },
    async update(id, patch) {
      const existing = await this.get(id);
      if (!existing) return null; // not found or not owned
      const next: Player = { ...existing, ...patch, updatedAt: clock.now() };
      await db.run(
        `UPDATE players SET name = ?, shooting_hand = ?, level = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
        [next.name, next.shootingHand, next.level, next.updatedAt, id, userId],
      );
      return next;
    },
  };

  // --- video ---------------------------------------------------------------
  const video: VideoRepo = {
    async create(input: CreateVideoInput) {
      await assert(playerOwned(input.playerId), "player");
      const v: Video = {
        id: ids.next(),
        playerId: input.playerId,
        source: input.source,
        fileUri: input.fileUri ?? null,
        durationMs: input.durationMs ?? null,
        fps: input.fps ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        createdAt: clock.now(),
      };
      await db.run(
        `INSERT INTO videos (id, player_id, source, file_uri, duration_ms, fps, width, height, created_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          v.playerId,
          v.source,
          v.fileUri,
          v.durationMs,
          v.fps,
          v.width,
          v.height,
          v.createdAt,
          userId,
        ],
      );
      return v;
    },
    async get(id) {
      const rows = await db.query<VideoRow>(
        "SELECT * FROM videos WHERE id = ? AND user_id = ?",
        [id, userId],
      );
      return rows[0] ? toVideo(rows[0]) : null;
    },
  };

  // --- session -------------------------------------------------------------
  const session: SessionRepo = {
    async create(input: CreateSessionInput) {
      await assert(playerOwned(input.playerId), "player");
      const s: Session = {
        id: ids.next(),
        playerId: input.playerId,
        type: input.type,
        status: "in_progress",
        planItemId: input.planItemId ?? null,
        focusMetric: input.focusMetric ?? null,
        startedAt: clock.now(),
        completedAt: null,
        notes: input.notes ?? null,
      };
      await db.run(
        `INSERT INTO sessions (id, player_id, type, status, plan_item_id, focus_metric, started_at, completed_at, notes, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.playerId,
          s.type,
          s.status,
          s.planItemId,
          s.focusMetric,
          s.startedAt,
          s.completedAt,
          s.notes,
          userId,
        ],
      );
      return s;
    },
    async get(id) {
      const rows = await db.query<SessionRow>(
        "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
        [id, userId],
      );
      return rows[0] ? toSession(rows[0]) : null;
    },
    async complete(id) {
      await assert(sessionOwned(id), "session");
      await db.run(
        "UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ? AND user_id = ?",
        [clock.now(), id, userId],
      );
    },
    async abort(id) {
      await assert(sessionOwned(id), "session");
      await db.run(
        "UPDATE sessions SET status = 'aborted', completed_at = ? WHERE id = ? AND user_id = ?",
        [clock.now(), id, userId],
      );
    },
    async listByPlayer(playerId, filter = {}) {
      const clauses = ["player_id = ?", "user_id = ?"];
      const params: (string | number)[] = [playerId, userId];
      if (filter.type) {
        clauses.push("type = ?");
        params.push(filter.type);
      }
      if (filter.status) {
        clauses.push("status = ?");
        params.push(filter.status);
      }
      const rows = await db.query<SessionRow>(
        `SELECT * FROM sessions WHERE ${clauses.join(" AND ")} ORDER BY started_at DESC`,
        params,
      );
      return rows.map(toSession);
    },
  };

  // --- shot ----------------------------------------------------------------
  const shot: ShotRepo = {
    async saveAnalysis(input: SaveAnalysisInput) {
      await assert(sessionOwned(input.sessionId), "session");
      if (input.videoId) await assert(videoOwned(input.videoId), "video");
      const { analysis } = input;
      const rec: ShotRecord = {
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
            rec.id,
            rec.sessionId,
            rec.videoId,
            rec.shotIndex,
            rec.orientation,
            rec.startFrame,
            rec.endFrame,
            rec.overallConfidence,
            fromBool(rec.excluded),
            JSON.stringify(analysis),
            rec.createdAt,
          ],
        );
        for (const [name, metric] of Object.entries(analysis.metrics)) {
          const isNumeric = typeof metric.value === "number";
          await tx.run(
            `INSERT INTO shot_metrics (shot_id, metric_name, value_num, value_text, unit, frame, confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              rec.id,
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
      return rec;
    },
    async get(id) {
      const rows = await db.query<ShotRow>(
        `SELECT s.* FROM shots s JOIN sessions se ON s.session_id = se.id
         WHERE s.id = ? AND se.user_id = ?`,
        [id, userId],
      );
      return rows[0] ? toShot(rows[0]) : null;
    },
    async listBySession(sessionId, opts = {}) {
      const excl = opts.includeExcluded ? "" : "AND s.excluded = 0";
      const rows = await db.query<ShotRow>(
        `SELECT s.* FROM shots s JOIN sessions se ON s.session_id = se.id
         WHERE s.session_id = ? AND se.user_id = ? ${excl} ORDER BY s.shot_index`,
        [sessionId, userId],
      );
      return rows.map(toShot);
    },
    async setExcluded(id, excluded) {
      await assert(shotOwned(id), "shot");
      await db.run("UPDATE shots SET excluded = ? WHERE id = ?", [
        fromBool(excluded),
        id,
      ]);
    },
  };

  // --- score ---------------------------------------------------------------
  // Ownership subquery for a given scope: the set of ref ids this user owns.
  const ownedRefsSubquery = (scope: ScoreScope) =>
    scope === "shot"
      ? `SELECT s.id FROM shots s JOIN sessions se ON s.session_id = se.id WHERE se.user_id = ?`
      : `SELECT id FROM sessions WHERE user_id = ?`;

  const score: ScoreRepo = {
    async insert(input: InsertScoreInput) {
      await assert(refOwned(input.scope, input.refId), input.scope);
      const rec: ScoreRecord = {
        id: ids.next(),
        scope: input.scope,
        refId: input.refId,
        benchmarkId: input.benchmarkId,
        scoringVersion: input.scoringVersion,
        formScore: input.formScore ?? null,
        consistencyScore: input.consistencyScore ?? null,
        efficiencyScore: input.efficiencyScore ?? null,
        overallScore: input.overallScore ?? null,
        breakdown: input.breakdown,
        createdAt: clock.now(),
      };
      await db.run(
        `INSERT INTO scores (id, scope, ref_id, benchmark_id, scoring_version,
           form_score, consistency_score, efficiency_score, overall_score, breakdown_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rec.id,
          rec.scope,
          rec.refId,
          rec.benchmarkId,
          rec.scoringVersion,
          rec.formScore,
          rec.consistencyScore,
          rec.efficiencyScore,
          rec.overallScore,
          JSON.stringify(rec.breakdown),
          rec.createdAt,
        ],
      );
      return rec;
    },
    async latestForRef(scope, refId) {
      const rows = await db.query<ScoreRow>(
        `SELECT * FROM scores WHERE scope = ? AND ref_id = ?
           AND ref_id IN (${ownedRefsSubquery(scope)})
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [scope, refId, userId],
      );
      return rows[0] ? toScore(rows[0]) : null;
    },
    async listForRef(scope, refId) {
      const rows = await db.query<ScoreRow>(
        `SELECT * FROM scores WHERE scope = ? AND ref_id = ?
           AND ref_id IN (${ownedRefsSubquery(scope)})
         ORDER BY created_at`,
        [scope, refId, userId],
      );
      return rows.map(toScore);
    },
    async latestForRefs(scope, refIds) {
      const result = new Map<string, ScoreRecord>();
      if (refIds.length === 0) return result;
      const placeholders = refIds.map(() => "?").join(",");
      const rows = await db.query<ScoreRow>(
        `SELECT * FROM scores WHERE scope = ? AND ref_id IN (${placeholders})
           AND ref_id IN (${ownedRefsSubquery(scope)})
         ORDER BY created_at, id`,
        [scope, ...refIds, userId],
      );
      for (const row of rows) result.set(row.ref_id, toScore(row));
      return result;
    },
  };

  // --- rep -----------------------------------------------------------------
  const rep: RepRepo = {
    async create(input: CreateRepInput) {
      await assert(sessionOwned(input.sessionId), "session");
      const rec: RepRecord = {
        id: ids.next(),
        sessionId: input.sessionId,
        repIndex: input.repIndex,
        shotId: input.shotId ?? null,
        repScore: input.repScore ?? null,
        primaryCue: input.primaryCue ?? null,
        feedback: input.feedback ?? null,
        createdAt: clock.now(),
      };
      await db.run(
        `INSERT INTO reps (id, session_id, rep_index, shot_id, rep_score, primary_cue, feedback_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rec.id,
          rec.sessionId,
          rec.repIndex,
          rec.shotId,
          rec.repScore,
          rec.primaryCue,
          rec.feedback === null ? null : JSON.stringify(rec.feedback),
          rec.createdAt,
        ],
      );
      return rec;
    },
    async listBySession(sessionId) {
      const rows = await db.query<RepRow>(
        `SELECT r.* FROM reps r JOIN sessions se ON r.session_id = se.id
         WHERE r.session_id = ? AND se.user_id = ? ORDER BY r.rep_index`,
        [sessionId, userId],
      );
      return rows.map(toRep);
    },
  };

  // --- settings ------------------------------------------------------------
  // App-level config + seed flags (onboarded, active benchmark, …); global for
  // now. Per-user settings are a later refinement (see docs/follow-up-work.md).
  const settings: SettingsRepo = {
    async get(key) {
      const spec = SETTINGS[key];
      const rows = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        [key],
      );
      const raw = rows[0]?.value;
      if (raw === undefined) return spec.default as never;
      try {
        return spec.schema.parse(JSON.parse(raw)) as never;
      } catch {
        return spec.default as never;
      }
    },
    async set(key, value) {
      const spec = SETTINGS[key];
      const parsed = spec.schema.parse(value);
      await db.run(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [key, JSON.stringify(parsed)],
      );
    },
  };

  return { player, video, session, shot, score, rep, settings };
}
