<script lang="ts">
  import { builtInBenchmarks } from "$lib/features/benchmarks";
  import { Button, Card, ProgressBar } from "$lib/shared/ui";
  import type { PlanFocusArea } from "../generator";
  import type { PlanItem } from "../repo/plan-repo";

  let {
    focus,
    items,
    drillTitles,
    onopen,
    onback,
  }: {
    focus: PlanFocusArea[];
    items: PlanItem[];
    /** drillId → title for drill item labels. */
    drillTitles: Record<string, string>;
    onopen: (item: PlanItem) => void;
    onback: () => void;
  } = $props();

  const metricNames = builtInBenchmarks()[0]!.targets;

  const doneCount = $derived(
    items.filter((i) => i.status !== "pending").length,
  );
  const sessionCount = $derived(new Set(items.map((i) => i.dayIndex)).size);

  const days = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- scratch grouping map inside the derivation, not state
    const byDay = new Map<number, PlanItem[]>();
    for (const item of items) {
      const list = byDay.get(item.dayIndex) ?? [];
      list.push(item);
      byDay.set(item.dayIndex, list);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayIndex, dayItems]) => ({
        dayIndex,
        items: dayItems.sort((a, b) => a.position - b.position),
      }));
  });

  /** First day with a pending item is "today"; later days stay locked. */
  const todayDay = $derived(
    days.find((d) => d.items.some((i) => i.status === "pending"))?.dayIndex ??
      null,
  );

  function dayState(dayIndex: number): "done" | "today" | "locked" {
    if (todayDay === null || dayIndex < todayDay) return "done";
    if (dayIndex === todayDay) return "today";
    return "locked";
  }

  function itemLabel(item: PlanItem): string {
    switch (item.type) {
      case "drill":
        return (item.drillId && drillTitles[item.drillId]) || "Drill";
      case "reassessment":
        return "Re-assessment";
      case "live_practice":
        return item.focusMetric
          ? `Live practice — ${metricNames[item.focusMetric as keyof typeof metricNames]?.displayName ?? item.focusMetric}`
          : "Free shooting";
    }
  }
</script>

<main class="plan" data-testid="plan-overview">
  <header>
    <Button variant="ghost" testid="plan-back" onclick={onback}>← Back</Button>
    <h1>Training plan</h1>
  </header>

  <section class="summary">
    <div class="chips" data-testid="plan-focus-chips">
      {#each focus as area (area.issueGroup)}
        <span class="chip">{area.displayName}</span>
      {/each}
    </div>
    <p class="meta">2-week block, {sessionCount} sessions</p>
    <ProgressBar
      value={items.length > 0 ? doneCount / items.length : 0}
      testid="plan-progress"
      label="{doneCount} of {items.length} done"
    />
  </section>

  <section class="days">
    {#each days as day (day.dayIndex)}
      {@const state = dayState(day.dayIndex)}
      <Card testid="plan-day-{day.dayIndex}">
        <div class="day" data-state={state}>
          <div class="day-head">
            <h2>Day {day.dayIndex + 1}</h2>
            <span class="state-tag {state}">
              {state === "done"
                ? "Done"
                : state === "today"
                  ? "Today"
                  : "Locked"}
            </span>
          </div>
          <ul>
            {#each day.items as item (item.id)}
              <li>
                <span
                  class="item-label"
                  class:completed={item.status !== "pending"}
                >
                  {itemLabel(item)}
                  {#if item.targetReps}
                    <small>{item.targetReps} reps</small>
                  {/if}
                </span>
                {#if item.status !== "pending"}
                  <span class="done-mark" aria-label="completed">✓</span>
                {:else}
                  <Button
                    size="sm"
                    variant={state === "today" ? "primary" : "secondary"}
                    disabled={state === "locked"}
                    testid="plan-item-{item.id}"
                    onclick={() => onopen(item)}
                  >
                    {item.type === "reassessment" ? "Re-assess" : "Start"}
                  </Button>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      </Card>
    {/each}
  </section>
</main>

<style>
  .plan {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
    padding-bottom: var(--sc-space-5);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    flex: 1;
  }
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-space-2);
  }
  .chip {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-primary);
    color: var(--sc-primary);
    font-size: 12px;
    font-weight: 600;
  }
  .meta {
    margin: 0;
    color: var(--sc-text-dim);
    font-size: 13px;
  }
  .days {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  .day[data-state="locked"] {
    opacity: 0.55;
  }
  .day-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sc-space-2);
  }
  h2 {
    margin: 0;
    font-size: 15px;
  }
  .state-tag {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sc-text-dim);
  }
  .state-tag.today {
    color: var(--sc-primary);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-space-3);
  }
  .item-label {
    display: flex;
    flex-direction: column;
    font-size: 14px;
  }
  .item-label.completed {
    color: var(--sc-text-dim);
    text-decoration: line-through;
  }
  .item-label small {
    color: var(--sc-text-dim);
  }
  .done-mark {
    color: var(--sc-success);
    font-weight: 700;
  }
</style>
