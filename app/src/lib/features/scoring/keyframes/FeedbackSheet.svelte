<script lang="ts">
  /**
   * The Feedback sheet (shot review and live practice): which checks the
   * player gets feedback on. Two tabs:
   *  - Focus areas: presets for common faults (one tap);
   *  - Pick checks: one card per check, its phases as toggles (orange = on),
   *    an "i" for what it measures and a whole-check on/off.
   * Turned-off checks are hidden everywhere (score, dots, callout, voice).
   * No scores here: it's about what to look at, not how this shot went.
   */
  import {
    ALL_CHECK_KEYS,
    CHECKS,
    CHECK_DEFS,
    KEYFRAME_NAME,
    checkKey,
    type CheckId,
  } from "basketball-shot-analysis";
  import { Sheet } from "$lib/shared/ui";
  import { FEEDBACK_PRESETS, activePreset } from "./filter";

  let {
    open = $bindable(false),
    enabled,
    onchange,
    initialTab = "focus",
    scrollTo = null,
  }: {
    open?: boolean;
    /** Enabled check ids (null = every check). */
    enabled: ReadonlySet<string> | null;
    /** The new selection (a full set; every check = all of them). */
    onchange: (next: ReadonlySet<string>) => void;
    initialTab?: "focus" | "pick";
    /** A check id to bring into view on the Pick checks tab. */
    scrollTo?: string | null;
  } = $props();

  let tab = $state<"focus" | "pick">("focus");
  let help = $state<CheckId | null>(null);
  let list = $state<HTMLElement | null>(null);

  const on = $derived(enabled ?? new Set(ALL_CHECK_KEYS));
  const preset = $derived(activePreset(on));
  const keyframesOf = (c: CheckId) => CHECK_DEFS[c].keyframes;

  $effect(() => {
    if (open) {
      tab = initialTab;
      const target = scrollTo;
      queueMicrotask(() => {
        const el = target
          ? list?.querySelector(`[data-check="${target.split(".")[1]}"]`)
          : null;
        el?.scrollIntoView({ block: "center" });
      });
    }
  });

  function toggle(id: string) {
    onchange(
      new Set(on.has(id) ? [...on].filter((x) => x !== id) : [...on, id]),
    );
  }

  function toggleCheck(c: CheckId) {
    const ids = keyframesOf(c).map((k) => checkKey(k, c));
    const allOn = ids.every((id) => on.has(id));
    onchange(
      new Set(
        allOn ? [...on].filter((x) => !ids.includes(x)) : [...on, ...ids],
      ),
    );
  }
</script>

<Sheet bind:open title="Feedback">
  <div class="fb" data-testid="feedback-sheet" bind:this={list}>
    <div class="head">
      <span class="count" data-testid="feedback-count"
        >{on.size} of {ALL_CHECK_KEYS.length} checks on</span
      >
      <button
        class="done"
        data-testid="feedback-done"
        onclick={() => (open = false)}>Done</button
      >
    </div>
    <div class="seg" role="tablist">
      <button
        role="tab"
        aria-selected={tab === "focus"}
        data-testid="feedback-tab-focus"
        onclick={() => (tab = "focus")}>Focus areas</button
      >
      <button
        role="tab"
        aria-selected={tab === "pick"}
        data-testid="feedback-tab-pick"
        onclick={() => (tab = "pick")}>Pick checks</button
      >
    </div>

    {#if tab === "focus"}
      <div class="presets">
        {#each FEEDBACK_PRESETS as p (p.id)}
          <button
            class="preset"
            class:on={preset?.id === p.id}
            aria-pressed={preset?.id === p.id}
            data-testid="feedback-preset-{p.id}"
            onclick={() => onchange(new Set(p.checks))}
          >
            <span class="pt">
              <b>{p.name}</b>
              <small>{p.description}</small>
              <span class="n">{p.checks.length} checks</span>
            </span>
            <span class="ck" aria-hidden="true"></span>
          </button>
        {/each}
        <p class="note">
          {preset ? "" : "You're using a custom set. "}Switch to Pick checks to
          turn single checks on or off.
        </p>
      </div>
    {:else}
      <div class="checks">
        {#each CHECKS as c (c)}
          {@const ids = keyframesOf(c).map((k) => checkKey(k, c))}
          <section
            class="check"
            data-check={c}
            data-testid="feedback-check-{c}"
          >
            <h4>
              <span class="name">{CHECK_DEFS[c].name}</span>
              <button
                class="info"
                aria-label="About {CHECK_DEFS[c].name}"
                aria-expanded={help === c}
                onclick={() => (help = help === c ? null : c)}>i</button
              >
              <button
                class="all"
                data-testid="feedback-all-{c}"
                onclick={() => toggleCheck(c)}
                >{ids.every((id) => on.has(id))
                  ? "Turn off"
                  : "Turn on"}</button
              >
            </h4>
            {#if help === c}<p class="help">{CHECK_DEFS[c].help}</p>{/if}
            <div class="chips">
              {#each keyframesOf(c) as k (k)}
                {@const id = checkKey(k, c)}
                <button
                  class="pill"
                  aria-pressed={on.has(id)}
                  data-testid="feedback-chip-{id}"
                  onclick={() => toggle(id)}>{KEYFRAME_NAME[k]}</button
                >
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  </div>
</Sheet>

<style>
  .fb {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: -6px;
  }
  .count {
    font-size: 12.5px;
    color: var(--sc-text-dim);
  }
  .done {
    border: none;
    border-radius: 999px;
    background: var(--sc-primary);
    color: #10131a;
    font: 700 13.5px var(--sc-font);
    padding: 7px 14px;
    cursor: pointer;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 3px;
    background: var(--sc-surface);
    border: 1px solid var(--sc-border);
    border-radius: 12px;
  }
  .seg button {
    border: none;
    background: none;
    color: var(--sc-text-dim);
    font: 600 13.5px var(--sc-font);
    padding: 8px 0;
    border-radius: 9px;
    cursor: pointer;
  }
  .seg button[aria-selected="true"] {
    background: var(--sc-card-raised);
    color: var(--sc-text);
  }
  .presets,
  .checks {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .preset {
    display: flex;
    gap: 12px;
    align-items: center;
    text-align: left;
    border: 1.5px solid var(--sc-border);
    background: var(--sc-card-raised);
    border-radius: 12px;
    padding: 12px 14px;
    cursor: pointer;
    color: var(--sc-text);
    font: inherit;
  }
  .preset.on {
    border-color: var(--sc-primary);
    background:
      linear-gradient(rgb(255 122 41 / 8%), rgb(255 122 41 / 8%)),
      var(--sc-card-raised);
  }
  .pt {
    flex: 1;
    min-width: 0;
  }
  .preset b {
    display: block;
    font-size: 14.5px;
    font-weight: 600;
  }
  .preset small {
    display: block;
    font-size: 12.5px;
    color: var(--sc-text-dim);
    margin-top: 3px;
  }
  .n {
    display: block;
    font-size: 11.5px;
    color: var(--sc-text-dim);
    margin-top: 6px;
    opacity: 0.8;
  }
  .ck {
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--sc-border);
    display: grid;
    place-items: center;
  }
  .preset.on .ck {
    border-color: var(--sc-primary);
  }
  .preset.on .ck::after {
    content: "";
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--sc-primary);
  }
  .note {
    margin: 2px 2px 0;
    font-size: 12px;
    color: var(--sc-text-dim);
  }
  .check {
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-border);
    border-radius: 12px;
    padding: 11px 12px 12px;
  }
  h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14.5px;
    font-weight: 600;
  }
  .name {
    flex: 1;
  }
  .info {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid var(--sc-text-dim);
    color: var(--sc-text-dim);
    background: none;
    font:
      italic 700 10.5px Georgia,
      serif;
    display: inline-grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }
  .all {
    background: none;
    border: none;
    color: var(--sc-primary);
    font: 600 12px var(--sc-font);
    cursor: pointer;
    padding: 2px 0;
  }
  .help {
    margin: 6px 0 0;
    font-size: 12.5px;
    color: var(--sc-text-dim);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 10px;
  }
  .pill {
    border: 1.5px solid var(--sc-primary);
    background: rgb(255 122 41 / 16%);
    color: #ffb07d;
    border-radius: 999px;
    padding: 5px 11px;
    font: 600 12.5px var(--sc-font);
    cursor: pointer;
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .pill::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .pill[aria-pressed="false"] {
    border-color: var(--sc-border);
    background: transparent;
    color: var(--sc-text-dim);
  }
  .pill[aria-pressed="false"]::before {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px currentColor;
  }
  button:focus-visible {
    outline: 2px solid var(--sc-primary);
    outline-offset: 2px;
  }
</style>
