# Device testing checklist (manual)

Items that cannot be validated headlessly in CI. Run on a real phone (and
once on desktop Chrome) before a release.

## Real MediaPipe analysis (`@manual-device`)

1. `npm run cap:sync` and install the debug build on a device (or run
   `npm run dev` in desktop Chrome).
2. Record/pick a real shooting video, run the assessment flow end-to-end.
3. Verify: shots detected match reality (±0), metrics table is populated,
   analysis speed is ≥ 0.5× realtime (60 s video ≤ 2 min).
4. Live practice: pose detection sustained ≥ 12 fps on a 2021 mid-range
   phone (downsampled 640px); rep feedback latency (settle → score) ≤ 2.5 s.

## iOS specifics

- `npx cap sync ios` must be re-run on macOS (CocoaPods install is skipped
  on Linux — see docs/deviations.md).
- Camera permission prompt shows the NSCameraUsageDescription copy.
- getUserMedia works inside the Capacitor webview (iOS ≥ 14.3).

## Other manual items

- Filesystem persistence of uploaded videos across app restarts.
- TTS voices: rep score + cue spoken; mute toggle honored.
- Keep-awake + orientation lock during live practice.
- Haptics on rep detection.
