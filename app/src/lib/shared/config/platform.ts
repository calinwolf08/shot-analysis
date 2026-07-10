import { Capacitor } from "@capacitor/core";

export type Platform = "ios" | "android" | "web";

/** Reads the runtime platform from Capacitor. */
export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}

/** True when running inside a native Capacitor shell. */
export function isNative(platform: Platform = getPlatform()): boolean {
  return platform === "ios" || platform === "android";
}

/** True when running in a plain browser (dev, tests, e2e). */
export function isWeb(platform: Platform = getPlatform()): boolean {
  return platform === "web";
}
