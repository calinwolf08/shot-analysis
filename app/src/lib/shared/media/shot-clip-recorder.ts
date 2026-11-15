/**
 * Thin MediaRecorder wrapper for capturing a short clip of a single shot from
 * the live camera stream. The loop starts it when the player is positioned and
 * takes the clip when a shot is scored, so each clip spans roughly "ready →
 * shot", which is exactly what the review screen wants to play back.
 *
 * Returns null when MediaRecorder isn't available (SSR, replay/e2e, some
 * webviews) so callers never branch on platform — recording is simply skipped.
 */
export interface ShotClipRecorder {
  readonly recording: boolean;
  /** Begin (or continue) recording. Idempotent while already recording. */
  start(): void;
  /** Stop and resolve the recorded clip, or null if nothing was captured. */
  stopAndTake(): Promise<Blob | null>;
  /** Stop and discard (e.g. the player walked out of frame). */
  discard(): void;
}

const PREFERRED_MIME = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

export function createShotClipRecorder(
  stream: MediaStream,
): ShotClipRecorder | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (stream.getVideoTracks().length === 0) return null;

  const mime =
    PREFERRED_MIME.find((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    }) ?? "";

  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  function take(): Blob | null {
    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: mime || "video/webm" });
  }

  return {
    get recording() {
      return rec?.state === "recording";
    },
    start() {
      if (rec && rec.state === "recording") return;
      chunks = [];
      try {
        rec = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch {
        rec = null;
        return;
      }
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.start();
    },
    stopAndTake() {
      return new Promise((resolve) => {
        const r = rec;
        if (!r || r.state === "inactive") {
          resolve(take());
          return;
        }
        r.onstop = () => {
          const blob = take();
          chunks = [];
          resolve(blob);
        };
        try {
          r.stop();
        } catch {
          resolve(take());
        }
      });
    },
    discard() {
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {
        /* ignore */
      }
      chunks = [];
    },
  };
}
