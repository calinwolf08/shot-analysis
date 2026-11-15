# Real shooting videos (golden inputs)

Drop one or more real basketball shooting clips here to activate the
full-pipeline automation harness (`src-tests/e2e/manual/real-analysis.spec.ts`).

- **Format:** anything the browser can decode — `.mp4`, `.mov`, `.webm`, `.m4v`.
- **Framing:** side view, whole body + the arc of the ball in frame (the same
  guidance the app shows). One clip can contain several shots.
- **Naming:** the harness records a golden baseline next to each video as
  `<name>.expected.json` (e.g. `jumpshots.mp4` → `jumpshots.mp4.expected.json`).

## How the harness uses them

1. If this folder has no video, the spec **skips** with a message — so CI stays
   green until you add one.
2. First run for a new video (or with `UPDATE_BASELINE=1`) **records** the
   detected shot count into `<name>.expected.json`.
3. Later runs **assert** the real MediaPipe → analysis pipeline still detects
   that same number of shots, each with a numeric form score. A regression in
   video decoding, pose detection, or shot detection fails the run.

Commit both the video and its `.expected.json` if you want CI to enforce it.
Videos can be large; keep clips short (a few seconds, a handful of shots).
