<script lang="ts">
  import { page } from "$app/state";
  import { SummaryScreen } from "$lib/features/live-practice";
</script>

<SummaryScreen sessionId={page.params.id!} />
