<script lang="ts">
  import { page } from "$app/state";
  import { ShotReviewScreen } from "$lib/features/live-practice";
</script>

<ShotReviewScreen shotId={page.params.id!} />
