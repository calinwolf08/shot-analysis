<script lang="ts">
  import { page } from "$app/state";
  import { SessionDetailScreen } from "$lib/features/progress";
</script>

<SessionDetailScreen sessionId={page.params.id!} />
