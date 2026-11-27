/**
 * Narrowed full-rate re-check vs re-checking the whole rep window, on every
 * recorded shot (test-data/). Live frames are simulated by keeping every 2nd
 * (15 fps) or 3rd (10 fps) frame of the 30 fps track; the rep window runs
 * from ~0.9 s before Setup to ~1.1 s after Release, like a live rep. Compares
 * keyframe times, every check and the shot score.
 *
 *   SPAN_REPORT=1 npx vitest run src/lib/features/live-practice/refine/__tests__/span-compare.test.ts
 *
 * Writes test-results/span-compare.md.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import {
  ALL_CHECK_KEYS,
  KEYFRAMES,
  computeShotKeyframes,
  type KeyframeTargets,
  type PoseData,
} from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";
import {
  poseDataToLandmarkFrames,
  runReplayAnalysis,
} from "$lib/features/analysis/replay/replay-pipeline";
import {
  POSE_PAD_AFTER,
  POSE_PAD_BEFORE,
  scoreShotKeyframes,
} from "$lib/features/scoring/keyframes";
import {
  SPAN_EDGE_MS,
  SPAN_EXTEND_MS,
  SPAN_MARGIN_MS,
  keyframeSpan,
} from "../full-rate";

const ROOT = join(process.cwd(), "..", "test-data");
const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static/reference/live-targets-keyframes.json"),
    "utf8",
  ),
) as KeyframeTargets;

describe.skipIf(!process.env.SPAN_REPORT)("narrowed vs full re-check", () =>
  it("report", () => {
    const rows: string[] = [];
    const agg: Record<
      string,
      {
        kfErr: number[];
        kfMiss: number;
        scoreErr: number[];
        checkErr: Record<string, number[]>;
        detected: number[];
        liveOnlyScoreErr: number[];
        liveOnlyKfErr: number[];
      }
    > = {};
    let shots = 0;
    for (const id of readdirSync(ROOT).sort()) {
      const p = join(ROOT, id, "poses.json");
      if (!existsSync(p)) continue;
      const pose = JSON.parse(readFileSync(p, "utf8")) as PoseData;
      const aspect =
        pose.width && pose.height ? pose.width / pose.height : 9 / 16;
      const all = poseDataToLandmarkFrames(pose).filter(
        (f) => f.landmarks && f.landmarks.length,
      );
      // ms timestamps on a 30 fps clock
      const frames: LandmarkFrame[] = all.map((f, i) => ({
        ...f,
        frameIndex: i,
        timestamp: (i * 1000) / (pose.fps || 30),
      }));
      const res = runReplayAnalysis(
        frames,
        { shootingHand: "right", profile: "pro-form" },
        { fps: pose.fps || 30 },
      );
      for (const shot of res.shots) {
        const kfOf = (fs: readonly LandmarkFrame[]) =>
          computeShotKeyframes(
            fs.map((f, i) => ({
              frameIndex: i,
              timestamp: f.timestamp,
              landmarks: f.landmarks,
            })),
            { aspect, shootingHand: "right" },
          );
        // Like the live rep window: ~0.9 s before Setup to ~1.1 s after Release.
        const wide0 = Math.max(0, shot.frameRange.start - POSE_PAD_BEFORE - 30);
        const wide = frames.slice(
          wide0,
          Math.min(frames.length, shot.frameRange.end + POSE_PAD_AFTER + 30),
        );
        const k0 = kfOf(wide);
        if (k0.keyframes.setup === null || k0.keyframes.release === null)
          continue;
        const lo = Math.max(0, wide0 + Math.floor(k0.keyframes.setup) - 27);
        const hi = Math.min(
          frames.length - 1,
          wide0 + Math.ceil(k0.keyframes.release) + 33,
        );
        const full = frames.slice(lo, hi + 1);
        const ref = kfOf(full);
        if (KEYFRAMES.some((k) => ref.keyframes[k] === null)) continue;
        shots++;
        const tAt = (fs: readonly LandmarkFrame[], x: number | null) => {
          if (x === null) return null;
          const i = Math.max(0, Math.min(fs.length - 1, Math.floor(x)));
          const j = Math.min(fs.length - 1, i + 1);
          return (
            fs[i]!.timestamp + (x - i) * (fs[j]!.timestamp - fs[i]!.timestamp)
          );
        };
        const refScore = scoreShotKeyframes(ref, targets).overall;
        for (const [name, step] of [
          ["15 fps live", 2],
          ["10 fps live", 3],
        ] as const) {
          const a = (agg[name] ??= {
            kfErr: [],
            kfMiss: 0,
            scoreErr: [],
            checkErr: {},
            detected: [],
            liveOnlyScoreErr: [],
            liveOnlyKfErr: [],
          });
          const live = full.filter((_, i) => i % step === 0);
          const winFrom = live[0]!.timestamp,
            winTo = live.at(-1)!.timestamp;
          const span = keyframeSpan({
            shootingHand: "right",
            aspect: () => aspect,
          });
          const g = span(live);
          let from = g ? Math.max(winFrom, g.fromTs - SPAN_MARGIN_MS) : winFrom;
          let to = g ? Math.min(winTo, g.toTs + SPAN_MARGIN_MS) : winTo;
          const dense = (f: number, t: number) =>
            full.filter((x) => x.timestamp >= f && x.timestamp <= t);
          const merge = (f: number, t: number) => [
            ...live.filter((x) => x.timestamp < f),
            ...dense(f, t),
            ...live.filter((x) => x.timestamp > t),
          ];
          let detected = dense(from, to).length;
          if (g) {
            const again = span(merge(from, to));
            if (again) {
              if (again.fromTs < from + SPAN_EDGE_MS && from > winFrom) {
                const nf = Math.max(
                  winFrom,
                  Math.min(
                    from - SPAN_EXTEND_MS,
                    again.fromTs - SPAN_MARGIN_MS,
                  ),
                );
                detected += dense(nf, from - 1).length;
                from = nf;
              }
              if (again.toTs > to - SPAN_EDGE_MS && to < winTo) {
                const nt = Math.min(
                  winTo,
                  Math.max(to + SPAN_EXTEND_MS, again.toTs + SPAN_MARGIN_MS),
                );
                detected += dense(to + 1, nt).length;
                to = nt;
              }
            }
          }
          const merged = merge(from, to);
          const got = kfOf(merged);
          const lonly = kfOf(live);
          a.detected.push(detected / full.length);
          for (const k of KEYFRAMES) {
            const rt = tAt(full, ref.keyframes[k]);
            const gt = tAt(merged, got.keyframes[k]);
            const lt = tAt(live, lonly.keyframes[k]);
            if (rt === null || gt === null) a.kfMiss++;
            else {
              a.kfErr.push(Math.abs(gt - rt));
              if (Math.abs(gt - rt) > 50)
                rows.push(
                  `OUTLIER ${name} ${id} shot@${shot.frameRange.start} ${k}: full ${rt.toFixed(0)} new ${gt.toFixed(0)} live-only ${lt?.toFixed(0)} | span ${from.toFixed(0)}–${to.toFixed(0)} guess ${g ? `${g.fromTs.toFixed(0)}–${g.toTs.toFixed(0)}` : "none"}`,
                );
            }
            if (rt !== null && lt !== null)
              a.liveOnlyKfErr.push(Math.abs(lt - rt));
          }
          const s = scoreShotKeyframes(got, targets).overall;
          const ls = scoreShotKeyframes(lonly, targets).overall;
          if (refScore !== null && s !== null)
            a.scoreErr.push(Math.abs(s - refScore));
          if (refScore !== null && s !== null && Math.abs(s - refScore) > 0.3) {
            const diffs = ALL_CHECK_KEYS.filter(
              (k2) => ref.checks[k2]?.reliable && got.checks[k2]?.reliable,
            )
              .map(
                (k2) =>
                  [
                    k2,
                    Math.abs(got.checks[k2]!.value - ref.checks[k2]!.value) /
                      targets.checks[k2]!.rampSd,
                  ] as const,
              )
              .sort((x, y) => y[1] - x[1])
              .slice(0, 4);
            rows.push(
              `BIGSCORE ${name} ${id} shot@${shot.frameRange.start}: ref ${refScore.toFixed(2)} new ${s.toFixed(2)} facing ref ${ref.facing} new ${got.facing} centreLine ${ref.centreLine}/${got.centreLine} nearSide ${ref.nearSide}/${got.nearSide} torso ${ref.lengths.torso?.toFixed(3)}/${got.lengths.torso?.toFixed(3)} top: ${diffs.map(([k2, v]) => `${k2} ${v.toFixed(1)}`).join(", ")}`,
            );
          }
          if (refScore !== null && ls !== null)
            a.liveOnlyScoreErr.push(Math.abs(ls - refScore));
          for (const id2 of ALL_CHECK_KEYS) {
            const r = ref.checks[id2],
              m = got.checks[id2];
            if (r?.reliable && m?.reliable) {
              const t = targets.checks[id2]!;
              // error in score points (value difference ÷ the check's spread)
              (a.checkErr[id2] ??= []).push(
                Math.abs(m.value - r.value) / t.rampSd,
              );
            }
          }
        }
      }
    }
    const q = (xs: number[], p: number) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length
        ? s[Math.min(s.length - 1, Math.floor(s.length * p))]!
        : NaN;
    };
    rows.push(`shots compared: ${shots}`);
    for (const [name, a] of Object.entries(agg)) {
      rows.push(`\n## ${name}`);
      rows.push(
        `frames re-detected vs full window: median ${(q(a.detected, 0.5) * 100).toFixed(0)}%  (p90 ${(q(a.detected, 0.9) * 100).toFixed(0)}%)`,
      );
      rows.push(
        `keyframe time error (ms), new vs full: median ${q(a.kfErr, 0.5).toFixed(1)}  p90 ${q(a.kfErr, 0.9).toFixed(1)}  max ${q(a.kfErr, 1).toFixed(1)}  missing ${a.kfMiss}`,
      );
      rows.push(
        `keyframe time error (ms), live only: median ${q(a.liveOnlyKfErr, 0.5).toFixed(1)}  p90 ${q(a.liveOnlyKfErr, 0.9).toFixed(1)}`,
      );
      rows.push(
        `overall score error: new median ${q(a.scoreErr, 0.5).toFixed(3)} p90 ${q(a.scoreErr, 0.9).toFixed(3)} max ${q(a.scoreErr, 1).toFixed(3)} | live only median ${q(a.liveOnlyScoreErr, 0.5).toFixed(3)} p90 ${q(a.liveOnlyScoreErr, 0.9).toFixed(3)}`,
      );
      const worst = Object.entries(a.checkErr)
        .map(([k, v]) => [k, q(v, 0.9), q(v, 1)] as const)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 6);
      rows.push(
        `worst checks (p90 / max error, in score points): ${worst.map(([k, p9, mx]) => `${k} ${p9.toFixed(2)}/${mx.toFixed(2)}`).join(", ")}`,
      );
    }
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/span-compare.md", rows.join("\n") + "\n");
    console.log(rows.join("\n"));
  }),
);
