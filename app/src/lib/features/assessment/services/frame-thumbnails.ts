/**
 * Captures still images of a shot's start/end frames from the source video
 * so the review step can show *what* was detected, not just frame numbers.
 * Seeks a detached <video> element per requested time and draws to canvas —
 * best effort: any decode/seek failure yields null for that thumbnail.
 */

export interface ShotFrameInfo {
  /** Seconds into the source video. */
  startSec: number;
  endSec: number;
  /** JPEG data URLs, null when capture failed. */
  startThumb: string | null;
  endThumb: string | null;
}

export interface ShotFrameRef {
  id: string;
  startFrame: number | null;
  endFrame: number | null;
}

const THUMB_WIDTH = 220;
const SEEK_TIMEOUT_MS = 5_000;

function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("seek timeout"));
    }, SEEK_TIMEOUT_MS);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video error while seeking"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = timeSec;
  });
}

function drawThumb(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, THUMB_WIDTH / w);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

/**
 * Maps shot id → start/end frame thumbnails for one source video.
 * `fps` converts stored frame indexes to video time; times are clamped
 * to the video's real duration.
 */
export async function captureShotThumbnails(
  file: Blob,
  fps: number,
  shots: readonly ShotFrameRef[],
): Promise<Record<string, ShotFrameInfo>> {
  if (fps <= 0 || shots.length === 0) return {};
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const canvas = document.createElement("canvas");
  const out: Record<string, ShotFrameInfo> = {};

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error("video failed to load")),
        { once: true },
      );
      video.src = url;
    });
    const maxSec = Number.isFinite(video.duration)
      ? Math.max(0, video.duration - 0.01)
      : Number.POSITIVE_INFINITY;

    for (const shot of shots) {
      if (shot.startFrame === null || shot.endFrame === null) continue;
      const startSec = Math.min(shot.startFrame / fps, maxSec);
      const endSec = Math.min(shot.endFrame / fps, maxSec);
      let startThumb: string | null = null;
      let endThumb: string | null = null;
      try {
        await seekTo(video, startSec);
        startThumb = drawThumb(video, canvas);
        await seekTo(video, endSec);
        endThumb = drawThumb(video, canvas);
      } catch {
        // Leave whatever we managed to capture; frame numbers still show.
      }
      out[shot.id] = { startSec, endSec, startThumb, endThumb };
    }
  } catch {
    return out;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
  return out;
}

/** Formats seconds as m:ss.t for display next to frame numbers. */
export function formatVideoTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  const tenth = Math.floor((s - whole) * 10);
  return `${m}:${String(whole).padStart(2, "0")}.${tenth}`;
}
