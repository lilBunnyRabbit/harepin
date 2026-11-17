<script lang="ts">
  import "./key-cap.css";

  interface Props {
    keys: readonly string[];
  }

  let { keys }: Props = $props();
</script>

<span class="ui-keys">
  {#each keys as key, index (index)}<kbd class="ui-cap ui-key">{key}</kbd>{/each}
</span>

<style>
  .ui-keys {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--gap-xs);
  }
</style>
