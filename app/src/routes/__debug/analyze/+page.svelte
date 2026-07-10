<script lang="ts">
  import { useAppServices } from "$lib/shared/config/services-context";

  // Test-build-only debug surface: dead-code-eliminated from production
  // builds (VITE_E2E unset) — verified by the step-24 build-output check.
  const enabled = import.meta.env.VITE_E2E === "1";

  const services = useAppServices();
  let result = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function run() {
    result = null;
    error = null;
    try {
      const analysis = await services.analysis.analyzeVideoFile(
        { kind: "fixture", fixtureId: "20190103_180930" },
        { shootingHand: "right", profile: "pro-form" },
      );
      result = `shots: ${analysis.shots.length}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

{#if enabled}
  <main style="padding: 24px">
    <h1>Debug: replay analysis</h1>
    <button data-testid="debug-analyze-run" onclick={run}>
      Run replay analysis
    </button>
    {#if result}
      <p data-testid="debug-analyze-result">{result}</p>
    {/if}
    {#if error}
      <p data-testid="debug-analyze-error">{error}</p>
    {/if}
  </main>
{:else}
  <p>Not available.</p>
{/if}
