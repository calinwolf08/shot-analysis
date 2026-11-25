/**
 * Device diagnostics mode (works in production): one switch for every debug
 * tool a tester needs on a phone — the practice flight recorder
 * (Download/Share/Copy of the last ~20 s) and the review video panel.
 *
 *   ?debug=on    turn it on (remembered on this device across pages/reloads)
 *   ?debug=off   turn it off
 *
 * The older `?debug=capture` and `?debug=video` turn it on too. (`?debug=live`
 * is the separate dev-only overlay and is not affected.)
 */
const KEY = "shotcoach.debug";
const ON = new Set(["on", "capture", "video"]);

export function deviceDebugEnabled(url: URL): boolean {
  const v = url.searchParams.get("debug");
  try {
    if (v === "off") {
      localStorage.removeItem(KEY);
      return false;
    }
    if (v !== null && ON.has(v)) {
      localStorage.setItem(KEY, "1");
      return true;
    }
    return localStorage.getItem(KEY) === "1";
  } catch {
    // No storage (private mode, SSR): only this URL counts.
    return v !== null && ON.has(v);
  }
}
