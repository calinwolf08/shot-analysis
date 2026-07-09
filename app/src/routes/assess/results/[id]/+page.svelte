<script lang="ts">
  import { page } from "$app/state";
  import { AssessmentResults } from "$lib/features/assessment/components/results";
</script>

<AssessmentResults sessionId={page.params.id!} />
