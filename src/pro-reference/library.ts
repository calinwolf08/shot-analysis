/**
 * The reference library on disk (node only):
 *
 *   reference-data/players/<player>/player.json
 *   reference-data/players/<player>/<clip>/{poses.json, labels.json, <video>}
 *
 * Folders starting with "_" (e.g. `_example`) are ignored. Videos are local
 * only (gitignored); poses.json + labels.json are the committed record.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {
  statusCounts,
  upgradeLabels,
  type AttemptStatus,
  type ClipLabels,
} from "./labels";

export const VIDEO_EXT_RE = /\.(mp4|mov|webm)$/i;
/** Player / clip folder names: lowercase letters, digits, - and _. */
export const SAFE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface PlayerInfo {
  readonly name: string;
  readonly shootingHand: "left" | "right";
  readonly notes?: string;
  /** Written by the target build (Phase 3). */
  readonly proportions?: unknown;
}

export interface LibraryAttempt {
  readonly shotNumber: number;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly status: AttemptStatus;
  readonly angle: number | null;
  readonly confirmed: boolean;
}

export interface LibraryClip {
  readonly id: string;
  readonly poses: boolean;
  readonly video: string | null;
  readonly attempts: readonly LibraryAttempt[];
  readonly counts: Record<AttemptStatus, number>;
}

export interface LibraryPlayer extends PlayerInfo {
  readonly id: string;
  readonly clips: readonly LibraryClip[];
  readonly counts: Record<AttemptStatus, number>;
}

export function safeId(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

function assertId(id: string): void {
  if (!SAFE_ID_RE.test(id)) throw new Error(`Invalid id: ${id}`);
}

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function dirs(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."),
      )
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function parsePlayer(raw: unknown, id: string): PlayerInfo {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    name: typeof r.name === "string" && r.name ? r.name : id,
    shootingHand: r.shootingHand === "left" ? "left" : "right",
    ...(typeof r.notes === "string" ? { notes: r.notes } : {}),
    ...(r.proportions !== undefined ? { proportions: r.proportions } : {}),
  };
}

export async function readLabels(
  root: string,
  player: string,
  clip: string,
): Promise<ClipLabels> {
  assertId(player);
  assertId(clip);
  const raw = await readJson(path.join(root, player, clip, "labels.json"));
  return upgradeLabels(raw ?? {}, "");
}

export async function writeLabels(
  root: string,
  player: string,
  clip: string,
  labels: unknown,
): Promise<ClipLabels> {
  assertId(player);
  assertId(clip);
  const v2 = upgradeLabels(labels);
  const out = { ...v2, labeledAt: new Date().toISOString() };
  await fs.mkdir(path.join(root, player, clip), { recursive: true });
  await fs.writeFile(
    path.join(root, player, clip, "labels.json"),
    JSON.stringify(out, null, 2) + "\n",
  );
  return out;
}

export async function readPlayer(
  root: string,
  player: string,
): Promise<PlayerInfo> {
  assertId(player);
  return parsePlayer(
    await readJson(path.join(root, player, "player.json")),
    player,
  );
}

export async function writePlayer(
  root: string,
  player: string,
  info: Partial<PlayerInfo>,
): Promise<PlayerInfo> {
  assertId(player);
  const prev = await readJson(path.join(root, player, "player.json"));
  const merged = parsePlayer({ ...((prev as object) ?? {}), ...info }, player);
  await fs.mkdir(path.join(root, player), { recursive: true });
  await fs.writeFile(
    path.join(root, player, "player.json"),
    JSON.stringify(merged, null, 2) + "\n",
  );
  return merged;
}

export async function createClip(
  root: string,
  player: string,
  clip: string,
): Promise<void> {
  assertId(player);
  assertId(clip);
  await fs.mkdir(path.join(root, player, clip), { recursive: true });
}

/** A file inside a clip folder (poses.json, labels.json or a video). */
export function clipFile(
  root: string,
  player: string,
  clip: string,
  file: string,
): string {
  assertId(player);
  assertId(clip);
  const base = path.basename(file);
  if (base !== file) throw new Error("Invalid file");
  if (
    base !== "poses.json" &&
    base !== "labels.json" &&
    !VIDEO_EXT_RE.test(base)
  ) {
    throw new Error("Invalid file");
  }
  return path.join(root, player, clip, base);
}

export async function listLibrary(root: string): Promise<LibraryPlayer[]> {
  const out: LibraryPlayer[] = [];
  for (const id of await dirs(root)) {
    if (!SAFE_ID_RE.test(id)) continue;
    const info = parsePlayer(
      await readJson(path.join(root, id, "player.json")),
      id,
    );
    const clips: LibraryClip[] = [];
    for (const c of await dirs(path.join(root, id))) {
      if (!SAFE_ID_RE.test(c)) continue;
      const dir = path.join(root, id, c);
      const files = await fs.readdir(dir).catch(() => [] as string[]);
      const labels = upgradeLabels(
        (await readJson(path.join(dir, "labels.json"))) ?? {},
      );
      const attempts = labels.shots.map((s) => ({
        shotNumber: s.shotNumber,
        startFrame: s.startFrame,
        endFrame: s.endFrame,
        status: s.status,
        angle: s.camera?.angle ?? null,
        confirmed: s.camera?.confirmed ?? false,
      }));
      clips.push({
        id: c,
        poses: files.includes("poses.json"),
        video: files.find((f) => VIDEO_EXT_RE.test(f)) ?? null,
        attempts,
        counts: statusCounts(attempts),
      });
    }
    out.push({
      ...info,
      id,
      clips,
      counts: statusCounts(clips.flatMap((c) => c.attempts)),
    });
  }
  return out;
}
