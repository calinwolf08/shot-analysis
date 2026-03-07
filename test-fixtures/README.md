# Test Fixtures

This directory contains pose landmark data extracted from test videos.
These fixtures allow testing the shot detection algorithm without requiring MediaPipe/browser.

## Generating fixtures

1. Run `npm run validate` and analyze a video in your browser
2. Open browser console and run: `copy(JSON.stringify(window.lastPoseData))`
3. Save to a file in this directory: `<video-name>_poses.json`

Or use the "Export Poses" button in the validation UI (if available).
