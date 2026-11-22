/**
 * User-scoped repositories for the server.
 *
 * `createServerRepos(kdb, userId)` returns the same {@link AppRepos} interfaces
 * the app already uses, but every read is filtered to `userId` and every write
 * verifies ownership first — so one user can never see or mutate another user's
 * data, even with a guessed id. `players.user_id` is the ownership root;
 * `sessions`/`videos` carry `user_id` directly; deeper tables (shots, scores,
 * reps) are scoped by joining up to their owning session.
 *
 * Queries go through Kysely, so they run unchanged on SQLite and Postgres
 * (docs/database-abstraction-plan.md).
 *
 * Server-only.
 */
import type { ShotAnalysis } from "basketball-shot-analysis";
import type { AppKysely } from "./database/kysely";
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
  type ShotReviewPoses,
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
  shooting_hand: string;
  level: string;
  created_at: number;
  updated_at: number;
  user_id: string | null;
}
const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  name: r.name,
  shootingHand: r.shooting_hand as ShootingHand,
  level: r.level as PlayerLevel,
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
  player_id: string;
  session_id: string | null;
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
  playerId: r.player_id,
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
  kdb: AppKysely,
  userId: string,
  clock: Clock = systemClock,
  ids = uuidIdGenerator,
): AppRepos {
  // --- ownership guards ----------------------------------------------------
  const exists = async (q: { executeTakeFirst(): Promise<unknown> }) =>
    (await q.executeTakeFirst()) !== undefined;

  const playerOwned = (id: string) =>
    exists(
      kdb
        .selectFrom("players")
        .select("id")
        .where("id", "=", id)
        .where("user_id", "=", userId),
    );
  const sessionOwned = (id: string) =>
    exists(
      kdb
        .selectFrom("sessions")
        .select("id")
        .where("id", "=", id)
        .where("user_id", "=", userId),
    );
  const shotOwned = (id: string) =>
    exists(
      kdb
        .selectFrom("shots as s")
        .innerJoin("players as p", "s.player_id", "p.id")
        .select("s.id")
        .where("s.id", "=", id)
        .where("p.user_id", "=", userId),
    );
  const videoOwned = (id: string) =>
    exists(
      kdb
        .selectFrom("videos")
        .select("id")
        .where("id", "=", id)
        .where("user_id", "=", userId),
    );
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
      await kdb
        .insertInto("players")
        .values({
          id: p.id,
          name: p.name,
          shooting_hand: p.shootingHand,
          level: p.level,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
          user_id: userId,
        })
        .execute();
      return p;
    },
    async get(id) {
      const row = await kdb
        .selectFrom("players")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      return row ? toPlayer(row) : null;
    },
    async getFirst() {
      const row = await kdb
        .selectFrom("players")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at")
        .limit(1)
        .executeTakeFirst();
      return row ? toPlayer(row) : null;
    },
    async update(id, patch) {
      const existing = await this.get(id);
      if (!existing) return null; // not found or not owned
      const next: Player = { ...existing, ...patch, updatedAt: clock.now() };
      await kdb
        .updateTable("players")
        .set({
          name: next.name,
          shooting_hand: next.shootingHand,
          level: next.level,
          updated_at: next.updatedAt,
        })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .execute();
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
      await kdb
        .insertInto("videos")
        .values({
          id: v.id,
          player_id: v.playerId,
          source: v.source,
          file_uri: v.fileUri,
          duration_ms: v.durationMs,
          fps: v.fps,
          width: v.width,
          height: v.height,
          created_at: v.createdAt,
          user_id: userId,
        })
        .execute();
      return v;
    },
    async get(id) {
      const row = await kdb
        .selectFrom("videos")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      return row ? toVideo(row) : null;
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
      await kdb
        .insertInto("sessions")
        .values({
          id: s.id,
          player_id: s.playerId,
          type: s.type,
          status: s.status,
          plan_item_id: s.planItemId,
          focus_metric: s.focusMetric,
          started_at: s.startedAt,
          completed_at: s.completedAt,
          notes: s.notes,
          user_id: userId,
        })
        .execute();
      return s;
    },
    async get(id) {
      const row = await kdb
        .selectFrom("sessions")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      return row ? toSession(row) : null;
    },
    async complete(id) {
      await assert(sessionOwned(id), "session");
      await kdb
        .updateTable("sessions")
        .set({ status: "completed", completed_at: clock.now() })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .execute();
    },
    async abort(id) {
      await assert(sessionOwned(id), "session");
      await kdb
        .updateTable("sessions")
        .set({ status: "aborted", completed_at: clock.now() })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .execute();
    },
    async listByPlayer(playerId, filter = {}) {
      let q = kdb
        .selectFrom("sessions")
        .selectAll()
        .where("player_id", "=", playerId)
        .where("user_id", "=", userId);
      if (filter.type) q = q.where("type", "=", filter.type);
      if (filter.status) q = q.where("status", "=", filter.status);
      const rows = await q.orderBy("started_at", "desc").execute();
      return rows.map(toSession);
    },
  };

  // --- shot ----------------------------------------------------------------
  const shot: ShotRepo = {
    async saveAnalysis(input: SaveAnalysisInput) {
      const sessionId = input.sessionId ?? null;
      if (sessionId) await assert(sessionOwned(sessionId), "session");
      if (input.videoId) await assert(videoOwned(input.videoId), "video");

      // Resolve the owning player: explicit (live) or from the session
      // (assessment). Verify ownership either way.
      let playerId = input.playerId ?? null;
      if (playerId) {
        await assert(playerOwned(playerId), "player");
      } else if (sessionId) {
        const row = await kdb
          .selectFrom("sessions")
          .select("player_id")
          .where("id", "=", sessionId)
          .where("user_id", "=", userId)
          .executeTakeFirst();
        playerId = row?.player_id ?? null;
      }
      if (!playerId) throw new ForbiddenError("not your player");

      const { analysis } = input;
      const rec: ShotRecord = {
        id: ids.next(),
        playerId,
        sessionId,
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
      await kdb.transaction().execute(async (trx) => {
        await trx
          .insertInto("shots")
          .values({
            id: rec.id,
            player_id: rec.playerId,
            session_id: rec.sessionId,
            video_id: rec.videoId,
            shot_index: rec.shotIndex,
            orientation: rec.orientation,
            start_frame: rec.startFrame,
            end_frame: rec.endFrame,
            overall_confidence: rec.overallConfidence,
            excluded: fromBool(rec.excluded),
            analysis_json: JSON.stringify(analysis),
            created_at: rec.createdAt,
          })
          .execute();
        for (const [name, metric] of Object.entries(analysis.metrics)) {
          const isNumeric = typeof metric.value === "number";
          await trx
            .insertInto("shot_metrics")
            .values({
              shot_id: rec.id,
              metric_name: name,
              value_num: isNumeric ? (metric.value as number) : null,
              value_text: isNumeric ? null : String(metric.value),
              unit: metric.unit ?? null,
              frame: metric.frame ?? null,
              confidence: metric.confidence ?? null,
            })
            .execute();
        }
        if (input.reviewPoses) {
          await trx
            .insertInto("shot_poses")
            .values({
              shot_id: rec.id,
              poses_json: JSON.stringify(input.reviewPoses),
            })
            .execute();
        }
      });
      return rec;
    },
    async getPoses(id) {
      const row = await kdb
        .selectFrom("shot_poses as sp")
        .innerJoin("shots as s", "sp.shot_id", "s.id")
        .innerJoin("players as p", "s.player_id", "p.id")
        .select("sp.poses_json")
        .where("sp.shot_id", "=", id)
        .where("p.user_id", "=", userId)
        .executeTakeFirst();
      return row
        ? parseJson<ShotReviewPoses>(row.poses_json, `shot_poses.${id}`)
        : null;
    },
    async get(id) {
      const row = await kdb
        .selectFrom("shots as s")
        .innerJoin("players as p", "s.player_id", "p.id")
        .selectAll("s")
        .where("s.id", "=", id)
        .where("p.user_id", "=", userId)
        .executeTakeFirst();
      return row ? toShot(row) : null;
    },
    // Assessment/upload path only; the live flow uses listByPlayer.
    async listBySession(sessionId, opts = {}) {
      let q = kdb
        .selectFrom("shots as s")
        .innerJoin("sessions as se", "s.session_id", "se.id")
        .selectAll("s")
        .where("s.session_id", "=", sessionId)
        .where("se.user_id", "=", userId);
      if (!opts.includeExcluded) q = q.where("s.excluded", "=", 0);
      const rows = await q.orderBy("s.shot_index").execute();
      return rows.map(toShot);
    },
    async listByPlayer(playerId, opts = {}) {
      let q = kdb
        .selectFrom("shots as s")
        .innerJoin("players as p", "s.player_id", "p.id")
        .selectAll("s")
        .where("s.player_id", "=", playerId)
        .where("p.user_id", "=", userId);
      if (!opts.includeExcluded) q = q.where("s.excluded", "=", 0);
      if (opts.since !== undefined)
        q = q.where("s.created_at", ">=", opts.since);
      q = q.orderBy("s.created_at", "desc").orderBy("s.shot_index", "desc");
      if (opts.limit !== undefined) q = q.limit(opts.limit);
      const rows = await q.execute();
      return rows.map(toShot);
    },
    async setExcluded(id, excluded) {
      await assert(shotOwned(id), "shot");
      await kdb
        .updateTable("shots")
        .set({ excluded: fromBool(excluded) })
        .where("id", "=", id)
        .execute();
    },
    async updateAnalysis(id, analysis) {
      await assert(shotOwned(id), "shot");
      await kdb
        .updateTable("shots")
        .set({ analysis_json: JSON.stringify(analysis) })
        .where("id", "=", id)
        .execute();
    },
  };

  // --- score ---------------------------------------------------------------
  // Ownership subquery for a given scope: the ref ids this user owns.
  const ownedRefs = (scope: ScoreScope) =>
    scope === "shot"
      ? kdb
          .selectFrom("shots as s")
          .innerJoin("players as p", "s.player_id", "p.id")
          .select("s.id")
          .where("p.user_id", "=", userId)
      : kdb.selectFrom("sessions").select("id").where("user_id", "=", userId);

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
      await kdb
        .insertInto("scores")
        .values({
          id: rec.id,
          scope: rec.scope,
          ref_id: rec.refId,
          benchmark_id: rec.benchmarkId,
          scoring_version: rec.scoringVersion,
          form_score: rec.formScore,
          consistency_score: rec.consistencyScore,
          efficiency_score: rec.efficiencyScore,
          overall_score: rec.overallScore,
          breakdown_json: JSON.stringify(rec.breakdown),
          created_at: rec.createdAt,
        })
        .execute();
      return rec;
    },
    async latestForRef(scope, refId) {
      const row = await kdb
        .selectFrom("scores")
        .selectAll()
        .where("scope", "=", scope)
        .where("ref_id", "=", refId)
        .where("ref_id", "in", ownedRefs(scope))
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(1)
        .executeTakeFirst();
      return row ? toScore(row) : null;
    },
    async listForRef(scope, refId) {
      const rows = await kdb
        .selectFrom("scores")
        .selectAll()
        .where("scope", "=", scope)
        .where("ref_id", "=", refId)
        .where("ref_id", "in", ownedRefs(scope))
        .orderBy("created_at")
        .execute();
      return rows.map(toScore);
    },
    async latestForRefs(scope, refIds) {
      const result = new Map<string, ScoreRecord>();
      if (refIds.length === 0) return result;
      const rows = await kdb
        .selectFrom("scores")
        .selectAll()
        .where("scope", "=", scope)
        .where("ref_id", "in", [...refIds])
        .where("ref_id", "in", ownedRefs(scope))
        .orderBy("created_at")
        .orderBy("id")
        .execute();
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
      await kdb
        .insertInto("reps")
        .values({
          id: rec.id,
          session_id: rec.sessionId,
          rep_index: rec.repIndex,
          shot_id: rec.shotId,
          rep_score: rec.repScore,
          primary_cue: rec.primaryCue,
          feedback_json:
            rec.feedback === null ? null : JSON.stringify(rec.feedback),
          created_at: rec.createdAt,
        })
        .execute();
      return rec;
    },
    async listBySession(sessionId) {
      const rows = await kdb
        .selectFrom("reps as r")
        .innerJoin("sessions as se", "r.session_id", "se.id")
        .selectAll("r")
        .where("r.session_id", "=", sessionId)
        .where("se.user_id", "=", userId)
        .orderBy("r.rep_index")
        .execute();
      return rows.map(toRep);
    },
  };

  // --- settings ------------------------------------------------------------
  // Per user (migration 007): each account has its own focus areas, voice
  // feedback, onboarding flag and benchmark. Unset keys fall back to defaults.
  const settings: SettingsRepo = {
    async get(key) {
      const spec = SETTINGS[key];
      const row = await kdb
        .selectFrom("user_settings")
        .select("value")
        .where("user_id", "=", userId)
        .where("key", "=", key)
        .executeTakeFirst();
      if (row === undefined) return spec.default as never;
      try {
        return spec.schema.parse(JSON.parse(row.value)) as never;
      } catch {
        return spec.default as never;
      }
    },
    async set(key, value) {
      const spec = SETTINGS[key];
      const json = JSON.stringify(spec.schema.parse(value));
      await kdb
        .insertInto("user_settings")
        .values({ user_id: userId, key, value: json })
        .onConflict((oc) =>
          oc.columns(["user_id", "key"]).doUpdateSet({ value: json }),
        )
        .execute();
    },
  };

  return { player, video, session, shot, score, rep, settings };
}
