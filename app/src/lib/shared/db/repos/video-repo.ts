import type { RepoContext } from "../repo-base";
import type { Video, VideoSource } from "./types";

export interface CreateVideoInput {
  playerId: string;
  source: VideoSource;
  fileUri?: string;
  durationMs?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface VideoRepo {
  create(input: CreateVideoInput): Promise<Video>;
  get(id: string): Promise<Video | null>;
}

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

function toVideo(r: VideoRow): Video {
  return {
    id: r.id,
    playerId: r.player_id,
    source: r.source,
    fileUri: r.file_uri,
    durationMs: r.duration_ms,
    fps: r.fps,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
  };
}

export function createVideoRepo(ctx: RepoContext): VideoRepo {
  const { db, clock, ids } = ctx;
  return {
    async create(input) {
      const video: Video = {
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
        `INSERT INTO videos (id, player_id, source, file_uri, duration_ms, fps, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          video.id,
          video.playerId,
          video.source,
          video.fileUri,
          video.durationMs,
          video.fps,
          video.width,
          video.height,
          video.createdAt,
        ],
      );
      return video;
    },

    async get(id) {
      const rows = await db.query<VideoRow>(
        "SELECT * FROM videos WHERE id = ?",
        [id],
      );
      return rows[0] ? toVideo(rows[0]) : null;
    },
  };
}
