<script lang="ts">
  /**
   * Bottom-sheet picker for live focus areas. Controlled: the parent owns the
   * selected ids and persists them; each toggle calls `onchange` with the next
   * selection so it can apply live (even mid-session).
   */
  import Sheet from "$lib/shared/ui/Sheet.svelte";
  import { FOCUS_AREAS } from "./focus";

  let {
    open = $bindable(false),
    selected = [],
    onchange,
  }: {
    open?: boolean;
    selected?: string[];
    onchange: (ids: string[]) => void;
  } = $props();

  function toggle(id: string) {
    onchange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }
</script>

<Sheet bind:open title="Coach me on…">
  <ul class="areas" data-testid="focus-areas">
    {#each FOCUS_AREAS as area (area.id)}
      {@const on = selected.includes(area.id)}
      <li>
        <button
          class="area"
          class:on
          aria-pressed={on}
          data-testid="focus-area-{area.id}"
          onclick={() => toggle(area.id)}
        >
          <span class="check" class:on aria-hidden="true">{on ? "✓" : ""}</span>
          <span class="text">
            <span class="label">{area.label}</span>
            <span class="hint">{area.hint}</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
  <div class="foot">
    <button
      class="clear"
      data-testid="focus-clear"
      onclick={() => onchange([])}
      disabled={selected.length === 0}
    >
      Clear all
    </button>
    <span class="note" data-testid="focus-note">
      {selected.length === 0
        ? "Coaching on everything"
        : `Focusing on ${selected.length}`}
    </span>
  </div>
</Sheet>

<style>
  .areas {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .area {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
    padding: 10px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-surface);
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .area.on {
    border-color: var(--sc-primary);
    background: color-mix(in srgb, var(--sc-primary) 12%, transparent);
  }
  .check {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid var(--sc-border);
    display: grid;
    place-content: center;
    font-size: 13px;
    font-weight: 800;
    color: #fff;
  }
  .check.on {
    background: var(--sc-primary);
    border-color: var(--sc-primary);
  }
  .text {
    display: flex;
    flex-direction: column;
  }
  .label {
    font-size: 15px;
    font-weight: 600;
  }
  .hint {
    font-size: 12px;
    color: var(--sc-text-dim);
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--sc-space-3);
  }
  .clear {
    background: none;
    border: none;
    color: var(--sc-text-dim);
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;
  }
  .clear:disabled {
    opacity: 0.5;
    cursor: default;
    text-decoration: none;
  }
  .note {
    font-size: 12px;
    color: var(--sc-text-dim);
  }
</style>
