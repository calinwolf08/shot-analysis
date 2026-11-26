<script lang="ts">
  /**
   * Shot review (docs/keyframe-review-plan.md): the shot's clip full-bleed
   * (or a grey skeleton when this device has no clip), with the keyframe
   * checks drawn on the body at each of the five keyframes:
   *  - a dot on the joint each check is about, colored by its score (green 0,
   *    yellow 1–3, red 4+); checks on the same joint stack as overlapping
   *    circles and open a chooser;
   *  - a blue box / band / wedge for where that joint should be; the
   *    selected check's zone is bright with an arrow from its dot, the others
   *    fade to dashed outlines;
   *  - a callout for the selected check (the keyframe's worst by default),
   *    placed in free space, with a speaker to hear it.
   * Phase icons (the player's own pose at each keyframe) jump between
   * keyframes; the scrubber plays through the rest of the shot. The Feedback
   * pill opens the shared filter sheet; turned-off checks are hidden.
   *
   * Pose comes from the server-stored skeleton track (every shot, every
   * device); a retained on-device clip renders behind it.
   */
  import { deviceDebugEnabled } from "$lib/shared/debug/debug-mode";
  import { onDestroy, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { getShotClipStore } from "$lib/shared/media/shot-clip-store";
  import type { ShotRecord, ShotReviewPoses } from "$lib/shared/db/repos";
  import type { StoredShotAnalysis } from "$lib/features/analysis";
  import {
    KEYFRAMES,
    KEYFRAME_NAME,
    type Keyframe,
    type KeyframeTargets,
    type ShotKeyframes,
  } from "basketball-shot-analysis";
  import {
    FeedbackSheet,
    checkText,
    filterLabel,
    loadEnabledChecks,
    loadKeyframeTargets,
    saveEnabledChecks,
    scoreShotKeyframes,
    severity,
    spokenReadback,
    type CheckResult,
  } from "$lib/features/scoring/keyframes";
  import { displayScore } from "$lib/features/scoring/v3";
  import { scoreStoredShot } from "./scored-shots";
  import {
    checkGeometry,
    dotStacks,
    nearestOnZone,
    placeCallout,
    poseIcons,
    type DotStack,
    type Obstacle,
    type Pt,
    type StageZone,
    type Zone,
  } from "./keyframe-overlay";
  import {
    extractClipFramesFromUrl,
    nearestFrame,
    type ClipFrames,
  } from "./clip-frames";
  import { REANALYSIS_UNAVAILABLE } from "./shot-list";
  import { Button } from "$lib/shared/ui";
  import { drawSkeleton } from "$lib/shared/ui/pose-skeleton";
  import { createWebAudioFeedbackService } from "$lib/shared/audio";
  import { withAudioProbe } from "$lib/shared/audio/audio-probe";
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
  // Dev/E2E: what's said is mirrored into window.__scAudioLog.
  const devSurfaces = import.meta.env.DEV || import.meta.env.VITE_E2E === "1";
  let audio: ReturnType<typeof createWebAudioFeedbackService> | null = null;
  function voice() {
    audio ??= devSurfaces
      ? withAudioProbe(createWebAudioFeedbackService())
      : createWebAudioFeedbackService();
    return audio;
  }

  let shot = $state<ShotRecord | null>(null);
  let poses = $state<ShotReviewPoses | null>(null);
  let checks = $state.raw<ShotKeyframes | null>(null);
  let targets = $state.raw<KeyframeTargets | null>(null);
  /** Feedback filter (enabled check ids; null = every check). */
  let enabled = $state.raw<ReadonlySet<string> | null>(null);
  /** Older shot without a pose track: can't be scored on the keyframe checks. */
  let unavailable = $state(false);
  let current = $state(0);
  let notFound = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let calloutEl = $state<HTMLElement | null>(null);
  /** The selected check (its zone, arrow and callout are shown). */
  let sel = $state<string | null>(null);
  /** A stacked joint's chooser (stage position + its check ids). */
  let chooser = $state<{ at: Pt; ids: readonly string[] } | null>(null);
  let sheetOpen = $state(false);
  let sheetTab = $state<"focus" | "pick">("focus");
  let sheetScroll = $state<string | null>(null);
  /** Height of the controls laid over the bottom of the stage. */
  let controlsH = $state(0);
  /** Where the callout sits (stage px). */
  let calloutPos = $state<Pt | null>(null);
  /**
   * The keyframe last tapped: Rise and Set point share a frame in a
   * one-motion shot, so the frame alone can't tell which one is shown.
   */
  let chosenKf = $state<Keyframe | null>(null);

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
      // Fit the shot above the controls laid over the stage's bottom.
      { width: stageW, height: Math.max(160, stageH - controlsH) },
      source,
    );
  });
  const videoBox = $derived(framing ? sourceRect(framing) : null);

  const analysis = $derived(
    shot ? (shot.analysis as StoredShotAnalysis) : null,
  );
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
  const frame = $derived(
    poses?.frames.find((f) => f.frameIndex === current) ?? null,
  );

  /** The scorecard with the feedback filter applied. */
  const card = $derived(
    checks && targets ? scoreShotKeyframes(checks, targets, enabled) : null,
  );

  /** Each keyframe's pose frame (the nearest stored frame). */
  const kfFrame = $derived.by((): Record<Keyframe, number | null> => {
    const out = {} as Record<Keyframe, number | null>;
    for (const k of KEYFRAMES) {
      const at = checks?.keyframes[k];
      if (at === null || at === undefined || !poses?.frames.length) {
        out[k] = null;
        continue;
      }
      let best = poses.frames[0]!.frameIndex;
      for (const f of poses.frames) {
        if (Math.abs(f.frameIndex - at) < Math.abs(best - at))
          best = f.frameIndex;
      }
      out[k] = best;
    }
    return out;
  });
  /** The keyframe being shown (null between keyframes). */
  const atKeyframe = $derived(
    chosenKf && kfFrame[chosenKf] === current
      ? chosenKf
      : (KEYFRAMES.find((k) => kfFrame[k] === current) ?? null),
  );
  /** The phase the scrubber is in (the last keyframe reached). */
  const phaseNow = $derived.by((): Keyframe => {
    if (atKeyframe) return atKeyframe;
    let p: Keyframe = "setup";
    for (const k of KEYFRAMES) {
      const f = kfFrame[k];
      if (f !== null && current >= f) p = k;
    }
    return p;
  });

  const resultsAt = (k: Keyframe): readonly CheckResult[] =>
    card?.keyframes.find((x) => x.keyframe === k)?.checks ?? [];
  /** The keyframe's worst check (ties: catalog order); null when none enabled. */
  function worstAt(k: Keyframe): CheckResult | null {
    let best: CheckResult | null = null;
    for (const r of resultsAt(k)) {
      if (!best || (r.score ?? -1) > (best.score ?? -1)) best = r;
    }
    return best;
  }
  const sevColor = (s: number | null) => {
    const v = severity(s);
    return v === "good"
      ? "#34d399"
      : v === "warn"
        ? "#fde047"
        : v === "bad"
          ? "#f87171"
          : "#98a2b3";
  };
  const SEV_WORD = (s: number | null) =>
    s === null
      ? "Not measured."
      : displayScore(s) === "0"
        ? "In range."
        : displayScore(s) === "1"
          ? "Almost there."
          : Number(displayScore(s)) <= 3
            ? "Worth watching."
            : "Needs attention.";

  const selected = $derived(
    atKeyframe && sel
      ? (resultsAt(atKeyframe).find((r) => r.id === sel) ?? null)
      : null,
  );

  // Arriving at a keyframe (or changing the filter) selects its worst check.
  $effect(() => {
    const k = atKeyframe;
    void card;
    untrack(() => {
      chooser = null;
      if (!k) return;
      if (!sel || !resultsAt(k).some((r) => r.id === sel)) {
        sel = worstAt(k)?.id ?? null;
      }
    });
  });

  /** Stick figures of the player's own pose at each keyframe. */
  const icons = $derived.by(() => {
    if (!poses || !checks) return KEYFRAMES.map(() => null);
    const lm = KEYFRAMES.map((k) => {
      const f = kfFrame[k];
      return f === null
        ? null
        : (poses!.frames.find((p) => p.frameIndex === f)?.landmarks ?? null);
    });
    return poseIcons(lm, checks.xScale, checks.nearSide);
  });

  $effect(() => {
    void load(shotId);
  });

  async function load(id: string) {
    const [s, p, t, player, en] = await Promise.all([
      services.repos.shot.get(id),
      services.repos.shot.getPoses(id),
      loadKeyframeTargets(),
      services.repos.player.getFirst(),
      loadEnabledChecks(services.repos.settings),
    ]);
    if (!s) {
      notFound = true;
      return;
    }
    const hand = player?.shootingHand ?? "right";
    // Older shots get their keyframe checks computed from the pose track here.
    const scored = await scoreStoredShot(
      services.repos.shot,
      s,
      hand,
      t,
      p,
      en,
    );
    shot = scored.record;
    poses = p;
    targets = t;
    enabled = en;
    checks = (scored.record.analysis as StoredShotAnalysis).keyframes ?? null;
    unavailable = checks === null;
    // Open on the keyframe of the shot's worst check (else Setup).
    const worst = scored.card?.worst[0];
    const k = worst?.keyframe ?? "setup";
    chosenKf = k;
    const at = checks?.keyframes[k];
    const frames = p?.frames ?? [];
    current =
      at !== null && at !== undefined && frames.length
        ? frames.reduce((b, f) =>
            Math.abs(f.frameIndex - at) < Math.abs(b.frameIndex - at) ? f : b,
          ).frameIndex
        : (frames[0]?.frameIndex ?? s.analysis.frameRange.start);
    void loadClip(id);
  }

  function goTo(k: Keyframe) {
    const f = kfFrame[k];
    if (f === null) return;
    stopPlaying();
    chosenKf = k;
    current = f;
    sel = worstAt(k)?.id ?? null;
  }

  function stopPlaying() {
    if (playing) {
      videoEl?.pause();
      playing = false;
    }
  }

  function changeFilter(next: ReadonlySet<string>) {
    enabled = next;
    void saveEnabledChecks(services.repos.settings, next);
  }

  function openSheet(tab: "focus" | "pick", scrollTo: string | null = null) {
    sheetTab = tab;
    sheetScroll = scrollTo;
    sheetOpen = true;
  }

  function hear() {
    const r = selected;
    if (!r) return;
    const a = voice();
    a.unlock();
    void a.speak(r.score ? spokenReadback([r]) : `${r.name} is in range.`);
  }

  function markerLeft(f: number): number {
    const span = Math.max(end - start, 1);
    return ((f - start) / span) * 100;
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

  /** The stacks drawn on the last frame (stage px), for tapping. */
  let stacks: DotStack[] = [];
  const BONES: [number, number][] = [
    [11, 12],
    [11, 23],
    [12, 24],
    [23, 24],
    [12, 14],
    [14, 16],
    [16, 20],
    [11, 13],
    [13, 15],
    [24, 26],
    [26, 28],
    [23, 25],
    [25, 27],
    [28, 32],
    [27, 31],
  ];

  function toStageZone(z: Zone, P: (l: Pt) => Pt): StageZone {
    if (z.kind === "wedge") return { kind: "poly", pts: z.pts.map(P) };
    const a = P({ x: z.x, y: z.y });
    const b = P({ x: z.x + z.w, y: z.y + z.h });
    return { kind: "rect", x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  function drawZone(
    ctx: CanvasRenderingContext2D,
    z: StageZone,
    kind: Zone["kind"],
    on: boolean,
  ) {
    ctx.lineWidth = on ? 2.5 : 1;
    ctx.setLineDash(on ? [] : [4, 3]);
    ctx.strokeStyle = on ? "#ffffff" : "rgb(150 190 255 / 45%)";
    ctx.fillStyle = on
      ? kind === "box"
        ? "rgb(36 84 200 / 82%)"
        : "rgb(64 132 255 / 50%)"
      : "rgb(56 120 235 / 13%)";
    if (z.kind === "poly") {
      ctx.beginPath();
      z.pts.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
    }
    ctx.setLineDash([]);
  }

  function arrow(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x + Math.cos(ang) * 11, a.y + Math.sin(ang) * 11);
    ctx.lineTo(b.x - Math.cos(ang) * 6, b.y - Math.sin(ang) * 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang - 0.45) * 9, b.y - Math.sin(ang - 0.45) * 9);
    ctx.lineTo(b.x - Math.cos(ang + 0.45) * 9, b.y - Math.sin(ang + 0.45) * 9);
    ctx.closePath();
    ctx.fill();
  }

  $effect(() => {
    const c = canvas;
    const f = frame;
    const fr = framing;
    const k = atKeyframe;
    const shotChecks = checks;
    const results = k ? resultsAt(k) : [];
    const pick = sel;
    const co = calloutEl;
    void selected;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = stageW || 300;
    const h = stageH || 400;
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    stacks = [];
    c.dataset.zone = "";
    c.dataset.stacks = "";
    if (!f || !fr) return;

    const lm = f.landmarks;
    const project = projectWith(fr);
    // Test/debug hook: where this frame's visible joints landed on the stage.
    const vis = lm.filter((l) => l.visibility >= MIN_VIS).map(project);
    if (vis.length > 0) {
      c.dataset.frameBox = JSON.stringify({
        top: Math.min(...vis.map((q) => q.y)),
        bottom: Math.max(...vis.map((q) => q.y)),
        left: Math.min(...vis.map((q) => q.x)),
        right: Math.max(...vis.map((q) => q.x)),
      });
    }

    // No clip on this device: a grey skeleton stands in for the video.
    if (!clipUrl) {
      drawSkeleton(ctx, lm, w, h, {
        strokeStyle: "rgb(170 178 192 / 75%)",
        jointStyle: "rgb(170 178 192 / 0%)",
        lineWidth: 3,
        jointRadius: 0,
        project,
      });
    }
    if (!k || !shotChecks || results.length === 0) {
      calloutPos = null;
      return;
    }

    const geo = checkGeometry(lm, shotChecks, results);
    const P = (p: Pt) => project(p);
    const selGeo = pick ? geo[pick] : undefined;
    // Zones: the others faint, the selected one bright and on top.
    const seen: string[] = [];
    for (const r of results) {
      const z = geo[r.id]?.zone;
      if (!z || r.id === pick) continue;
      const key = JSON.stringify(z);
      if (
        seen.includes(key) ||
        (selGeo?.zone && JSON.stringify(selGeo.zone) === key)
      )
        continue;
      seen.push(key);
      drawZone(ctx, toStageZone(z, P), z.kind, false);
    }
    const selZone = selGeo?.zone ? toStageZone(selGeo.zone, P) : null;
    if (selGeo?.zone && selZone) drawZone(ctx, selZone, selGeo.zone.kind, true);
    c.dataset.zone = selGeo?.zone?.kind ?? "";

    // The spine line (always), and the selected check's measured limbs.
    const back = Object.values(geo).find((g) => g.joint === "shoulders");
    if (back && back.limbs.length === 2) {
      const [a, b] = back.limbs.map(P) as [Pt, Pt];
      ctx.strokeStyle = "rgb(255 255 255 / 55%)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (selGeo && selGeo.limbs.length > 1) {
      const pts = selGeo.limbs.map(P);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.fillStyle = "#fff";
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, 7);
        ctx.fill();
      }
    }

    // Dots: stacks per joint (worst first); the selected one ringed, on top.
    const byId = new Map(results.map((r) => [r.id, r]));
    stacks = dotStacks(
      results
        .filter((r) => geo[r.id]?.dot)
        .map((r) => ({ id: r.id, at: P(geo[r.id]!.dot!), score: r.score })),
    );
    const posOf = (id: string): Pt | null => {
      for (const s of stacks) {
        const i = s.ids.indexOf(id);
        if (i >= 0) return s.pos[i]!;
      }
      return null;
    };
    const sp = pick ? posOf(pick) : null;
    if (sp && selZone) {
      const t = nearestOnZone(selZone, sp);
      if (t && Math.hypot(t.x - sp.x, t.y - sp.y) > 12) arrow(ctx, sp, t);
    }
    for (const s of stacks) {
      const order = s.ids
        .map((_, i) => i)
        .sort((a, b) => Number(s.ids[a] === pick) - Number(s.ids[b] === pick));
      for (const i of order) {
        const p = s.pos[i]!;
        const id = s.ids[i]!;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = sevColor(byId.get(id)?.score ?? null);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.5, 0, 7);
        ctx.fill();
        if (id === pick) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 13, 0, 7);
          ctx.stroke();
        }
      }
      if (s.ids.length > 1) {
        const p = s.pos[s.ids.length - 1]!;
        ctx.fillStyle = "#10131a";
        ctx.beginPath();
        ctx.arc(p.x + 9, p.y - 9, 6.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(s.ids.length), p.x + 9, p.y - 8.5);
      }
    }
    // Test hook: each joint's checks and where its stack sits (stage px).
    c.dataset.stacks = JSON.stringify(
      stacks.map((s) => ({ ids: s.ids, x: s.at.x, y: s.at.y })),
    );

    // Callout: free space that covers the fewest dots / zone / body points.
    if (!co || !pick) {
      calloutPos = null;
      return;
    }
    const anchor = sp ??
      posOf(`${k}.hand_height`) ??
      stacks[0]?.at ?? { x: w / 2, y: h / 3 };
    const obstacles: Obstacle[] = [];
    for (const s of stacks)
      for (const p of s.pos)
        obstacles.push({ x: p.x, y: p.y, weight: 40, radius: 16 });
    if (selZone) {
      if (selZone.kind === "poly")
        for (const p of selZone.pts)
          obstacles.push({ x: p.x, y: p.y, weight: 8, radius: 10 });
      else
        for (let i = 0; i <= 4; i++)
          for (let j = 0; j <= 4; j++)
            obstacles.push({
              x: selZone.x + (selZone.w * i) / 4,
              y: selZone.y + (selZone.h * j) / 4,
              weight: 6,
              radius: 6,
            });
    }
    for (const [a, b] of BONES) {
      const la = lm[a];
      const lb = lm[b];
      if (!la || !lb || la.visibility < 0.05 || lb.visibility < 0.05) continue;
      const pa = P(la);
      const pb = P(lb);
      const n = Math.max(
        1,
        Math.round(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 8),
      );
      for (let i = 0; i <= n; i++)
        obstacles.push({
          x: pa.x + ((pb.x - pa.x) * i) / n,
          y: pa.y + ((pb.y - pa.y) * i) / n,
          weight: 3,
          radius: 14,
        });
    }
    const cw = co.offsetWidth;
    const ch = co.offsetHeight;
    const pos = placeCallout({ w: cw, h: ch }, anchor, obstacles, {
      x0: 10,
      y0: 10,
      x1: w - 10,
      y1: Math.max(10 + ch, h - controlsH - 8),
    });
    calloutPos = pos;
    const ex = Math.max(pos.x, Math.min(pos.x + cw, anchor.x));
    const ey = pos.y + ch / 2 < anchor.y ? pos.y + ch : pos.y;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = "rgb(255 255 255 / 85%)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  /** Tapping a dot selects its check; a stack opens the chooser. */
  function onStageTap(e: MouseEvent) {
    chooser = null;
    if (!canvas || !atKeyframe) return;
    const r = canvas.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    let best: DotStack | null = null;
    let bd = Infinity;
    for (const s of stacks) {
      const d = Math.min(...s.pos.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (!best || bd > 28) return;
    if (best.ids.length === 1) sel = best.ids[0]!;
    else chooser = { at: best.at, ids: best.ids };
  }
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
    {#if card}
      <span
        class="overall"
        data-severity={severity(card.overall) ?? "none"}
        data-testid="review-overall"
        title="Shot score">{displayScore(card.overall)}</span
      >
    {/if}
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
          data-keyframe={atKeyframe ?? ""}
          data-fit-height={Math.max(160, stageH - controlsH)}
          data-selected={sel ?? ""}
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
          onclick={onStageTap}
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

      {#if selected && atKeyframe}
        <div
          class="callout"
          bind:this={calloutEl}
          style={calloutPos
            ? `left:${calloutPos.x}px;top:${calloutPos.y}px`
            : "visibility:hidden"}
          data-testid="review-callout"
          role="button"
          tabindex="0"
          aria-label="Choose feedback"
          onclick={() => openSheet("pick", selected?.id ?? null)}
          onkeydown={(e) =>
            e.key === "Enter" && openSheet("pick", selected?.id ?? null)}
        >
          <span class="num" style="background:{sevColor(selected.score)}"
            >{selected.score === null
              ? "–"
              : displayScore(selected.score)}</span
          >
          <span class="ct">
            <b data-testid="review-callout-title">{checkText(selected)}</b>
            <span class="sub"
              >{selected.check === "hold" && selected.value !== null
                ? `${selected.value.toFixed(2)} s from Rise to Set point · `
                : ""}{SEV_WORD(selected.score)}</span
            >
          </span>
          <button
            class="spk"
            aria-label="Hear this"
            data-testid="review-hear"
            onclick={(e) => {
              e.stopPropagation();
              hear();
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M3 8v4h3l4 3V5L6 8H3z" /><path
                d="M13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10"
              /></svg
            >
          </button>
        </div>
      {/if}

      {#if chooser && atKeyframe}
        {@const k = atKeyframe}
        <div
          class="chooser"
          data-testid="review-chooser"
          style="left:{Math.max(
            10,
            Math.min(stageW - 230, chooser.at.x - 110),
          )}px;top:{Math.max(
            10,
            chooser.at.y - 60 - chooser.ids.length * 46,
          )}px"
        >
          <p>{chooser.ids.length} checks on this joint</p>
          {#each chooser.ids as id (id)}
            {@const r = resultsAt(k).find((x) => x.id === id)}
            {#if r}
              <button
                class:on={id === sel}
                data-testid="review-chooser-{id}"
                onclick={() => {
                  sel = id;
                  chooser = null;
                }}
              >
                <span class="chip" style="background:{sevColor(r.score)}"
                  >{r.score === null ? "–" : displayScore(r.score)}</span
                >
                <span class="ct"
                  >{r.score ? checkText(r) : r.name}<small
                    >{r.score ? r.name : "In range"}</small
                  ></span
                >
              </button>
            {/if}
          {/each}
        </div>
      {/if}

      {#if poses && poses.frames.length > 0}
        <div class="controls" bind:clientHeight={controlsH}>
          <div class="row">
            <span class="spacer" aria-hidden="true"></span>
            <button
              class="pill"
              data-testid="review-filter"
              onclick={() => openSheet("focus")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                ><path d="M3 5h8M15 5h2M3 10h2M9 10h8M3 15h10" /><circle
                  cx="13"
                  cy="5"
                  r="2"
                /><circle cx="7" cy="10" r="2" /><circle
                  cx="15"
                  cy="15"
                  r="2"
                /></svg
              >
              {filterLabel(enabled)}
            </button>
            {#if clipUrl}
              <button
                class="round"
                data-testid="review-play"
                aria-label={playing ? "Pause video" : "Play video"}
                disabled={!videoReady || framesProgress !== null}
                onclick={() => void togglePlay()}
              >
                {playing ? "⏸" : "▶"}
              </button>
            {:else}
              <span class="spacer" aria-hidden="true"></span>
            {/if}
          </div>
          <div class="scrubber">
            <div class="track">
              {#each KEYFRAMES as k (k)}
                {#if kfFrame[k] !== null}
                  {@const w = worstAt(k)}
                  <span
                    class="tick"
                    style="left:{markerLeft(kfFrame[k]!)}%;background:{w
                      ? sevColor(w.score)
                      : 'rgb(255 255 255 / 45%)'}"
                    title={KEYFRAME_NAME[k]}
                  ></span>
                {/if}
              {/each}
              {#if kfFrame.rise !== null && kfFrame.setPoint !== null && resultsAt("setPoint").some((r) => r.check === "hold")}
                <span
                  class="hold"
                  data-testid="review-hold"
                  style="left:{markerLeft(kfFrame.rise!)}%;width:{Math.max(
                    0.8,
                    markerLeft(kfFrame.setPoint!) - markerLeft(kfFrame.rise!),
                  )}%"
                  title="Hold at set point"
                ></span>
              {/if}
            </div>
            <input
              type="range"
              min={start}
              max={end}
              oninput={() => {
                chooser = null;
                stopPlaying();
              }}
              bind:value={current}
              data-testid="review-scrubber"
              aria-label="Scrub shot"
            />
          </div>
          <div class="icons">
            {#each KEYFRAMES as k, i (k)}
              {@const w = worstAt(k)}
              {@const ic = icons[i]}
              <button
                class:on={phaseNow === k}
                disabled={kfFrame[k] === null}
                data-testid="review-icon-{k}"
                aria-label={KEYFRAME_NAME[k]}
                onclick={() => goTo(k)}
              >
                {#if ic}
                  <svg viewBox="0 0 40 44" aria-hidden="true">
                    <circle cx={ic.head.x} cy={ic.head.y} r="3.4" />
                    {#each ic.lines as [a, b], j (j)}
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    {/each}
                  </svg>
                {/if}
                {#if w}<span class="sev" style="background:{sevColor(w.score)}"
                  ></span>{/if}
              </button>
            {/each}
          </div>
          <div class="labels">
            {#each KEYFRAMES as k (k)}
              <span
                class:on={phaseNow === k}
                data-testid={phaseNow === k ? "review-phase" : undefined}
                >{KEYFRAME_NAME[k]}</span
              >
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="below">
      {#if unavailable}
        <p class="dim" data-testid="review-reanalysis-unavailable">
          {REANALYSIS_UNAVAILABLE}: this shot was saved without the pose data
          the checks need.
        </p>
      {/if}
      {#if framesProgress}<p
          class="frames-progress"
          data-testid="review-frames-progress"
        >
          {framesProgress}
        </p>{/if}
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

    <FeedbackSheet
      bind:open={sheetOpen}
      {enabled}
      onchange={changeFilter}
      initialTab={sheetTab}
      scrollTo={sheetScroll}
    />
  {:else}
    <p class="dim">Loading…</p>
  {/if}
</main>

<style>
  .review {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-3) var(--sc-space-4) var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 18px;
    flex: 1;
  }
  .overall {
    min-width: 34px;
    text-align: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 14px;
    color: #10131a;
    background: #98a2b3;
    font-variant-numeric: tabular-nums;
  }
  .overall[data-severity="good"] {
    background: #34d399;
  }
  .overall[data-severity="warn"] {
    background: #fde047;
  }
  .overall[data-severity="bad"] {
    background: #f87171;
  }
  /* Fills the screen above the tab bar (header ≈ 52, tab bar 84 + safe
     area, padding); the framing fits the shot above the controls. */
  .stage {
    position: relative;
    height: calc(100dvh - 160px - env(safe-area-inset-bottom));
    min-height: 420px;
    background: #000;
    border-radius: var(--sc-radius);
    overflow: hidden;
    display: grid;
    place-content: center;
  }
  .clip {
    position: absolute;
    object-fit: fill;
    background: #000;
  }
  .skeleton {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .approx {
    position: absolute;
    right: 8px;
    top: 8px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgb(0 0 0 / 60%);
    color: #cbd5e1;
    font-size: 10px;
  }
  .no-poses {
    padding: var(--sc-space-4);
    text-align: center;
  }
  .callout {
    position: absolute;
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: calc(100% - 20px);
    background: rgb(250 250 252 / 96%);
    color: #141821;
    border-radius: 14px;
    padding: 8px 8px 8px 10px;
    box-shadow: 0 6px 20px rgb(0 0 0 / 30%);
    cursor: pointer;
    z-index: 2;
  }
  .callout .num {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 15px;
    color: #141821;
  }
  .callout .ct {
    min-width: 0;
  }
  .callout b {
    display: block;
    font-size: 15px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .callout .sub {
    font-size: 12.5px;
    color: #4a5263;
  }
  .spk {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: #e6e9ef;
    color: #141821;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .chooser {
    position: absolute;
    z-index: 3;
    width: 220px;
    background: rgb(250 250 252 / 97%);
    color: #141821;
    border-radius: 14px;
    padding: 8px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .chooser p {
    margin: 2px 6px 4px;
    font-size: 11px;
    color: #5d6677;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .chooser button {
    display: flex;
    gap: 10px;
    align-items: center;
    text-align: left;
    border: 1.5px solid transparent;
    background: #eef0f4;
    border-radius: 10px;
    padding: 7px 9px;
    font: 600 13.5px var(--sc-font);
    color: #141821;
    cursor: pointer;
  }
  .chooser button.on {
    border-color: var(--sc-primary);
  }
  .chooser small {
    display: block;
    font-weight: 400;
    font-size: 11px;
    color: #5d6677;
  }
  .chip {
    flex: none;
    min-width: 26px;
    text-align: center;
    padding: 1px 6px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 12px;
    color: #10131a;
  }
  .controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 18px 8px 6px;
    background: linear-gradient(transparent, rgb(0 0 0 / 72%) 25%);
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #fff;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
  }
  .spacer {
    width: 36px;
  }
  .pill {
    height: 34px;
    padding: 0 16px;
    border-radius: 999px;
    border: none;
    background: rgb(255 255 255 / 22%);
    backdrop-filter: blur(6px);
    color: #fff;
    font: 600 14px var(--sc-font);
    display: flex;
    gap: 8px;
    align-items: center;
    cursor: pointer;
  }
  .round {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgb(255 255 255 / 22%);
    color: #fff;
    cursor: pointer;
  }
  .scrubber {
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .track {
    position: relative;
    height: 12px;
    margin: 0 8px;
  }
  .tick {
    position: absolute;
    top: 0;
    width: 4px;
    height: 12px;
    border-radius: 2px;
    transform: translateX(-2px);
  }
  .hold {
    position: absolute;
    bottom: -3px;
    height: 3px;
    border-radius: 2px;
    background: #fff;
    opacity: 0.85;
  }
  .scrubber input {
    width: 100%;
    accent-color: #4aa3ff;
    margin: 0;
  }
  .icons,
  .labels {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    justify-items: center;
  }
  .icons button {
    position: relative;
    width: 44px;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid transparent;
    background: none;
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }
  .icons button.on {
    border-color: #fff;
  }
  .icons button:disabled {
    opacity: 0.35;
  }
  .icons svg {
    width: 70%;
    height: 70%;
    overflow: visible;
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  .icons .sev {
    position: absolute;
    top: 3px;
    right: 6px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1.5px solid #000;
  }
  .labels span {
    font-size: 10px;
    color: rgb(255 255 255 / 70%);
  }
  .labels span.on {
    color: #fff;
    font-weight: 600;
  }
  button:focus-visible,
  .callout:focus-visible {
    outline: 2px solid var(--sc-primary);
    outline-offset: 2px;
  }
  .below {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .frames-progress {
    margin: 0;
    font-size: 0.78rem;
    color: var(--sc-text-dim);
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
  .dim {
    color: var(--sc-text-dim);
  }
</style>
