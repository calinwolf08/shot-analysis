/**
 * Pro reference review page (`/pros`, docs/pro-targets-plan.md Phase 2).
 *
 * Library of players → clips → shot attempts. Per attempt: label key frames
 * (and compare with the app's detection), confirm or adjust the camera angle,
 * see the metrics the way the app shows them (0–10+ score, short wording,
 * highlighted body part + target zone), flag metrics, and approve / flag /
 * exclude the attempt. Everything saves to the clip's labels.json (v2), which
 * the target build reads.
 *
 * Measurement comes from src/pro-reference (shared with the target build);
 * the target-zone drawing is the app's own module.
 */
import {
  KEYFRAMES,
  autoFlags,
  keyframeChecks,
  measureAttempt,
  metricRows,
  newAttempt,
  playerOutliers,
  statusCounts,
  upgradeLabels,
  type AttemptLabel,
  type AttemptMeasurement,
  type AttemptStatus,
  type ClipLabels,
  type MetricRow,
  type PoseFile,
} from "../../src/pro-reference";
import { detectShots } from "../../src/detection/pose-shot-detector";
import type { LiveTargetsV3 } from "../../src/metrics/v3";
import {
  drawGeometry,
  geometryFor,
  geometryFamily,
} from "../../app/src/lib/features/reference/metric-geometry";
import {
  drawTargetZone,
  targetZone,
} from "../../app/src/lib/features/reference/target-zone";
import { createPoseDetector } from "../../src/pose/factory";
import { createVideoElementProvider } from "../../src/providers/video-element";

// ---- types from the server ---------------------------------------------------

interface LibAttempt {
  shotNumber: number;
  startFrame: number;
  endFrame: number;
  status: AttemptStatus;
  angle: number | null;
  confirmed: boolean;
}
interface LibClip {
  id: string;
  poses: boolean;
  video: string | null;
  attempts: LibAttempt[];
  counts: Record<AttemptStatus, number>;
}
interface LibPlayer {
  id: string;
  name: string;
  shootingHand: "left" | "right";
  clips: LibClip[];
  counts: Record<AttemptStatus, number>;
}
interface Wording {
  format: string;
  metrics: Record<string, { low?: string; high?: string }>;
}

// ---- state -------------------------------------------------------------------

const S = {
  library: [] as LibPlayer[],
  targets: null as LiveTargetsV3 | null,
  wording: { format: "{phrase} by {n}", metrics: {} } as Wording,
  player: null as LibPlayer | null,
  clip: null as string | null,
  labels: null as ClipLabels | null,
  poses: null as PoseFile | null,
  videoUrl: null as string | null,
  attempt: -1,
  frame: 0,
  picked: null as string | null,
  tab: "keyframes",
  measure: null as AttemptMeasurement | null,
  rows: [] as MetricRow[],
  /** Player-wide values per attempt key ("clip#n") → outliers. */
  outliers: {} as Record<string, Set<string>>,
  playing: false,
};

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const el = {
  tree: $("tree"),
  filter: $<HTMLSelectElement>("filter"),
  totals: $("totals"),
  saveState: $("saveState"),
  clipTitle: $("clipTitle"),
  progress: $("progress"),
  video: $<HTMLVideoElement>("video"),
  canvas: $<HTMLCanvasElement>("canvas"),
  empty: $("empty"),
  range: $<HTMLInputElement>("range"),
  frameNo: $("frameNo"),
  marks: $("marks"),
  chips: $("attemptChips"),
  head: $("attemptHead"),
  flags: $("autoFlags"),
  tabBody: $("tabBody"),
  play: $<HTMLButtonElement>("play"),
  upload: $<HTMLButtonElement>("uploadVideo"),
  videoInput: $<HTMLInputElement>("videoInput"),
  extract: $<HTMLButtonElement>("extract"),
  detect: $<HTMLButtonElement>("detectShots"),
  addAttempt: $<HTMLButtonElement>("addAttempt"),
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      msg = ((await r.json()) as { error?: string }).error ?? msg;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }
  return (await r.json()) as T;
}
const postJson = <T>(url: string, body: unknown) =>
  api<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const fileUrl = (player: string, clip: string, file: string) =>
  `/api/pros/files/${encodeURIComponent(player)}/${encodeURIComponent(clip)}/${encodeURIComponent(file)}`;

// ---- library ------------------------------------------------------------------

async function loadLibrary(): Promise<void> {
  S.library = (
    await api<{ players: LibPlayer[] }>("/api/pros/library")
  ).players;
  if (S.player) S.player = S.library.find((p) => p.id === S.player!.id) ?? null;
  renderTree();
}

function attemptVisible(a: LibAttempt): boolean {
  const f = el.filter.value;
  if (f === "all") return true;
  if (f === "angle") return (a.angle ?? 0) > 20;
  return a.status === f;
}

function renderTree(): void {
  const all = S.library.flatMap((p) => p.clips.flatMap((c) => c.attempts));
  const c = statusCounts(all);
  el.totals.textContent = `${S.library.length} players · ${all.length} attempts · ${c.approved} approved · ${c.flagged} flagged · ${c.excluded} excluded · ${c.unreviewed} unreviewed`;
  let html = "";
  for (const p of S.library) {
    html += `<div class="player"><span>${esc(p.name)} <span class="counts">${p.shootingHand} · ${p.counts.approved}/${p.clips.reduce((n, c) => n + c.attempts.length, 0)} approved</span></span><button class="small" data-add-clip="${p.id}" title="Add a clip">+ Clip</button></div>`;
    for (const c of p.clips) {
      const active = S.player?.id === p.id && S.clip === c.id;
      html += `<div class="clip ${active ? "active" : ""}" data-player="${p.id}" data-clip="${c.id}"><span>${esc(c.id)}</span><span>${c.poses ? "" : "no poses · "}${c.video ? "" : "no video · "}${c.attempts.length}</span></div>`;
      for (const a of c.attempts) {
        if (!attemptVisible(a)) continue;
        const on = active && S.attempt === a.shotNumber - 1;
        html += `<div class="attempt ${on ? "active" : ""}" data-player="${p.id}" data-clip="${c.id}" data-attempt="${a.shotNumber - 1}"><span class="dot s-${a.status}"></span>Shot ${a.shotNumber}<span class="dim small">${a.startFrame}–${a.endFrame}${a.angle !== null ? ` · ${a.angle.toFixed(0)}°${a.confirmed ? "✓" : ""}` : ""}</span></div>`;
      }
    }
  }
  el.tree.innerHTML = html || `<p class="dim small">No players yet.</p>`;
}

el.tree.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const add = t.closest<HTMLElement>("[data-add-clip]");
  if (add) {
    void addClip(add.dataset.addClip!);
    return;
  }
  const node = t.closest<HTMLElement>("[data-clip]");
  if (!node) return;
  const attempt = node.dataset.attempt;
  void openClip(
    node.dataset.player!,
    node.dataset.clip!,
    attempt !== undefined ? Number(attempt) : 0,
  );
});
el.filter.addEventListener("change", renderTree);

$("newPlayer").addEventListener("click", async () => {
  const name = prompt("Player name (e.g. Stephen Curry)")?.trim();
  if (!name) return;
  const hand = confirm("Shoots right-handed? (Cancel = left)")
    ? "right"
    : "left";
  await postJson("/api/pros/players", { name, shootingHand: hand });
  await loadLibrary();
});

async function addClip(player: string): Promise<void> {
  const clip = prompt("Clip name (e.g. practice-01)")?.trim();
  if (!clip) return;
  const r = await postJson<{ clip: string }>("/api/pros/clips", {
    player,
    clip,
  });
  await loadLibrary();
  await openClip(player, r.clip, 0);
}

// ---- clip ---------------------------------------------------------------------

async function openClip(
  player: string,
  clip: string,
  attempt: number,
): Promise<void> {
  const p = S.library.find((x) => x.id === player);
  if (!p) return;
  const sameClip = S.player?.id === player && S.clip === clip;
  S.player = p;
  S.clip = clip;
  if (!sameClip) {
    const c = p.clips.find((x) => x.id === clip)!;
    S.labels = upgradeLabels(
      await api<unknown>(fileUrl(player, clip, "labels.json")).catch(
        () => ({}),
      ),
    );
    S.poses = c.poses
      ? await api<PoseFile>(fileUrl(player, clip, "poses.json")).catch(
          () => null,
        )
      : null;
    S.videoUrl = c.video ? fileUrl(player, clip, c.video) : null;
    el.video.src = S.videoUrl ?? "";
    if (!S.videoUrl) el.video.removeAttribute("src");
    void computeOutliers();
  }
  el.clipTitle.textContent = `${p.name} · ${clip}`;
  el.clipTitle.classList.remove("dim");
  el.upload.disabled = false;
  el.extract.disabled = !S.videoUrl;
  el.detect.disabled = !S.poses;
  el.addAttempt.disabled = !S.poses;
  selectAttempt(Math.min(attempt, (S.labels?.shots.length ?? 1) - 1));
  renderTree();
}

/** Player-wide values per attempt, for "far from this player's other shots". */
async function computeOutliers(): Promise<void> {
  const p = S.player;
  if (!p || !S.targets) return;
  const values: Record<string, Record<string, number | null>> = {};
  for (const c of p.clips) {
    if (!c.poses) continue;
    const poses =
      c.id === S.clip
        ? S.poses
        : await api<PoseFile>(fileUrl(p.id, c.id, "poses.json")).catch(
            () => null,
          );
    const labels =
      c.id === S.clip
        ? S.labels
        : upgradeLabels(
            await api<unknown>(fileUrl(p.id, c.id, "labels.json")).catch(
              () => ({}),
            ),
          );
    if (!poses || !labels) continue;
    for (const s of labels.shots) {
      if (s.status === "excluded") continue;
      const m = measureAttempt(poses, s, { shootingHand: p.shootingHand });
      const v: Record<string, number | null> = {};
      for (const id of Object.keys(S.targets.metrics)) {
        const x = m.primary.metrics[id];
        v[id] = x && x.reliable ? x.value : null;
      }
      values[`${c.id}#${s.shotNumber}`] = v;
    }
  }
  S.outliers = playerOutliers(values);
  if (S.measure) renderPanel();
}

function current(): AttemptLabel | null {
  return S.labels?.shots[S.attempt] ?? null;
}

function selectAttempt(i: number): void {
  S.attempt = S.labels && S.labels.shots.length > 0 ? Math.max(0, i) : -1;
  S.picked = null;
  remeasure();
  const a = current();
  setRange();
  seek(
    a
      ? (a.keyframes["legs_start_bending"] ?? a.startFrame)
      : Number(el.range.min),
  );
  renderChips();
  renderTree();
}

/** Frames around an attempt on the timeline (unless "Whole clip"). */
const ZOOM_PAD = 30;
function setRange(): void {
  const a = current();
  const first = S.poses?.frames[0]?.frameIndex ?? 0;
  const last = S.poses?.frames.at(-1)?.frameIndex ?? 0;
  const whole = $<HTMLInputElement>("wholeClip").checked || !a;
  el.range.min = String(
    whole ? first : Math.max(first, a.startFrame - ZOOM_PAD),
  );
  el.range.max = String(whole ? last : Math.min(last, a.endFrame + ZOOM_PAD));
}
$("wholeClip").addEventListener("change", () => {
  setRange();
  seek(S.frame);
});

function remeasure(): void {
  const a = current();
  S.measure =
    a && S.poses && S.player
      ? measureAttempt(S.poses, a, { shootingHand: S.player.shootingHand })
      : null;
  S.rows =
    S.measure && a && S.targets ? metricRows(S.measure, a, S.targets) : [];
  renderPanel();
}

function renderChips(): void {
  const shots = S.labels?.shots ?? [];
  el.chips.innerHTML = shots
    .map(
      (s, i) =>
        `<span class="chip-attempt ${i === S.attempt ? "active" : ""}" data-i="${i}"><span class="dot s-${s.status}"></span>Shot ${s.shotNumber}</span>`,
    )
    .join("");
}
el.chips.addEventListener("click", (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
  if (c) selectAttempt(Number(c.dataset.i));
});

// ---- saving -------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function updateAttempt(
  patch: Partial<AttemptLabel>,
  opts: { remeasure?: boolean } = {},
): void {
  if (!S.labels || S.attempt < 0) return;
  const shots = [...S.labels.shots];
  shots[S.attempt] = { ...shots[S.attempt]!, ...patch };
  setShots(shots);
  if (opts.remeasure !== false) remeasure();
  else renderPanel();
  renderChips();
}
function setShots(shots: AttemptLabel[]): void {
  S.labels = { ...S.labels!, shots };
  scheduleSave();
}
function scheduleSave(): void {
  el.saveState.textContent = "Unsaved…";
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void save(), 400);
}
async function save(): Promise<void> {
  if (!S.player || !S.clip || !S.labels) return;
  try {
    S.labels = upgradeLabels(
      await postJson<unknown>(
        fileUrl(S.player.id, S.clip, "labels.json"),
        S.labels,
      ),
    );
    el.saveState.textContent = `Saved ${new Date().toLocaleTimeString()}`;
    await loadLibrary();
  } catch (e) {
    el.saveState.textContent = `Save failed: ${(e as Error).message}`;
  }
}

// ---- frames / video -----------------------------------------------------------

function poseAt(frame: number) {
  return S.poses?.frames.find((f) => f.frameIndex === frame) ?? null;
}

function seek(frame: number): void {
  const lo = Number(el.range.min);
  const hi = Number(el.range.max);
  S.frame = Math.max(lo, Math.min(hi, Math.round(frame)));
  el.range.value = String(S.frame);
  el.frameNo.textContent = S.poses ? `frame ${S.frame}` : "no poses";
  if (S.videoUrl && S.poses && !S.playing) {
    const fps = S.poses.fps ?? 30;
    // Middle of the frame, so rounding never shows the previous one.
    const t = (S.frame + 0.5) / fps;
    if (Number.isFinite(t)) el.video.currentTime = t;
  }
  draw();
  renderMarks();
  if (S.tab === "keyframes") renderPanel();
}

el.range.addEventListener("input", () => {
  S.picked = null;
  seek(Number(el.range.value));
});
$("prev").addEventListener("click", () => seek(S.frame - 1));
$("next").addEventListener("click", () => seek(S.frame + 1));
el.play.addEventListener("click", () => togglePlay());
el.video.addEventListener("seeked", () => draw());
el.video.addEventListener("loadedmetadata", () => draw());

function togglePlay(): void {
  if (!S.videoUrl || !S.poses) return;
  if (S.playing) {
    el.video.pause();
    S.playing = false;
    el.play.textContent = "▶";
    return;
  }
  S.playing = true;
  el.play.textContent = "⏸";
  void el.video.play();
  const fps = S.poses.fps ?? 30;
  const tick = () => {
    if (!S.playing) return;
    S.frame = Math.floor(el.video.currentTime * fps);
    el.range.value = String(S.frame);
    el.frameNo.textContent = `frame ${S.frame}`;
    draw();
    if (el.video.ended) {
      S.playing = false;
      el.play.textContent = "▶";
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderMarks(): void {
  const a = current();
  const lo = Number(el.range.min);
  const hi = Number(el.range.max);
  const pct = (f: number) => ((f - lo) / Math.max(1, hi - lo)) * 100;
  let html = "";
  if (a) {
    html += `<span class="mark window" style="left:${pct(a.startFrame)}%;width:${pct(a.endFrame) - pct(a.startFrame)}%"></span>`;
    for (const [k, f] of Object.entries(a.keyframes)) {
      html += `<span class="mark label" style="left:${pct(f)}%" title="${esc(k)} (label) ${f}"></span>`;
    }
    if (S.measure) {
      for (const c of keyframeChecks(a, S.measure.app)) {
        if (c.detected !== null)
          html += `<span class="mark detected" style="left:${pct(c.detected)}%" title="${esc(c.name)} (detected) ${c.detected}"></span>`;
      }
    }
  }
  el.marks.innerHTML = html;
}

/** Where the pose frame sits on the stage (video "contain" rect). */
function contentRect(): { x: number; y: number; w: number; h: number } {
  const W = el.canvas.clientWidth;
  const H = el.canvas.clientHeight;
  const vw = el.video.videoWidth || S.poses?.width || 16;
  const vh = el.video.videoHeight || S.poses?.height || 9;
  const s = Math.min(W / vw, H / vh);
  return { x: (W - vw * s) / 2, y: (H - vh * s) / 2, w: vw * s, h: vh * s };
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
  [15, 19],
  [16, 20],
  [7, 0],
  [8, 0],
];

function draw(): void {
  const c = el.canvas;
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(c.clientWidth * dpr);
  c.height = Math.round(c.clientHeight * dpr);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
  el.empty.style.display = S.poses || S.videoUrl ? "none" : "grid";
  const f = poseAt(S.frame);
  if (!f?.landmarks) return;
  const r = contentRect();
  const project = (l: { x: number; y: number }) => ({
    x: r.x + l.x * r.w,
    y: r.y + l.y * r.h,
  });
  const lm = f.landmarks;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgb(64 224 120 / 85%)";
  for (const [a, b] of SKELETON) {
    const p = lm[a];
    const q = lm[b];
    if (!p || !q || p.visibility < 0.3 || q.visibility < 0.3) continue;
    const P = project(p);
    const Q = project(q);
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(Q.x, Q.y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgb(255 255 255 / 85%)";
  for (const l of lm) {
    if (l.visibility < 0.3) continue;
    const P = project(l);
    ctx.beginPath();
    ctx.arc(P.x, P.y, 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  // The picked metric: highlighted body part + target zone at its frame.
  const row = S.rows.find((x) => x.id === S.picked);
  const m = S.measure;
  if (!row || !m || !S.player) return;
  const sides = {
    shootingHand: S.player.shootingHand,
    nearSide: m.primary.nearSide,
  };
  if (S.frame === row.frames.at(-1)) {
    const first = row.frames[0];
    const z = targetZone(
      {
        id: row.id,
        passMin: row.passMin,
        passMax: row.passMax,
        frames: row.frames,
      },
      {
        ...sides,
        project,
        lm,
        firstLm:
          first !== undefined ? (poseAt(first)?.landmarks ?? null) : null,
        facing: m.primary.facing,
      },
    );
    if (z) drawTargetZone(ctx, z);
  }
  drawGeometry(ctx, geometryFor(row.id), lm, {
    ...sides,
    project,
    highlightOnly: geometryFamily(row.id) !== "path",
    pathFrames: (S.poses?.frames ?? [])
      .filter(
        (p) =>
          p.frameIndex >= Math.min(...row.frames, S.frame) &&
          p.frameIndex <= Math.max(...row.frames, S.frame),
      )
      .map((p) => p.landmarks),
    color: scoreColor(row.score),
  });
}
window.addEventListener("resize", draw);

// ---- panel --------------------------------------------------------------------

const PHASES: [string, string][] = [
  ["load", "Load"],
  ["rise", "Rise"],
  ["setPoint", "Set point"],
  ["release", "Release"],
];

function band(score: number | null): string {
  if (score === null) return "none";
  const n = Math.min(10, Math.ceil(score - 1e-9));
  return n === 0 ? "good" : n <= 3 ? "fair" : n <= 6 ? "off" : "far";
}
function scoreText(score: number | null): string {
  if (score === null) return "–";
  const n = Math.ceil(score - 1e-9);
  return n >= 10 ? "10+" : String(n);
}
function scoreColor(score: number | null): string {
  const b = band(score);
  return b === "good" || b === "none"
    ? "#34d399"
    : b === "fair"
      ? "#fbbf24"
      : "#f87171";
}
function phrase(r: MetricRow): string {
  if (r.value === null) return `${r.label}: not measured`;
  if (!r.direction || r.score === null) return `${r.label}: on target`;
  const p = S.wording.metrics[r.id]?.[r.direction];
  return p
    ? S.wording.format
        .replaceAll("{phrase}", p)
        .replaceAll("{n}", scoreText(r.score))
    : `${r.label}: ${r.direction} by ${scoreText(r.score)}`;
}
function fmt(v: number | null, unit: string): string {
  if (v === null) return "–";
  if (unit === "deg") return `${v.toFixed(1)}°`;
  if (unit === "s") return `${v.toFixed(2)} s`;
  if (unit === "phase") return `${(v * 100).toFixed(0)}% of phase`;
  return `${(v * 100).toFixed(0)}% ${unit}`;
}

document.querySelector(".tabs")!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tab]");
  if (!b) return;
  S.tab = b.dataset.tab!;
  document
    .querySelectorAll(".tabs button")
    .forEach((x) => x.classList.toggle("active", x === b));
  renderPanel();
});

function renderPanel(): void {
  const a = current();
  const m = S.measure;
  if (!a || !m) {
    el.head.innerHTML = S.labels
      ? `No attempts in this clip yet: <b>Detect shots</b> or <b>+ Attempt</b>.`
      : "No attempt selected.";
    el.flags.innerHTML = "";
    el.tabBody.innerHTML = "";
    return;
  }
  const key = `${S.clip}#${a.shotNumber}`;
  const outliers = S.outliers[key] ?? new Set<string>();
  el.head.innerHTML = `<div class="row"><span class="dot s-${a.status}"></span><b>Shot ${a.shotNumber}</b><span class="dim">frames ${a.startFrame}–${a.endFrame} · ${a.status}${a.excludeReason ? ` (${esc(a.excludeReason)})` : ""} · camera ${m.angle.toFixed(0)}°${a.camera?.confirmed ? " ✓" : " (unconfirmed)"}${m.usedLabels ? "" : " · no labels yet: using detection"}</span></div>`;
  const checks = keyframeChecks(a, m.app);
  el.flags.innerHTML = autoFlags(m, S.rows, checks, outliers)
    .map((f) => `<div class="flag">⚑ ${esc(f.text)}</div>`)
    .join("");
  if (S.tab === "keyframes") renderKeyframes(a, checks);
  else if (S.tab === "camera") renderCamera(a, m);
  else if (S.tab === "metrics") renderMetrics(outliers);
  else renderDecision(a);
}

function renderKeyframes(
  a: AttemptLabel,
  checks: ReturnType<typeof keyframeChecks>,
): void {
  let html = `<table><tr><th>Window</th><th></th><th></th></tr>
    <tr><td>Start</td><td><span class="link" data-seek="${a.startFrame}">${a.startFrame}</span></td><td><button data-win="startFrame">Set to ${S.frame}</button></td></tr>
    <tr><td>End</td><td><span class="link" data-seek="${a.endFrame}">${a.endFrame}</span></td><td><button data-win="endFrame">Set to ${S.frame}</button></td></tr></table>
    <table style="margin-top:8px"><tr><th>Key frame</th><th>Label</th><th></th><th>App</th><th></th></tr>`;
  for (const c of checks) {
    const badge =
      c.status === "ok"
        ? `<span class="badge b-ok">${c.diff! >= 0 ? "+" : ""}${c.diff}</span>`
        : c.status === "off"
          ? `<span class="badge b-off">${c.diff! >= 0 ? "+" : ""}${c.diff}</span>`
          : c.status === "missing"
            ? `<span class="badge b-warn">not detected</span>`
            : "";
    html += `<tr><td>${esc(c.name)}</td>
      <td>${c.label !== null ? `<span class="link" data-seek="${c.label}">${c.label}</span> <span class="link small" data-clear="${c.key}" title="Clear">✕</span>` : `<span class="dim">–</span>`}</td>
      <td><button data-set="${c.key}" title="Label this key frame at the current frame">Set ${S.frame}</button></td>
      <td>${c.detected !== null ? `<span class="link" data-seek="${c.detected}">${c.detected}</span>` : `<span class="dim">–</span>`}</td>
      <td>${badge}</td></tr>`;
  }
  html += `</table><p class="small dim">Labels (blue marks) are what the targets are measured from; the app's detection (amber) is compared against them. Release and the foot events have no detected counterpart.</p>
    <button data-delete-attempt class="small">Delete this attempt</button>`;
  el.tabBody.innerHTML = html;
}

function renderCamera(a: AttemptLabel, m: AttemptMeasurement): void {
  const auto = m.autoCamera;
  const cam = a.camera;
  const angle = cam?.angle ?? auto?.angle ?? 0;
  el.tabBody.innerHTML = `
    <p>Estimated from apparent shoulder / hip width vs torso length over the dip → set point (population proportions).</p>
    <table>
      <tr><td>Estimate</td><td><b>${auto ? `${auto.angle.toFixed(1)}°` : "–"}</b> off side-on</td></tr>
      <tr><td>Shoulders / hips</td><td>${auto ? `${auto.shoulders.toFixed(1)}° / ${auto.hips.toFixed(1)}°` : "–"} ${auto?.standingOpen ? `<span class="badge b-warn">standing open?</span>` : ""}</td></tr>
      <tr><td>Frames used</td><td>${auto ? `${auto.frames[0]}–${auto.frames.at(-1)} (${auto.frames.length})` : "–"}</td></tr>
    </table>
    <p style="margin-top:12px"><b>Angle used:</b> <input id="camAngle" type="number" min="0" max="60" step="1" value="${angle.toFixed(0)}" style="width:70px">°
      <input id="camSlider" type="range" min="0" max="60" step="1" value="${angle.toFixed(0)}" style="width:180px"></p>
    <div class="row">
      <button id="camAuto" ${auto ? "" : "disabled"}>Use estimate</button>
      <label><input id="camOpen" type="checkbox" ${cam?.standingOpen ? "checked" : ""}> Standing open</label>
      <button id="camConfirm" class="primary">${cam?.confirmed ? "Confirmed ✓" : "Confirm angle"}</button>
    </div>
    <p class="small dim">Metrics are corrected for this angle (horizontal distances ÷ cos). Arm / head metrics are only used up to 15°, in-plane metrics up to 25°, the guide hand never from side clips.</p>`;
  const setAngle = (
    v: number,
    source: "auto" | "manual" | "scenery",
    confirmed: boolean,
  ) => {
    updateAttempt({
      camera: {
        autoAngle: auto?.angle ?? null,
        ...(auto
          ? {
              autoDetail: {
                shoulders: auto.shoulders,
                hips: auto.hips,
                frames: [auto.frames[0]!, auto.frames.at(-1)!],
              },
            }
          : {}),
        angle: Math.max(0, Math.min(60, v)),
        source,
        confirmed,
        standingOpen: $<HTMLInputElement>("camOpen")?.checked ?? false,
      },
    });
  };
  const num = $<HTMLInputElement>("camAngle");
  const slider = $<HTMLInputElement>("camSlider");
  slider.addEventListener("input", () => (num.value = slider.value));
  slider.addEventListener("change", () =>
    setAngle(Number(slider.value), "manual", false),
  );
  num.addEventListener("change", () =>
    setAngle(Number(num.value), "manual", false),
  );
  $("camAuto").addEventListener(
    "click",
    () => auto && setAngle(auto.angle, "auto", false),
  );
  $("camOpen").addEventListener("change", () =>
    setAngle(Number(num.value), cam?.source ?? "auto", cam?.confirmed ?? false),
  );
  $("camConfirm").addEventListener("click", () =>
    setAngle(
      Number(num.value),
      auto && Math.abs(Number(num.value) - auto.angle) < 0.5
        ? "auto"
        : "manual",
      true,
    ),
  );
}

function renderMetrics(outliers: Set<string>): void {
  let html = "";
  for (const [phase, name] of PHASES) {
    const rows = S.rows.filter((r) => r.phase === phase && r.scored);
    if (rows.length === 0) continue;
    html += `<div class="phase-h"><span>${name}</span></div>`;
    for (const r of rows) html += metricHtml(r, outliers);
  }
  const details = S.rows.filter((r) => !r.scored);
  if (details.length) {
    html += `<div class="phase-h"><span>Details (not scored)</span></div>`;
    for (const r of details) html += metricHtml(r, outliers);
  }
  el.tabBody.innerHTML = html;
}

function metricHtml(r: MetricRow, outliers: Set<string>): string {
  const excluded = r.flag !== null || r.overAngleLimit;
  const badges = [
    r.overAngleLimit
      ? `<span class="badge b-warn">over ${r.angleLimit}° limit</span>`
      : "",
    outliers.has(r.id)
      ? `<span class="badge b-off">far from other shots</span>`
      : "",
    r.flag !== null
      ? `<span class="badge b-off">flagged: ${esc(r.flag || "—")}</span>`
      : "",
  ].join(" ");
  return `<div class="metric ${S.picked === r.id ? "picked" : ""} ${excluded ? "excluded" : ""}" data-metric="${r.id}">
    <div class="top"><span class="score" data-band="${r.scored ? band(r.score) : "none"}">${r.scored ? scoreText(r.score) : "·"}</span>
      <span class="text">${esc(phrase(r))}</span>
      <button class="small" data-flag="${r.id}">${r.flag !== null ? "Unflag" : "Flag"}</button></div>
    <div class="detail">${fmt(r.value, r.unit)} (target ${fmt(r.passMin, r.unit)} to ${fmt(r.passMax, r.unit)}) · uncorrected ${fmt(r.uncorrected, r.unit)} · from detection ${fmt(r.fromDetection, r.unit)}${r.note ? ` · ${esc(r.note)}` : ""}</div>
    ${badges.trim() ? `<div class="detail">${badges}</div>` : ""}</div>`;
}

function renderDecision(a: AttemptLabel): void {
  el.tabBody.innerHTML = `
    <div class="row decision">
      <button data-status="approved" class="${a.status === "approved" ? "primary" : ""}">Approve (A)</button>
      <button data-status="flagged" class="${a.status === "flagged" ? "primary" : ""}">Flag (F)</button>
      <button data-status="excluded" class="${a.status === "excluded" ? "primary" : ""}">Exclude (X)</button>
      <button data-status="unreviewed">Reset</button>
    </div>
    <p class="small dim">Approved attempts are used for targets; flagged ones only on request; excluded never. Flagged metrics and metrics over their angle limit are left out either way.</p>
    <label class="small dim">Notes</label>
    <textarea id="notes">${esc(a.notes)}</textarea>`;
  $<HTMLTextAreaElement>("notes").addEventListener("change", (e) =>
    updateAttempt(
      { notes: (e.target as HTMLTextAreaElement).value },
      { remeasure: false },
    ),
  );
}

function setStatus(status: AttemptStatus): void {
  const a = current();
  if (!a) return;
  let reason: string | null = null;
  if (status === "excluded") {
    reason = prompt("Why exclude this attempt?", a.excludeReason ?? "") ?? null;
    if (reason === null) return;
  }
  updateAttempt(
    { status, excludeReason: status === "excluded" ? reason : null },
    { remeasure: false },
  );
}

el.tabBody.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const a = current();
  if (!a) return;
  const seekTo = t.closest<HTMLElement>("[data-seek]");
  if (seekTo) return seek(Number(seekTo.dataset.seek));
  const set = t.closest<HTMLElement>("[data-set]");
  if (set)
    return updateAttempt({
      keyframes: { ...a.keyframes, [set.dataset.set!]: S.frame },
    });
  const clear = t.closest<HTMLElement>("[data-clear]");
  if (clear) {
    const k = { ...a.keyframes };
    delete k[clear.dataset.clear!];
    return updateAttempt({ keyframes: k });
  }
  const win = t.closest<HTMLElement>("[data-win]");
  if (win) {
    updateAttempt({ [win.dataset.win!]: S.frame } as Partial<AttemptLabel>);
    setRange();
    return seek(S.frame);
  }
  if (t.closest("[data-delete-attempt]")) {
    if (!confirm(`Delete shot ${a.shotNumber}?`)) return;
    const shots = S.labels!.shots.filter((_, i) => i !== S.attempt);
    setShots(shots);
    S.labels = upgradeLabels(S.labels);
    return selectAttempt(S.attempt - 1);
  }
  const status = t.closest<HTMLElement>("[data-status]");
  if (status) return setStatus(status.dataset.status as AttemptStatus);
  const flag = t.closest<HTMLElement>("[data-flag]");
  if (flag) {
    const id = flag.dataset.flag!;
    const flags = { ...a.metricFlags };
    if (id in flags) delete flags[id];
    else {
      const note = prompt("Why leave this metric out for this attempt?", "");
      if (note === null) return;
      flags[id] = note;
    }
    return updateAttempt({ metricFlags: flags }, { remeasure: true });
  }
  const metric = t.closest<HTMLElement>("[data-metric]");
  if (metric) {
    const row = S.rows.find((r) => r.id === metric.dataset.metric);
    if (!row) return;
    S.picked = row.id;
    const f = row.frames.at(-1);
    if (f !== undefined) seek(f);
    renderPanel();
  }
});

// ---- clip actions ---------------------------------------------------------------

el.upload.addEventListener("click", () => el.videoInput.click());
el.videoInput.addEventListener("change", async () => {
  const file = el.videoInput.files?.[0];
  if (!file || !S.player || !S.clip) return;
  const ext = (
    file.name.match(/\.(mp4|mov|webm)$/i)?.[0] ?? ".mp4"
  ).toLowerCase();
  el.progress.textContent = "Uploading video…";
  await fetch(fileUrl(S.player.id, S.clip, `video${ext}`), {
    method: "POST",
    body: file,
  });
  el.progress.textContent = "";
  await loadLibrary();
  const clip = S.clip;
  S.clip = null; // force reload
  await openClip(S.player.id, clip, 0);
});

el.extract.addEventListener("click", async () => {
  if (!S.videoUrl || !S.player || !S.clip) return;
  if (S.poses && !confirm("Replace this clip's pose data?")) return;
  el.extract.disabled = true;
  try {
    el.progress.textContent = "Loading MediaPipe…";
    const blob = await (await fetch(S.videoUrl)).blob();
    const file = new File([blob], S.videoUrl.split("/").pop() ?? "video.mp4", {
      type: blob.type,
    });
    const detector = await createPoseDetector({
      runtime: "browser",
      runningMode: "IMAGE",
      delegate: "GPU",
    });
    const provider = await createVideoElementProvider(file, { fps: 30 });
    const total = provider.getTotalFrames();
    const frames: PoseFile["frames"][number][] = [];
    let frame = await provider.getNextFrame();
    while (frame !== null) {
      const r = await detector.detect(frame).catch(() => null);
      frames.push({
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        landmarks: r
          ? [...r.landmarks].map((l) => ({
              x: l.x,
              y: l.y,
              visibility: l.visibility ?? 0,
              ...("z" in l ? { z: (l as { z: number }).z } : {}),
            }))
          : null,
      });
      if (frames.length % 10 === 0)
        el.progress.textContent = `Poses ${frames.length} / ${total}`;
      frame = await provider.getNextFrame();
    }
    const meta = provider.getMetadata();
    const poses = {
      video: file.name,
      fps: provider.getFps(),
      totalFrames: total,
      width: meta.width,
      height: meta.height,
      extractedAt: new Date().toISOString(),
      frames,
    };
    el.progress.textContent = "Saving poses…";
    await postJson(fileUrl(S.player.id, S.clip, "poses.json"), poses);
    el.progress.textContent = "";
    await loadLibrary();
    const clip = S.clip;
    S.clip = null;
    await openClip(S.player.id, clip, 0);
  } catch (e) {
    el.progress.textContent = `Pose extraction failed: ${(e as Error).message}`;
  } finally {
    el.extract.disabled = !S.videoUrl;
  }
});

el.detect.addEventListener("click", () => {
  if (!S.poses || !S.labels) return;
  const found = detectShots(S.poses as never).shots;
  const existing = S.labels.shots;
  const overlaps = (s: { startFrame: number; endFrame: number }) =>
    existing.some(
      (e) => s.startFrame <= e.endFrame && s.endFrame >= e.startFrame,
    );
  const added = found
    .filter((s) => !overlaps(s))
    .map((s) => newAttempt(s.startFrame, s.endFrame));
  if (added.length === 0) {
    alert(
      found.length
        ? "Every detected shot already has an attempt."
        : "No shots detected.",
    );
    return;
  }
  setShots(
    upgradeLabels({ ...S.labels, shots: [...existing, ...added] })
      .shots as AttemptLabel[],
  );
  selectAttempt(0);
});

el.addAttempt.addEventListener("click", () => {
  if (!S.labels) return;
  const a = newAttempt(Math.max(0, S.frame - 15), S.frame + 25);
  const shots = upgradeLabels({
    ...S.labels,
    shots: [...S.labels.shots, a],
  }).shots;
  setShots(shots as AttemptLabel[]);
  selectAttempt(shots.findIndex((s) => s.startFrame === a.startFrame));
});

// ---- keyboard ---------------------------------------------------------------------

document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const step = e.shiftKey ? 5 : 1;
  switch (e.key) {
    case "ArrowLeft":
      seek(S.frame - step);
      break;
    case "ArrowRight":
      seek(S.frame + step);
      break;
    case " ":
      togglePlay();
      break;
    case "j":
    case "J":
      selectAttempt(S.attempt - 1);
      break;
    case "k":
    case "K":
      if (S.labels && S.attempt < S.labels.shots.length - 1)
        selectAttempt(S.attempt + 1);
      break;
    case "a":
    case "A":
      setStatus("approved");
      break;
    case "f":
    case "F":
      setStatus("flagged");
      break;
    case "x":
    case "X":
      setStatus("excluded");
      break;
    default:
      return;
  }
  e.preventDefault();
});

// ---- boot ------------------------------------------------------------------------

async function boot(): Promise<void> {
  const [targets, wording] = await Promise.all([
    api<LiveTargetsV3>("/app-static/reference/live-targets-v3.json"),
    api<Wording>("/app-static/config/feedback-wording.json").catch(() => null),
  ]);
  S.targets = targets;
  if (wording?.metrics)
    S.wording = {
      format: wording.format ?? S.wording.format,
      metrics: wording.metrics,
    };
  await loadLibrary();
  draw();
}
void boot();

// Test hook: the current state, for the smoke test.
(window as unknown as { __proReview: typeof S }).__proReview = S;
// Keep KEYFRAMES referenced for the bundle (key frame order is shared).
void KEYFRAMES;
