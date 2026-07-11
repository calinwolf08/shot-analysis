<script lang="ts">
  /**
   * Live-detection debug HUD. Renders coordinator diagnostics over the
   * practice loop: state machine state, wrist velocity vs the rep trigger,
   * settle progress, buffer stats, and a rolling event log (rep started /
   * analyzing / result / no shot / near-trigger). Everything also goes to
   * console.debug("[live]", …). Only mounted behind the debug gate — never
   * in production builds.
   */
  import { onMount } from "svelte";
  import type {
    CoordinatorEvents,
    LiveRepCoordinator,
  } from "../coordinator/coordinator";

  let { coordinator }: { coordinator: LiveRepCoordinator } = $props();

  type Debug = CoordinatorEvents["debug"];
  let snap = $state<Debug | null>(null);
  let log = $state<{ at: number; text: string }[]>([]);

  function push(at: number, text: string) {
    console.debug("[live]", text);
    log = [{ at, text }, ...log].slice(0, 8);
  }

  const fmtTs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  const fmtV = (v: number) => v.toFixed(2);

  onMount(() => {
    let lastConsole = 0;
    const subs = [
      coordinator.on("debug", (d) => {
        snap = d;
        // Per-frame numbers are HUD-only; console gets a 1 Hz heartbeat.
        if (d.timestamp - lastConsole >= 1000) {
          lastConsole = d.timestamp;
          console.debug(
            "[live]",
            `t=${fmtTs(d.timestamp)} state=${d.state} pose=${d.posePresent} ` +
              `v=${fmtV(d.smoothedVelocity)}/${fmtV(d.riseVelocity)} ` +
              `buffer=${d.bufferFrames}f/${Math.round(d.bufferSpanMs)}ms`,
          );
        }
      }),
      coordinator.on("stateChanged", (e) =>
        push(snap?.timestamp ?? 0, `state ${e.from} → ${e.to}`),
      ),
      coordinator.on("repStarted", (e) =>
        push(e.timestamp, `rep started (t=${fmtTs(e.timestamp)})`),
      ),
      coordinator.on("repAnalyzing", (e) =>
        push(
          snap?.timestamp ?? 0,
          `analyzing ${e.frameCount} frames (${e.trigger})`,
        ),
      ),
      coordinator.on("repResult", (e) =>
        push(
          e.window.endedAt,
          `shot detected (${e.analysis.shots.length} in window)`,
        ),
      ),
      coordinator.on("noShot", (e) =>
        push(e.window.endedAt, `no shot (${e.reason})`),
      ),
      coordinator.on("nearTrigger", (e) =>
        push(
          e.timestamp,
          `near trigger: peak v=${fmtV(e.peakVelocity)} < ${fmtV(e.riseVelocity)}`,
        ),
      ),
    ];
    return () => {
      for (const unsub of subs) unsub();
    };
  });

  const velocityFraction = $derived(
    snap
      ? Math.min(1, Math.max(0, snap.smoothedVelocity / snap.riseVelocity))
      : 0,
  );
  const settleFraction = $derived(
    snap?.settledForMs != null
      ? Math.min(1, snap.settledForMs / snap.settleMs)
      : 0,
  );
</script>

<aside class="hud" data-testid="live-debug-hud" aria-hidden="true">
  <div class="row">
    <span class="k">state</span>
    <span class="v" data-testid="live-debug-state">{snap?.state ?? "—"}</span>
    <span class="k">pose</span>
    <span class="v">{snap ? (snap.posePresent ? "yes" : "no") : "—"}</span>
  </div>
  <div class="row">
    <span class="k">v</span>
    <span class="v">
      {snap ? fmtV(snap.smoothedVelocity) : "—"} / {snap
        ? fmtV(snap.riseVelocity)
        : "—"}
    </span>
    <span class="bar"
      ><span style="width: {velocityFraction * 100}%"></span></span
    >
  </div>
  <div class="row">
    <span class="k">settle</span>
    <span class="v">
      {snap?.settledForMs != null
        ? `${Math.round(snap.settledForMs)}/${snap.settleMs}ms`
        : "—"}
    </span>
    <span class="bar settle">
      <span style="width: {settleFraction * 100}%"></span>
    </span>
  </div>
  <div class="row">
    <span class="k">buffer</span>
    <span class="v">
      {snap
        ? `${snap.bufferFrames}f · ${Math.round(snap.bufferSpanMs)}ms`
        : "—"}
    </span>
  </div>
  <ol class="log" data-testid="live-debug-log">
    {#each log as entry, i (log.length - i)}
      <li>{fmtTs(entry.at)} · {entry.text}</li>
    {/each}
  </ol>
</aside>

<style>
  .hud {
    position: fixed;
    left: 8px;
    bottom: 8px;
    z-index: 50;
    width: min(320px, calc(100vw - 16px));
    padding: 8px 10px;
    border-radius: 8px;
    background: rgb(0 0 0 / 78%);
    color: #9be49b;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    pointer-events: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .k {
    color: #7d8a99;
  }
  .v {
    color: #e8f2e8;
  }
  .bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: rgb(255 255 255 / 15%);
    overflow: hidden;
  }
  .bar > span {
    display: block;
    height: 100%;
    background: #ffb340;
    transition: width 80ms linear;
  }
  .bar.settle > span {
    background: #58b8ff;
  }
  .log {
    margin: 6px 0 0;
    padding: 0 0 0 14px;
    color: #c9d4df;
  }
</style>
