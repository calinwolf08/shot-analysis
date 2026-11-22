/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
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
