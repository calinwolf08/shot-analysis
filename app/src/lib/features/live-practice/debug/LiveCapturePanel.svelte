<script lang="ts">
  /**
   * `?debug=capture`: a small panel on the practice screen to export the last
   * ~20 s (pose frames + what the loop decided) for diagnosis — see
   * live-capture.ts. Download saves a .json file; Share hands it to the phone's
   * share sheet (e.g. to email / chat); Copy puts the JSON on the clipboard.
   */
  import { onDestroy } from "svelte";
  import type { LiveCapture, LiveCaptureFile } from "./live-capture";

  let {
    capture,
    exportFile,
  }: {
    capture: LiveCapture;
    /** Builds the export (adds fps / frame size / latest stats). */
    exportFile: () => LiveCaptureFile;
  } = $props();

  let frames = $state(0);
  let span = $state(0);
  let status = $state<string | null>(null);
  let open = $state(true);
  const tick = setInterval(() => {
    frames = capture.frameCount;
    span = capture.spanMs;
  }, 500);
  onDestroy(() => clearInterval(tick));

  function build(): { name: string; json: string } {
    const f = exportFile();
    const stamp = f.capturedAt.replace(/[:.]/g, "-");
    return {
      name: `shotcoach-capture-${stamp}.json`,
      json: JSON.stringify(f),
    };
  }
  function done(msg: string) {
    status = msg;
    setTimeout(() => (status = null), 3000);
  }
  function download() {
    const { name, json } = build();
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    done(`Saved ${(json.length / 1e6).toFixed(1)} MB`);
  }
  async function share() {
    const { name, json } = build();
    const file = new File([json], name, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        done("Shared");
      } else {
        download();
      }
    } catch {
      /* cancelled */
    }
  }
  async function copy() {
    const { json } = build();
    try {
      await navigator.clipboard.writeText(json);
      done(`Copied ${(json.length / 1e6).toFixed(1)} MB`);
    } catch {
      done("Clipboard blocked — use Download");
    }
  }
</script>

<div class="capture" data-testid="live-capture-panel">
  <button class="toggle" onclick={() => (open = !open)}
    >⏺ {(span / 1000).toFixed(0)} s</button
  >
  {#if open}
    <span class="meta" data-testid="live-capture-frames">{frames} frames</span>
    <button onclick={download} data-testid="live-capture-download"
      >Download</button
    >
    <button onclick={() => void share()}>Share</button>
    <button onclick={() => void copy()}>Copy</button>
    {#if status}<span class="meta">{status}</span>{/if}
  {/if}
</div>

<style>
  .capture {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 56px);
    left: 8px;
    z-index: 50;
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    max-width: calc(100vw - 16px);
    padding: 6px 8px;
    border-radius: 10px;
    background: rgb(15 17 21 / 85%);
    color: #e6e8ee;
    font-size: 12px;
  }
  button {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #2c313c;
    background: #1f232c;
    color: #e6e8ee;
  }
  .toggle {
    color: #f87171;
  }
  .meta {
    color: #9aa3b2;
  }
</style>
