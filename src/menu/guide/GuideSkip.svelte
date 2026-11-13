<script lang="ts">
  import Button from "../ui/Button.svelte";

  interface Props {
    onskip: () => void;
  }

  let { onskip }: Props = $props();
</script>

<Button variant="quiet" onclick={onskip}>Skip guide</Button>
