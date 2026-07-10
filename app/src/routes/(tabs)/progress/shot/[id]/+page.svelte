<script lang="ts">
  import { page } from "$app/state";
  import { ShotDetailScreen } from "$lib/features/progress";
</script>

<ShotDetailScreen shotId={page.params.id!} />
