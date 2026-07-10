# Validating the core analysis features

Shot analysis is **two stages**, and it's worth knowing which one each check
covers:

1. **Vision stage** — video pixels / camera frames → pose landmarks, via
   MediaPipe (WASM + WebGL, in a Web Worker).
2. **Analysis stage** — pose landmarks → detected shots, 26 metrics, a score,
   and a diagnosis (the library's detector/metrics + the app's scoring).

`?e2e=replay` and the bulk of the test suite exercise **stage 2 only** — they
feed pre-recorded pose JSON and stub MediaPipe. The `vision-smoke` e2e test and
the golden video harness below exercise **stage 1** with the real worker.

## Manual validation (you drive it)

Start the app: `npm run dev` (from `app/`), open the printed URL.

| Check                           | URL / steps                                                                      | Stages                                                                |
| ------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Pre-recorded, real**          | plain URL → Assessment → "Tap to add videos" → pick a real side-on shooting clip | 1 + 2 (real MediaPipe on your file)                                   |
| **Pre-recorded, deterministic** | add `?e2e=replay` → Assessment → pick a built-in 1/3/7-shot fixture              | 2 only, no video needed                                               |
| **Live, real**                  | plain URL in a browser with a webcam → Practice → Live                           | 1 + 2 on camera frames                                                |
| **Live, deterministic**         | add `?e2e=replay` → Practice → Live                                              | rep loop / feedback / summary, driven by a looping fixture, no camera |

For the two **real** rows you supply the video/camera — none is committed. Film
side-on, whole body + the ball's arc in frame.

## Automated validation

| Command                                                          | What it proves                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                                                   | Stage 2 golden values: shot counts + exact metrics from pose fixtures (Node + jsdom).                                             |
| `npx playwright test src-tests/e2e/analysis.spec.ts`             | Stage 2 in a real browser via the replay backend.                                                                                 |
| `npx playwright test src-tests/e2e/vision-smoke.spec.ts`         | **Stage 1 headless**: the real MediaPipe worker loads (WASM + WebGL + model), decodes a clip, and runs pose detection end to end. |
| `npx playwright test src-tests/e2e/manual/real-analysis.spec.ts` | **Stage 1 + 2 golden**: real videos → detected shot count asserted against a baseline. Skips until you add a clip.                |

### Adding your own video regression test

1. Drop a clip in `src-tests/fixtures/videos/` (see that folder's README).
2. Record the baseline once:
   `UPDATE_BASELINE=1 npx playwright test src-tests/e2e/manual/real-analysis.spec.ts`
   → writes `<name>.expected.json` (the detected shot count).
3. Commit the video + its `.expected.json`. From then on the harness asserts the
   real pipeline still detects that many shots — catching any regression in
   decoding, pose detection, or shot detection.

> Note: the headless GPU here is SwiftShader (software), so the real-MediaPipe
> tests run in the tens of seconds. On a real GPU they're much faster.
