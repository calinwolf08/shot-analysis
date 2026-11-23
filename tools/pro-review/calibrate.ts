/**
 * Calibration dialog (review page): per player, a photo or short clip of
 * them standing straight, front-on (shoulder / hip widths, for the camera-
 * angle estimate) and side-on (thigh / shin / arm lengths, for the per-segment
 * correction). MediaPipe runs here in the browser; the skeleton is drawn so
 * the person can check it before saving to player.json.
 */
import {
  frontCalibration,
  sideCalibration,
  type CalibrationView,
  type PlayerCalibration,
} from "../../src/pro-reference/calibration";
import type { SignalFrame } from "../../src/metrics/v3";
import { createPoseDetector } from "../../src/pose/factory";
import type { PoseDetector } from "../../src/pose/detector";
import { createVideoElementProvider } from "../../src/providers/video-element";

export interface CalibratePlayer {
  readonly id: string;
  readonly name: string;
  readonly calibration?: PlayerCalibration;
}

const SKELETON: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

let detector: Promise<PoseDetector> | null = null;
function getDetector(): Promise<PoseDetector> {
  detector ??= createPoseDetector({
    runtime: "browser",
    runningMode: "IMAGE",
    delegate: "GPU",
  });
  return detector;
}

interface Measured {
  readonly frames: SignalFrame[];
  readonly aspect: number;
  /** The image the first pose came from, for the preview. */
  readonly preview: HTMLCanvasElement;
}

/** Poses from a photo (one frame) or a short clip (up to `max` frames). */
async function measureFile(
  file: File,
  onProgress: (s: string) => void,
  max = 60,
): Promise<Measured> {
  const det = await getDetector();
  const frames: SignalFrame[] = [];
  let preview: HTMLCanvasElement | null = null;
  let aspect = 1;
  const push = (
    data: Uint8ClampedArray,
    w: number,
    h: number,
    i: number,
    landmarks: { x: number; y: number; visibility?: number }[] | null,
  ) => {
    frames.push({
      frameIndex: i,
      timestamp: i,
      landmarks: landmarks
        ? landmarks.map((l) => ({
            x: l.x,
            y: l.y,
            visibility: l.visibility ?? 0,
          }))
        : null,
    });
    if (!preview && landmarks) {
      preview = document.createElement("canvas");
      preview.width = w;
      preview.height = h;
      preview
        .getContext("2d")!
        .putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
    }
  };
  if (file.type.startsWith("image/")) {
    onProgress("Reading photo…");
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    aspect = c.width / c.height;
    onProgress("Finding the pose…");
    const r = await det
      .detect({
        data: img.data,
        width: c.width,
        height: c.height,
        timestamp: 0,
        frameIndex: 0,
      })
      .catch(() => null);
    push(img.data, c.width, c.height, 0, r ? [...r.landmarks] : null);
  } else {
    const provider = await createVideoElementProvider(file, { fps: 10 });
    const meta = provider.getMetadata();
    aspect = meta.width / meta.height;
    let f = await provider.getNextFrame();
    while (f !== null && frames.length < max) {
      onProgress(
        `Pose ${frames.length + 1} / ${Math.min(max, provider.getTotalFrames())}`,
      );
      const r = await det.detect(f).catch(() => null);
      push(
        new Uint8ClampedArray(f.data),
        f.width,
        f.height,
        f.frameIndex,
        r ? [...r.landmarks] : null,
      );
      f = await provider.getNextFrame();
    }
  }
  if (!preview)
    throw new Error("No pose found: is the whole body in the picture?");
  return { frames, aspect, preview };
}

function drawPreview(target: HTMLCanvasElement, m: Measured): void {
  const src = m.preview;
  const w = target.clientWidth || 320;
  const h = Math.round((w * src.height) / src.width);
  target.width = w;
  target.height = h;
  const ctx = target.getContext("2d")!;
  ctx.drawImage(src, 0, 0, w, h);
  const lm = m.frames.find((f) => f.landmarks)?.landmarks;
  if (!lm) return;
  ctx.strokeStyle = "#40e078";
  ctx.lineWidth = 3;
  for (const [a, b] of SKELETON) {
    const p = lm[a];
    const q = lm[b];
    if (!p || !q || p.visibility < 0.3 || q.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
const r2 = (n: number | null | undefined) =>
  typeof n === "number" ? n.toFixed(2) : "–";

function current(c: PlayerCalibration | undefined): string {
  const f = c?.front;
  const s = c?.side;
  return `<table>
    <tr><th>Front-on</th><td>${f ? `shoulders ${r2(f.shoulders)} · hips ${r2(f.hips)} × torso <span class="dim small">(${f.frames} frame(s), ${esc(f.at.slice(0, 10))})</span>` : `<span class="dim">not calibrated — population average (0.80 / 0.50)</span>`}</td></tr>
    <tr><th>Side-on</th><td>${s ? `thigh ${r2(s.thigh)} · shin ${r2(s.shin)} · upper arm ${r2(s.upperArm)} · forearm ${r2(s.forearm)} × torso <span class="dim small">(${s.frames} frame(s), ${esc(s.at.slice(0, 10))})</span>` : `<span class="dim">not calibrated — lengths from the player's clips</span>`}</td></tr>
  </table>`;
}

/**
 * Opens the calibration dialog for a player; `save` posts the new view(s) and
 * resolves with the player's updated calibration.
 */
export function openCalibration(
  player: CalibratePlayer,
  save: (
    calibration: PlayerCalibration,
  ) => Promise<PlayerCalibration | undefined>,
): void {
  const dlg = document.getElementById("calibrateDialog") as HTMLDialogElement;
  let calibration = player.calibration;
  const render = () => {
    dlg.innerHTML = `
      <h2>Calibrate ${esc(player.name)}</h2>
      <p class="small dim">A photo (or a few seconds of video) of the player standing straight, whole body in the picture, camera level at about chest height. Front-on: square to their chest, arms slightly out. Side-on: square to their side, legs straight.</p>
      <div id="calCurrent">${current(calibration)}</div>
      <div class="row" style="margin-top:10px">
        <label><input type="radio" name="calView" value="front" checked> Front-on</label>
        <label><input type="radio" name="calView" value="side"> Side-on</label>
        <input id="calFile" type="file" accept="image/*,video/*">
      </div>
      <p id="calStatus" class="small"></p>
      <canvas id="calPreview" style="width:100%;max-height:50vh;display:none"></canvas>
      <div id="calResult"></div>
      <div class="row" style="margin-top:10px;justify-content:flex-end">
        <button id="calSave" class="primary" disabled>Save</button>
        <button id="calClose">Close</button>
      </div>`;
    const status = dlg.querySelector<HTMLElement>("#calStatus")!;
    const result = dlg.querySelector<HTMLElement>("#calResult")!;
    const saveBtn = dlg.querySelector<HTMLButtonElement>("#calSave")!;
    const canvas = dlg.querySelector<HTMLCanvasElement>("#calPreview")!;
    let pending: PlayerCalibration | null = null;
    dlg
      .querySelector("#calClose")!
      .addEventListener("click", () => dlg.close());
    dlg
      .querySelector<HTMLInputElement>("#calFile")!
      .addEventListener("change", async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const view = dlg.querySelector<HTMLInputElement>(
          'input[name="calView"]:checked',
        )!.value as CalibrationView;
        pending = null;
        saveBtn.disabled = true;
        result.innerHTML = "";
        try {
          const m = await measureFile(file, (s) => (status.textContent = s));
          canvas.style.display = "block";
          drawPreview(canvas, m);
          const at = new Date().toISOString();
          if (view === "front") {
            const r = frontCalibration(m.frames, m.aspect);
            if (r.values) {
              pending = { front: { ...r.values, frames: r.frames, at } };
              result.innerHTML = `<p>Shoulders <b>${r2(r.values.shoulders)}</b> · hips <b>${r2(r.values.hips)}</b> × torso length (${r.frames} frame(s)).</p>`;
            }
            result.innerHTML += r.warnings
              .map((w) => `<div class="flag">⚑ ${esc(w)}</div>`)
              .join("");
          } else {
            const r = sideCalibration(m.frames, m.aspect);
            if (r.values) {
              pending = { side: { ...r.values, frames: r.frames, at } };
              result.innerHTML = `<p>Thigh <b>${r2(r.values.thigh)}</b> · shin <b>${r2(r.values.shin)}</b> · upper arm <b>${r2(r.values.upperArm)}</b> · forearm <b>${r2(r.values.forearm)}</b> × torso length (${r.frames} frame(s)).</p>`;
            }
            result.innerHTML += r.warnings
              .map((w) => `<div class="flag">⚑ ${esc(w)}</div>`)
              .join("");
          }
          status.textContent = pending
            ? "Check the skeleton matches the body, then Save."
            : "Couldn't measure this picture.";
          saveBtn.disabled = !pending;
        } catch (err) {
          status.textContent = (err as Error).message;
        }
      });
    saveBtn.addEventListener("click", async () => {
      if (!pending) return;
      saveBtn.disabled = true;
      status.textContent = "Saving…";
      calibration = (await save(pending)) ?? calibration;
      dlg.querySelector<HTMLElement>("#calCurrent")!.innerHTML =
        current(calibration);
      status.textContent = "Saved. Camera angles now use this calibration.";
      pending = null;
    });
  };
  render();
  dlg.showModal();
}
