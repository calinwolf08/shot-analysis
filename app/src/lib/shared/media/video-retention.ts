/**
 * "Keep video for the last N shots" — a PER-DEVICE setting, because the clips
 * it governs live only on this device (IndexedDB / app files). Stored in
 * localStorage rather than the server settings: those are global on the
 * server today (see docs/follow-up-work.md), and a device-local cap shouldn't
 * follow the user to — or be changed from — another device anyway.
 */
import { DEFAULT_CLIP_CAP } from "./shot-clip-store";

const KEY = "shotcoach.videoRetention";

export function getVideoRetention(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 100 ? n : DEFAULT_CLIP_CAP;
  } catch {
    return DEFAULT_CLIP_CAP;
  }
}

export function setVideoRetention(n: number): void {
  try {
    localStorage.setItem(
      KEY,
      String(Math.max(0, Math.min(100, Math.round(n)))),
    );
  } catch {
    /* storage unavailable: the default applies */
  }
}
