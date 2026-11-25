<script lang="ts">
  /**
   * Shot review: scrub a past shot and watch the pose play back, zoomed to fill
   * the frame so form detail is legible. The v3 scorecard (Load → Rise → Set
   * point → Release, 0–10+) highlights the phase the scrubber is in; the
   * current phase's worst issues are drawn on the pose as what they measure
   * (angle arc, offset, height bar…). Clicking a metric seeks to the frame it
   * was measured at.
   *
   * Pose comes from the server-stored skeleton track (works for every shot,
   * every device). A retained on-device clip renders behind this same overlay
   * once per-shot video capture lands.
   */
  import { deviceDebugEnabled } from "$lib/shared/debug/debug-mode";
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { getShotClipStore } from "$lib/shared/media/shot-clip-store";
  import type { ShotRecord, ShotReviewPoses } from "$lib/shared/db/repos";
  import type { StoredShotAnalysis } from "$lib/features/analysis";
  import {
    metricMatchesAreas,
    normalizeAreas,
  } from "$lib/features/scoring/focus";
  import {
    ScoreCardV3,
    feedbackText,
    loadFeedbackWording,
    EMPTY_FEEDBACK_WORDING,
    type FeedbackWording,
    type MetricResultV3,
    type ScorecardV3,
  } from "$lib/features/scoring/v3";
  import { loadScoringTargets } from "$lib/features/pros";
  import {
    drawGeometry,
    geometryFamily,
    geometryFor,
  } from "$lib/features/reference/metric-geometry";
  import { scoreStoredShot } from "./scored-shots";
  import { phaseAtFrame, phaseMarks } from "./phase-timeline";
  import {
    extractClipFramesFromUrl,
    nearestFrame,
    type ClipFrames,
  } from "./clip-frames";
  import { REANALYSIS_UNAVAILABLE } from "./shot-list";
  import { phaseName } from "../loop/readback";
  import { Button } from "$lib/shared/ui";
  import { drawSkeleton } from "$lib/shared/ui/pose-skeleton";
  import {
    drawTargetZone,
    targetZone,
  } from "$lib/features/reference/target-zone";
  type Hand = "left" | "right";
  import {
    MIN_VIS,
    computeShotFraming,
    projectWith,
    sourceRect,
    type Framing,
  } from "./framing";

  let { shotId }: { shotId: string } = $props();

  const services = useAppServices();
  const clipStore = getShotClipStore();

  let shot = $state<ShotRecord | null>(null);
  let poses = $state<ShotReviewPoses | null>(null);
  let card = $state<ScorecardV3 | null>(null);
  let wording = $state.raw<FeedbackWording>(EMPTY_FEEDBACK_WORDING);
  /** Pre-v3 shot without a pose track: can't be scored on the new metrics. */
  let unavailable = $state(false);
  let current = $state(0);
  let notFound = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let hand = $state<Hand>("right");

  // Coaching focus (from settings): emphasize these areas in the overlay.
  let focusAreas = $state<string[]>([]);

  // Recorded clip of the actual shot (on-device only; absent on other devices).
  let clipUrl = $state<string | null>(null);
  /** The clip's first frame on the pose-frame clock (null: older clip). */
  let clipStartFrameTs = $state<number | null>(null);
  /**
   * The clip decoded once into a frame per pose frame (see clip-frames):
   * scrubbing / playing draw these instead of seeking the <video>, which is
   * slow when a recording has few keyframes (Android Firefox).
   */
  let clipFrames = $state.raw<ClipFrames | null>(null);
  /** Pose frameIndex for each entry of clipFrames. */
  let clipFrameIdx: number[] = [];
  let framesProgress = $state<string | null>(null);
  let clipCanvas = $state<HTMLCanvasElement | null>(null);
  let frameToken = 0;
  /** Video is playing and driving the scrubber. */
  let playing = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let videoReady = $state(false);
  let videoSize = $state<{ width: number; height: number } | null>(null);

  // Stage size (CSS px), measured from the layout.
  let stageW = $state(0);
  let stageH = $state(0);

  /**
   * One fixed transform for the whole shot (see ./framing): true proportions,
   * zoomed so the highest and lowest points of the movement are just inside.
   * The source size comes from the clip when there is one, else from the
   * stored pose track, else it's estimated (older shots).
   */
  const framing = $derived.by((): Framing | null => {
    if (!poses || poses.frames.length === 0 || stageW <= 0 || stageH <= 0) {
      return null;
    }
    const source =
      clipUrl && videoReady && videoSize
        ? videoSize
        : poses.width && poses.height
          ? { width: poses.width, height: poses.height }
          : null;
    return computeShotFraming(
      poses.frames,
      { width: stageW, height: stageH },
      source,
    );
  });
  const videoBox = $derived(framing ? sourceRect(framing) : null);

  const analysis = $derived(
    shot ? (shot.analysis as StoredShotAnalysis) : null,
  );
  const v3 = $derived(analysis?.v3Metrics ?? null);
  /** The scrub range: the whole stored track (it's padded around the shot). */
  const start = $derived(
    poses && poses.frames.length > 0
      ? poses.frames[0]!.frameIndex
      : (analysis?.frameRange.start ?? 0),
  );
  const end = $derived(
    poses && poses.frames.length > 0
      ? poses.frames.at(-1)!.frameIndex
      : (analysis?.frameRange.end ?? 0),
  );

  /**
   * A picked timing metric on the scrubber: its two events, and the window
   * the second should fall in (first event + band × phase duration).
   */
  const timingBand = $derived.by(() => {
    const m = picked;
    if (!m || !v3 || geometryFamily(m.id) !== "timing" || m.frames.length < 2)
      return null;
    const win = v3.phases[m.phase as keyof typeof v3.phases];
    if (!win) return null;
    const d = win.end - win.start;
    const a = m.frames[0]!;
    const lo = Math.max(start, Math.min(end, a + m.passMin * d));
    const hi = Math.max(start, Math.min(end, a + m.passMax * d));
    return { a, b: m.frames[1]!, lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  });

  /** Phase markers (where each v3 phase begins) + the current phase. */
  const phaseStarts = $derived(
    v3
      ? phaseMarks(v3)
          .filter((m) => m.frame >= start && m.frame <= end)
          .map((m) => ({ phase: m.phase, startFrame: m.frame }))
      : [],
  );
  const currentPhase = $derived(v3 ? phaseAtFrame(v3, current) : null);

  const frame = $derived(
    poses?.frames.find((f) => f.frameIndex === current) ?? null,
  );

  /**
   * Off-target scored metrics in the current phase, worst first. When a focus
   * is set, the overlay emphasizes only those areas (the full scorecard below
   * still shows everything).
   */
  const phaseIssues = $derived<MetricResultV3[]>(
    card && currentPhase
      ? card.worst.filter(
          (m) =>
            m.phase === currentPhase &&
            (focusAreas.length === 0 || metricMatchesAreas(m, focusAreas)),
        )
      : [],
  );

  $effect(() => {
    void load(shotId);
  });

  async function load(id: string) {
    const [s, p, targets, player, w] = await Promise.all([
      services.repos.shot.get(id),
      services.repos.shot.getPoses(id),
      loadScoringTargets(services.repos.settings).then((x) => x.targets),
      services.repos.player.getFirst(),
      loadFeedbackWording(),
    ]);
    wording = w.wording;
    if (!s) {
      notFound = true;
      return;
    }
    if (player) hand = player.shootingHand;
    // Pre-v3 shots are re-analyzed from this pose track (and saved) here.
    const scored = await scoreStoredShot(
      services.repos.shot,
      s,
      hand,
      targets,
      p,
    );
    shot = scored.record;
    poses = p;
    card = scored.card;
    unavailable = scored.card === null;
    const v = (scored.record.analysis as StoredShotAnalysis).v3Metrics;
    const load = v?.phases.load?.start;
    current =
      load !== undefined &&
      p?.frames.some((f) => f.frameIndex === Math.round(load))
        ? Math.round(load)
        : (p?.frames[0]?.frameIndex ?? s.analysis.frameRange.start);
    focusAreas = normalizeAreas(
      await services.repos.settings.get("liveFocusAreas"),
    );
    void loadClip(id);
  }

  async function loadClip(id: string) {
    revokeClip();
    videoReady = false;
    const clip = await clipStore.get(id).catch(() => null);
    clipInfo = null;
    clipChecked = false;
    clipFrames = null;
    framesProgress = null;
    frameToken++;
    mediaEvents = [];
    if (clip) {
      clipStartFrameTs = clip.startFrameTs;
      clipMeta = { mime: clip.mime || clip.blob.type, bytes: clip.blob.size };
      clipUrl = URL.createObjectURL(clip.blob);
    }
    clipChecked = true;
  }

  /**
   * Recorded WebM (MediaRecorder) carries no duration or seek index, so
   * browsers report `duration = Infinity` and some (Firefox) won't seek or
   * play from an arbitrary point until the file has been scanned. Seeking far
   * past the end forces that scan; then back to the start before enabling
   * scrubbing.
   */
  async function prepareVideo(v: HTMLVideoElement): Promise<void> {
    if (!isFinite(v.duration) || v.duration === 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, 4000);
        function done() {
          clearTimeout(timer);
          v.removeEventListener("durationchange", onChange);
          v.removeEventListener("seeked", onChange);
          resolve();
        }
        function onChange() {
          if (isFinite(v.duration) && v.duration > 0) done();
        }
        v.addEventListener("durationchange", onChange);
        v.addEventListener("seeked", onChange);
        try {
          v.currentTime = 1e7;
        } catch {
          done();
        }
      });
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    readClipInfo(v);
    videoReady = true;
    void buildClipFrames();
  }

  /** Decode the clip into one frame per pose frame (once per shot). */
  async function buildClipFrames(): Promise<void> {
    const p = poses;
    if (!p || p.frames.length === 0) return;
    const idx = p.frames.map((f) => f.frameIndex);
    const times = idx.map((i) => videoTimeFor(i));
    if (times.some((t) => t === null)) return; // no timing: keep seeking
    // Once per clip (the player's load events can fire again).
    if (!clipUrl || clipFrames || framesProgress) return;
    const url = clipUrl;
    const token = ++frameToken;
    framesProgress = `Preparing video… 0/${idx.length}`;
    const frames = await extractClipFramesFromUrl(url, times as number[], {
      cancelled: () => token !== frameToken,
      onProgress: (d, n) => {
        if (token === frameToken) framesProgress = `Preparing video… ${d}/${n}`;
      },
    });
    if (token !== frameToken) return;
    framesProgress = null;
    if (frames.some((f) => f !== null)) {
      clipFrameIdx = idx;
      clipFrames = frames;
    }
  }

  /** Clip size/format and what the browser can seek in it (diagnostics). */
  let clipMeta = $state<{ mime: string; bytes: number } | null>(null);
  let clipInfo = $state<{
    duration: number;
    seekableEnd: number;
    expectedEnd: number | null;
  } | null>(null);
  function readClipInfo(v: HTMLVideoElement) {
    const sk = v.seekable;
    const lastT = poses?.frames.at(-1)?.t;
    clipInfo = {
      duration: v.duration,
      seekableEnd: sk && sk.length > 0 ? sk.end(sk.length - 1) : 0,
      expectedEnd:
        clipStartFrameTs !== null && typeof lastT === "number"
          ? (lastT - clipStartFrameTs) / 1000
          : null,
    };
  }
  /** The clip can't reach the shot's frames (shown so it can be reported). */
  const clipProblem = $derived(
    !!clipInfo &&
      (!isFinite(clipInfo.duration) ||
        clipInfo.seekableEnd <= 0 ||
        (clipInfo.expectedEnd !== null &&
          clipInfo.duration + 0.5 < clipInfo.expectedEnd)),
  );
  // Debug mode (`?debug=on`, remembered across pages): the video panel.
  const debugVideo = $derived(deviceDebugEnabled(page.url));
  const showClipInfo = $derived(clipProblem || debugVideo);

  // ---- ?debug=video: everything needed to diagnose playback on a device ----
  /** Whether the clip store was checked, and found nothing. */
  let clipChecked = $state(false);
  let mediaEvents = $state<string[]>([]);
  let mediaState = $state("");
  const MEDIA_EVENTS = [
    "loadstart",
    "loadedmetadata",
    "loadeddata",
    "durationchange",
    "canplay",
    "canplaythrough",
    "seeking",
    "seeked",
    "play",
    "playing",
    "pause",
    "waiting",
    "stalled",
    "suspend",
    "ended",
    "error",
    "emptied",
  ] as const;
  function readMediaState(v: HTMLVideoElement): string {
    const range = (r: TimeRanges) =>
      Array.from(
        { length: r.length },
        (_, i) => `${r.start(i).toFixed(2)}–${r.end(i).toFixed(2)}`,
      ).join(",") || "none";
    const q = v.getVideoPlaybackQuality?.();
    return [
      `readyState ${v.readyState}, networkState ${v.networkState}`,
      `error ${v.error ? `${v.error.code} ${v.error.message || ""}` : "none"}`,
      `size ${v.videoWidth}×${v.videoHeight}`,
      `time ${v.currentTime.toFixed(2)} / ${isFinite(v.duration) ? v.duration.toFixed(2) : String(v.duration)}`,
      `seekable ${range(v.seekable)}, buffered ${range(v.buffered)}`,
      `frames decoded ${q ? `${q.totalVideoFrames} (dropped ${q.droppedVideoFrames})` : "n/a"}`,
    ].join(" · ");
  }
  $effect(() => {
    const v = videoEl;
    if (!v || !debugVideo) return;
    const on = (e: Event) => {
      // The first events (how the clip loaded) and the latest (what it's
      // doing now); decoding fires many in between.
      const all = [
        ...mediaEvents.filter((x) => x !== "…"),
        `${(performance.now() / 1000).toFixed(2)}s ${e.type}`,
      ];
      mediaEvents =
        all.length > 32 ? [...all.slice(0, 8), "…", ...all.slice(-23)] : all;
      mediaState = readMediaState(v);
    };
    for (const t of MEDIA_EVENTS) v.addEventListener(t, on);
    mediaState = readMediaState(v);
    const tick = setInterval(() => (mediaState = readMediaState(v)), 1000);
    return () => {
      for (const t of MEDIA_EVENTS) v.removeEventListener(t, on);
      clearInterval(tick);
    };
  });
  function debugText(): string {
    return [
      `ShotCoach video debug — shot ${shotId}`,
      `browser: ${navigator.userAgent}`,
      clipUrl
        ? `clip: ${clipMeta?.mime || "?"}, ${clipMeta ? (clipMeta.bytes / 1e6).toFixed(2) : "?"} MB, startFrameTs ${clipStartFrameTs ?? "none"}`
        : clipChecked
          ? "clip: none stored for this shot on this device"
          : "clip: not checked yet",
      clipInfo
        ? `prepared: duration ${fmtSec(clipInfo.duration)}, seekable to ${fmtSec(clipInfo.seekableEnd)}, shot ends at ${clipInfo.expectedEnd !== null ? fmtSec(clipInfo.expectedEnd) : "?"}`
        : "prepared: no (metadata never loaded)",
      `ready for scrubbing: ${videoReady}`,
      `frames decoded for review: ${clipFrames ? `${clipFrames.filter((f) => f).length}/${clipFrames.length}` : (framesProgress ?? "no")}`,
      `media: ${mediaState || "–"}`,
      `events: ${mediaEvents.join(", ") || "none"}`,
      `pose frames: ${poses?.frames.length ?? 0}, timed: ${poses?.frames.some((f) => typeof f.t === "number") ?? false}`,
    ].join("\n");
  }
  let copied = $state(false);
  async function copyDebug() {
    try {
      await navigator.clipboard.writeText(debugText());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* clipboard blocked: the text is shown below */
    }
  }
  function fmtSec(n: number): string {
    return isFinite(n) ? `${n.toFixed(1)} s` : "unknown";
  }

  function revokeClip() {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = null;
  }

  onDestroy(() => {
    frameToken++;
    revokeClip();
  });

  function markerLeft(startFrame: number): number {
    const span = Math.max(end - start, 1);
    return ((startFrame - start) / span) * 100;
  }
  /** The metric last clicked in the scorecard (drawn on the stage). */
  let picked = $state<MetricResultV3 | null>(null);

  /** Seek to where a metric was measured (else to its phase's start). */
  function seekToMetric(m: MetricResultV3) {
    picked = m;
    // The measured frame (a change's end; a timing metric's second event —
    // when it actually happened).
    const f = m.frames.at(-1);
    if (f !== undefined && f >= start && f <= end) {
      current = f;
      return;
    }
    const kf = phaseStarts.find((p) => p.phase === m.phase);
    if (kf) current = kf.startFrame;
  }

  /**
   * Video time (s) for a pose frame. Exact when the clip's start and the
   * frame's capture time are both known (same clock); older clips fall back
   * to spreading the shot across the clip.
   */
  function videoTimeFor(frameIndex: number): number | null {
    const f = poses?.frames.find((p) => p.frameIndex === frameIndex);
    if (clipStartFrameTs !== null && typeof f?.t === "number") {
      return Math.max(0, (f.t - clipStartFrameTs) / 1000);
    }
    const v = videoEl;
    if (!v || !v.duration || !isFinite(v.duration)) return null;
    const span = Math.max(end - start, 1);
    return Math.min(1, Math.max(0, (frameIndex - start) / span)) * v.duration;
  }

  /** The pose frame shown at a video time (inverse of videoTimeFor). */
  function frameAtTime(seconds: number): number {
    if (!poses) return start;
    let best = start;
    let bestErr = Infinity;
    for (const f of poses.frames) {
      const vt = videoTimeFor(f.frameIndex);
      if (vt === null) continue;
      const err = Math.abs(vt - seconds);
      if (err < bestErr) {
        bestErr = err;
        best = f.frameIndex;
      }
    }
    return best;
  }

  const exactSync = $derived(
    clipStartFrameTs !== null &&
      !!poses?.frames.some((f) => typeof f.t === "number"),
  );

  // Scrubbing seeks the clip to the shown pose frame (unless the video is
  // playing — then the video drives the scrubber).
  $effect(() => {
    const v = videoEl;
    const c = current;
    // Not while frames are being decoded (it would disturb the decode) or
    // once they're ready (they're drawn instead).
    if (!v || !videoReady || playing || clipFrames || framesProgress) return;
    const t = videoTimeFor(c);
    if (t === null) return;
    try {
      v.currentTime = t;
    } catch {
      /* seeking not ready */
    }
  });

  async function togglePlay() {
    const v = videoEl;
    if (!v) return;
    if (playing) {
      v.pause();
      playing = false;
      return;
    }
    if (clipFrames && poses) {
      playFrames();
      return;
    }
    if (current >= end) current = start;
    const t = videoTimeFor(current);
    if (t !== null) v.currentTime = t;
    playing = true;
    try {
      await v.play();
    } catch {
      playing = false;
      return;
    }
    const tick = () => {
      if (!playing || !videoEl) return;
      current = frameAtTime(videoEl.currentTime);
      if (videoEl.ended || current >= end) {
        videoEl.pause();
        playing = false;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Play by stepping through the decoded frames at the pose frames' times. */
  function playFrames(): void {
    const frs = poses!.frames;
    if (current >= end) current = start;
    let k = Math.max(
      0,
      frs.findIndex((f) => f.frameIndex === current),
    );
    const tOf = (i: number) => frs[i]!.t ?? (frs[i]!.frameIndex * 1000) / 30;
    const t0 = tOf(k);
    const s0 = performance.now();
    playing = true;
    const tick = () => {
      if (!playing) return;
      const target = t0 + (performance.now() - s0);
      while (k < frs.length - 1 && tOf(k + 1) <= target) k++;
      current = frs[k]!.frameIndex;
      if (k >= frs.length - 1) {
        playing = false;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Draw the decoded frame for the shown pose frame.
  $effect(() => {
    const c = clipCanvas;
    const frames = clipFrames;
    const box = videoBox;
    const cur = current;
    if (!c || !frames || !box) return;
    let k = clipFrameIdx.indexOf(cur);
    if (k < 0) k = clipFrameIdx.findIndex((i) => i > cur) - 1;
    const f = nearestFrame(frames, Math.max(0, k));
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx || !f) return;
    ctx.drawImage(f.canvas, 0, 0, c.width, c.height);
    c.dataset.frameVideoTime = f.time.toFixed(3);
  });

  $effect(() => {
    const c = canvas;
    const f = frame;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Back the canvas with a DPR-scaled bitmap of the stage size so the pose
    // is crisp, not a stretched 300×150 default.
    const fr = framing;
    const w = stageW || 300;
    const h = stageH || 400;
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (!f || !fr) return;

    const lm = f.landmarks;
    const project = projectWith(fr);
    // Test/debug hook: where this frame's visible joints landed on the stage.
    const pts = lm.filter((l) => l.visibility >= MIN_VIS).map(project);
    if (pts.length > 0) {
      c.dataset.frameBox = JSON.stringify({
        top: Math.min(...pts.map((q) => q.y)),
        bottom: Math.max(...pts.map((q) => q.y)),
        left: Math.min(...pts.map((q) => q.x)),
        right: Math.max(...pts.map((q) => q.x)),
      });
    }

    // Base skeleton.
    drawSkeleton(ctx, lm, w, h, {
      strokeStyle: "rgb(64 224 120 / 85%)",
      jointStyle: "rgb(255 255 255 / 85%)",
      lineWidth: 3,
      jointRadius: 3,
      project,
    });

    // The current phase's worst issues (or the metric clicked in the
    // scorecard, on its own until the scrubber moves): the measured body part
    // highlighted, plus its target zone on the frame it was measured. Paths
    // (no zone) still draw their trace.
    const issues = picked ? [picked] : phaseIssues.slice(0, 2);
    const drawn: string[] = [];
    const zones: string[] = [];
    const v = v3;
    if (v) {
      for (const m of issues) {
        if (current === m.frames.at(-1)) {
          const first = m.frames[0];
          const z = targetZone(m, {
            shootingHand: hand,
            nearSide: v.nearSide,
            project,
            lm,
            firstLm:
              poses!.frames.find((p) => p.frameIndex === first)?.landmarks ??
              null,
            facing: v.facing,
          });
          if (z) {
            drawTargetZone(ctx, z);
            zones.push(z.kind);
          }
        }
        const family = geometryFamily(m.id);
        drawn.push(
          ...drawGeometry(ctx, geometryFor(m.id), lm, {
            shootingHand: hand,
            nearSide: v.nearSide,
            project,
            highlightOnly: family !== "path",
            pathFrames: poses!.frames
              .filter(
                (p) =>
                  p.frameIndex >= Math.min(...m.frames, current) &&
                  p.frameIndex <= Math.max(...m.frames, current),
              )
              .map((p) => p.landmarks),
            color:
              m.score === null || m.score === 0
                ? "#34d399"
                : m.score >= 3
                  ? "#f87171"
                  : "#fbbf24",
          }),
        );
      }
    }
    c.dataset.zone = zones.join(",");
    c.dataset.geometry = drawn.join(",");
  });
</script>

<main class="review" data-testid="shot-review">
  <header>
    <Button
      variant="ghost"
      testid="shot-review-back"
      onclick={() =>
        history.length > 1 ? history.back() : goto(`/shots${page.url.search}`)}
    >
      ← Back
    </Button>
    <h1>Shot review</h1>
  </header>

  {#if notFound}
    <p class="dim" data-testid="shot-review-missing">Shot not found.</p>
  {:else if shot && (card || unavailable)}
    <div
      class="stage"
      bind:clientWidth={stageW}
      bind:clientHeight={stageH}
      data-testid="review-stage"
    >
      {#if clipUrl}
        <video
          bind:this={videoEl}
          class="clip"
          src={clipUrl}
          muted
          playsinline
          preload="auto"
          data-testid="review-video"
          data-start-frame-ts={clipStartFrameTs ?? ""}
          data-exact-sync={exactSync}
          style={videoBox
            ? `left:${videoBox.left}px;top:${videoBox.top}px;width:${videoBox.width}px;height:${videoBox.height}px`
            : ""}
          onloadedmetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) {
              videoSize = { width: v.videoWidth, height: v.videoHeight };
            }
            void prepareVideo(v);
          }}
        ></video>
        {#if clipFrames}
          <canvas
            bind:this={clipCanvas}
            class="clip"
            data-testid="review-clip-frames"
            style={videoBox
              ? `left:${videoBox.left}px;top:${videoBox.top}px;width:${videoBox.width}px;height:${videoBox.height}px`
              : ""}
          ></canvas>
        {/if}
      {/if}
      {#if poses && poses.frames.length > 0}
        <canvas
          bind:this={canvas}
          class="skeleton"
          data-testid="review-skeleton"
          data-framing={framing
            ? JSON.stringify({
                scale: framing.scale,
                offsetX: framing.offsetX,
                offsetY: framing.offsetY,
                aspect: framing.aspect,
              })
            : ""}
          data-approximate={framing?.approximate ?? false}
          data-frame-t={frame?.t ?? ""}
        ></canvas>
        {#if framing?.approximate}
          <span class="approx" data-testid="review-approx-framing"
            >Approximate framing (older shot)</span
          >
        {/if}
      {:else if !clipUrl}
        <p class="dim no-poses" data-testid="review-no-poses">
          No pose data stored for this shot.
        </p>
      {/if}
    </div>
    <!-- Below the stage (not over it) so the chips never hide the feet. The
         slot keeps its height when a phase has no issues, so the scrubber
         doesn't jump while scrubbing. -->
    {#if poses && poses.frames.length > 0 && phaseIssues.length === 0}
      <div class="phase-overlay" aria-hidden="true">
        <span class="po-head"
          >{currentPhase ? phaseName(currentPhase) : ""} · on target</span
        >
      </div>
    {:else if poses && poses.frames.length > 0}
      <div class="phase-overlay" data-testid="review-phase-metrics">
        <span class="po-head"
          >{currentPhase ? phaseName(currentPhase) : ""} · off target</span
        >
        <div class="po-chips">
          {#each phaseIssues.slice(0, 3) as m (m.id)}
            <span class="po-chip" class:bad={(m.score ?? 0) >= 3}
              >{feedbackText(m, wording)}</span
            >
          {/each}
        </div>
      </div>
    {/if}

    {#if poses && poses.frames.length > 0}
      <div class="scrubber">
        <div class="track" class:timing={!!timingBand}>
          {#each phaseStarts as kf (kf.phase)}
            <span
              class="marker"
              style="left:{markerLeft(kf.startFrame)}%"
              title={phaseName(kf.phase)}
            ></span>
          {/each}
          {#if timingBand}
            <span
              class="t-band"
              data-testid="review-timing-band"
              style="left:{markerLeft(timingBand.lo)}%;width:{Math.max(
                0.8,
                markerLeft(timingBand.hi) - markerLeft(timingBand.lo),
              )}%"
              title="Target window"
            ></span>
            <span
              class="t-event first"
              style="left:{markerLeft(timingBand.a)}%"
              title="First event"
            ></span>
            <span
              class="t-event second"
              data-testid="review-timing-actual"
              style="left:{markerLeft(timingBand.b)}%"
              title="When it happened"
            ></span>
          {/if}
        </div>
        {#if clipUrl}
          <button
            class="play"
            data-testid="review-play"
            aria-label={playing ? "Pause video" : "Play video"}
            disabled={!videoReady || framesProgress !== null}
            onclick={() => void togglePlay()}
          >
            {playing ? "⏸" : "▶"}
          </button>
        {/if}
        <input
          type="range"
          min={start}
          max={end}
          oninput={() => {
            picked = null;
            if (playing) {
              videoEl?.pause();
              playing = false;
            }
          }}
          bind:value={current}
          data-testid="review-scrubber"
          aria-label="Scrub shot"
        />
        {#if timingBand}
          <p class="t-legend" data-testid="review-timing-legend">
            <span class="dot first"></span> starts ·
            <span class="dot second"></span> when it happened ·
            <span class="swatch"></span> when it should happen
          </p>
        {/if}
        <div class="scrub-meta">
          <span>frame {current - start + 1} / {end - start + 1}</span>
          {#if framesProgress}<span
              class="frames-progress"
              data-testid="review-frames-progress">{framesProgress}</span
            >{/if}
          {#if currentPhase}<span class="phase-tag" data-testid="review-phase"
              >{phaseName(currentPhase)}</span
            >{/if}
        </div>
        {#if showClipInfo && clipInfo}
          <p class="clip-info" data-testid="review-clip-info">
            {#if clipProblem}Video can't reach every frame of this shot ·
            {/if}clip {fmtSec(clipInfo.duration)}, seekable to {fmtSec(
              clipInfo.seekableEnd,
            )}{#if clipInfo.expectedEnd !== null}, shot ends at {fmtSec(
                clipInfo.expectedEnd,
              )}{/if}{#if clipMeta}
              · {clipMeta.mime || "?"} · {(clipMeta.bytes / 1e6).toFixed(2)} MB{/if}
          </p>
        {/if}
        {#if debugVideo}
          <div class="video-debug" data-testid="review-video-debug">
            <pre>{debugText()}</pre>
            <div class="row">
              {#if clipUrl}
                <a
                  class="dbg-btn"
                  href={clipUrl}
                  download="shot-{shotId}.{clipMeta?.mime.includes('mp4')
                    ? 'mp4'
                    : 'webm'}"
                  data-testid="review-video-download">Download clip</a
                >
              {/if}
              <button class="dbg-btn" onclick={() => void copyDebug()}
                >{copied ? "Copied" : "Copy details"}</button
              >
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if card}
      <ScoreCardV3
        {card}
        highlightPhase={currentPhase}
        onmetric={seekToMetric}
        {wording}
      />
    {:else}
      <p class="dim" data-testid="review-reanalysis-unavailable">
        {REANALYSIS_UNAVAILABLE}: this shot was saved without the pose data the
        new metrics need.
      </p>
    {/if}
  {:else}
    <p class="dim">Loading…</p>
  {/if}
</main>

<style>
  .review {
    min-height: 100dvh;
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 18px;
  }
  .stage {
    position: relative;
    aspect-ratio: 3 / 4;
    /* On a phone, keep the phase issues + scrubber on screen above the tab
       bar (header ≈ 56, issues ≈ 64, scrubber ≈ 64, gaps/padding ≈ 64,
       tab bar 84 + safe area). The framing adapts to any stage size. */
    max-height: calc(100dvh - 332px - env(safe-area-inset-bottom));
    min-height: 260px;
    background: #000;
    border-radius: var(--sc-radius);
    overflow: hidden;
    display: grid;
    place-content: center;
  }
  /* Positioned + sized by the shot framing (same transform as the pose). */
  .frames-progress {
    color: var(--sc-text-dim);
  }
  .clip {
    position: absolute;
    object-fit: fill;
    background: #000;
  }
  .play {
    width: 40px;
    height: 32px;
    margin-right: 8px;
    border: 1px solid var(--sc-border);
    border-radius: 8px;
    background: var(--sc-card);
    color: var(--sc-text);
    cursor: pointer;
  }
  .approx {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgb(0 0 0 / 60%);
    color: #cbd5e1;
    font-size: 10px;
  }
  .skeleton {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .no-poses {
    padding: var(--sc-space-4);
    text-align: center;
  }
  .phase-overlay {
    padding: 6px 2px 0;
    min-height: 58px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
  }
  .po-head {
    font-size: 0.68rem;
    letter-spacing: 0.03em;
    color: #cbd5e1;
  }
  .po-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .po-chip {
    font-size: 0.72rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgb(251 191 36 / 18%);
    border: 1px solid rgb(251 191 36 / 70%);
    color: #fde68a;
  }
  .po-chip.bad {
    background: rgb(248 113 113 / 18%);
    border-color: rgb(248 113 113 / 70%);
    color: #fecaca;
  }
  .scrubber {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .track {
    position: relative;
    height: 6px;
  }
  .track.timing {
    height: 14px;
    margin-bottom: 4px;
  }
  .t-legend {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: var(--sc-text-dim);
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .t-legend .dot,
  .t-legend .swatch {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .t-legend .dot.first {
    background: #94a3b8;
  }
  .t-legend .dot.second {
    background: #fbbf24;
  }
  .t-legend .swatch {
    width: 14px;
    border-radius: 2px;
    background: rgb(52 211 153 / 35%);
    border: 1px dashed #34d399;
  }
  .t-band {
    position: absolute;
    top: 0;
    height: 12px;
    border-radius: 3px;
    background: rgb(52 211 153 / 35%);
    border: 1px dashed #34d399;
  }
  .t-event {
    position: absolute;
    top: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: translateX(-5px);
    border: 2px solid #fff;
  }
  .t-event.first {
    background: #94a3b8;
  }
  .t-event.second {
    background: #fbbf24;
  }
  .marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 6px;
    background: var(--sc-primary);
    transform: translateX(-1px);
  }
  .scrubber input {
    width: 100%;
  }
  .video-debug {
    margin-top: 0.5rem;
    font-size: 11px;
    color: var(--sc-text-dim);
  }
  .video-debug pre {
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0 0 6px;
  }
  .video-debug .row {
    display: flex;
    gap: 8px;
  }
  .dbg-btn {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: var(--sc-text);
    text-decoration: none;
  }
  .clip-info {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--sc-text-dim);
  }
  .scrub-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--sc-text-dim);
  }
  .phase-tag {
    color: var(--sc-primary);
    font-weight: 600;
  }
  .dim {
    color: var(--sc-text-dim);
  }
</style>
