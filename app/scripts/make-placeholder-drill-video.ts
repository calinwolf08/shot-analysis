/**
 * Generates static/drills/placeholder.webm — a 5 s animated placeholder
 * (bouncing ball + progress sweep on the app's dark palette) — plus an SVG
 * thumbnail carrying the "Drill video coming soon" text.
 *
 * Playwright's bundled ffmpeg has no rawvideo demuxer, so instead the
 * animation is drawn on a canvas inside headless Chromium and recorded
 * with MediaRecorder (VP8/WebM) — same binary the e2e suite uses.
 *
 * Run from app/: npx tsx scripts/make-placeholder-drill-video.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "static", "drills");

// Same resolution order as playwright.config.ts.
const containerChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync(containerChromium) ? containerChromium : undefined);

async function recordVideo(): Promise<Buffer> {
  const browser = await chromium.launch(
    executablePath ? { executablePath } : {},
  );
  try {
    const page = await browser.newPage();
    // tsx (esbuild) decorates the serialized callback with a __name helper
    // that doesn't exist in the page; provide a no-op shim.
    await page.evaluate("globalThis.__name = (fn) => fn");
    const base64 = await page.evaluate(async () => {
      const W = 640;
      const H = 360;
      const SECONDS = 5;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      const draw = (t: number) => {
        // Background — app dark palette.
        ctx.fillStyle = "#1A1E26";
        ctx.fillRect(0, 0, W, H);

        // Bouncing basketball.
        const phase = (t * 1.2) % 1;
        const bounce = Math.abs(Math.sin(phase * Math.PI));
        const cx = W / 2;
        const cy = H * 0.72 - bounce * H * 0.35;
        const r = 28;
        ctx.fillStyle = "#FF7A29";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        // Seams.
        ctx.strokeStyle = "#14100C";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();

        // Ground line + progress sweep.
        const groundY = H * 0.8;
        ctx.strokeStyle = "#2C3342";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, groundY);
        ctx.lineTo(W - 40, groundY);
        ctx.stroke();
        const progress = Math.min(1, t / SECONDS);
        ctx.fillStyle = "#FF7A29";
        ctx.fillRect(40, H - 24, (W - 80) * progress, 4);
      };

      draw(0);
      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
        videoBitsPerSecond: 250_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((res) => {
        recorder.onstop = () => res();
      });
      recorder.start();

      const start = performance.now();
      await new Promise<void>((res) => {
        const tick = () => {
          const t = (performance.now() - start) / 1000;
          if (t >= SECONDS) {
            recorder.stop();
            res();
            return;
          }
          draw(t);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await stopped;

      const blob = new Blob(chunks, { type: "video/webm" });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]!);
      return btoa(binary);
    });
    return Buffer.from(base64, "base64");
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  // 1) The video.
  const webm = await recordVideo();
  if (webm.length < 10_000) {
    throw new Error(`Recorded video suspiciously small: ${webm.length} bytes`);
  }
  const outFile = join(outDir, "placeholder.webm");
  writeFileSync(outFile, webm);
  console.log(`Wrote ${outFile} (${webm.length} bytes)`);

  // 2) The thumbnail/poster (carries the text).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#1A1E26"/>
  <circle cx="320" cy="140" r="46" fill="#FF7A29"/>
  <path d="M274 140h92M320 94v92M287 108c22 18 22 46 0 64M353 108c-22 18-22 46 0 64" stroke="#14100C" stroke-width="4" fill="none"/>
  <text x="320" y="250" text-anchor="middle" fill="#F2F4F8" font-family="system-ui, sans-serif" font-size="26" font-weight="700">Drill video coming soon</text>
  <text x="320" y="284" text-anchor="middle" fill="#98A2B3" font-family="system-ui, sans-serif" font-size="15">Placeholder — real drill footage will replace this</text>
</svg>
`;
  writeFileSync(join(outDir, "placeholder-thumb.svg"), svg);
  console.log(`Wrote ${join(outDir, "placeholder-thumb.svg")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
