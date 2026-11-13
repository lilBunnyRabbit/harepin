<script lang="ts">
  interface Props {
    keys: readonly string[];
  }

  let { keys }: Props = $props();
</script>

<span class="ui-keys">
  {#each keys as key, index (index)}<kbd class="ui-key">{key}</kbd>{/each}
</span>

<style>
  .ui-keys {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .ui-key {
    padding: var(--space-0) var(--space-1);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-xs);
    background: var(--set-raised);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.4;
    white-space: nowrap;
  }
</style>
