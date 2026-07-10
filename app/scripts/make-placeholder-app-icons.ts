/**
 * Generates the placeholder icon/splash set by screenshotting a styled
 * page in headless Chromium — no native image tooling required in this
 * container. Writes both the @capacitor/assets source set (assets/) and
 * the Android/iOS asset PNGs directly (the @capacitor/assets CLI can't
 * install here: its sharp binary download is blocked by the proxy).
 *
 * Run from app/: npx tsx scripts/make-placeholder-app-icons.ts
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "assets");

const containerChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync(containerChromium) ? containerChromium : undefined);

function artHtml(size: number, dark: boolean): string {
  const bg = dark ? "#12151b" : "#1A1E26";
  const ball = size * 0.34;
  return `<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:${bg};display:grid;place-content:center;font-family:system-ui">
      <div style="width:${ball}px;height:${ball}px;border-radius:50%;background:#FF7A29;position:relative;margin:0 auto">
        <div style="position:absolute;inset:0;border-radius:50%;background:
          linear-gradient(#14100C,#14100C) 50% 0/4% 100% no-repeat,
          linear-gradient(#14100C,#14100C) 0 50%/100% 4% no-repeat"></div>
      </div>
      <p style="color:#F2F4F8;text-align:center;font-size:${size * 0.09}px;font-weight:800;letter-spacing:0.04em;margin:${size * 0.05}px 0 0">ShotCoach</p>
    </div>
  </body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const browser: Browser = await chromium.launch(
    executablePath ? { executablePath } : {},
  );

  async function shoot(size: number, dark: boolean, path: string) {
    if (!existsSync(dirname(path))) return; // scaffold layout changed — skip
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(artHtml(size, dark));
    await page.screenshot({ path });
    await page.close();
    console.log(`Wrote ${path.replace(`${root}/`, "")}`);
  }

  try {
    // @capacitor/assets-compatible source set (for regeneration on a
    // machine where the CLI installs cleanly).
    await shoot(1024, false, join(outDir, "icon-only.png"));
    await shoot(2732, false, join(outDir, "splash.png"));
    await shoot(2732, true, join(outDir, "splash-dark.png"));

    // Android launcher mipmaps + splash drawables.
    const res = join(root, "android", "app", "src", "main", "res");
    const MIPMAPS: [string, number][] = [
      ["mipmap-mdpi", 48],
      ["mipmap-hdpi", 72],
      ["mipmap-xhdpi", 96],
      ["mipmap-xxhdpi", 144],
      ["mipmap-xxxhdpi", 192],
    ];
    for (const [dir, size] of MIPMAPS) {
      for (const name of [
        "ic_launcher.png",
        "ic_launcher_round.png",
        "ic_launcher_foreground.png",
      ]) {
        await shoot(size, false, join(res, dir, name));
      }
    }
    const SPLASH: Record<string, number> = {
      mdpi: 480,
      hdpi: 800,
      xhdpi: 1280,
      xxhdpi: 1600,
      xxxhdpi: 1920,
    };
    for (const [density, size] of Object.entries(SPLASH)) {
      for (const orientation of ["land", "port"]) {
        await shoot(
          size,
          false,
          join(res, `drawable-${orientation}-${density}`, "splash.png"),
        );
      }
    }
    await shoot(480, false, join(res, "drawable", "splash.png"));

    // iOS app icon + splash imageset.
    const iosAssets = join(root, "ios", "App", "App", "Assets.xcassets");
    await shoot(
      1024,
      false,
      join(iosAssets, "AppIcon.appiconset", "AppIcon-512@2x.png"),
    );
    for (const name of [
      "splash-2732x2732.png",
      "splash-2732x2732-1.png",
      "splash-2732x2732-2.png",
    ]) {
      await shoot(2732, false, join(iosAssets, "Splash.imageset", name));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
