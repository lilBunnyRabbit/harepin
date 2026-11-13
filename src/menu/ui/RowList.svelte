<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    divided?: boolean;
    label?: string;
    nav?: boolean;
    children: Snippet;
  }

  let { divided = false, label, nav = false, children }: Props = $props();
</script>

<svelte:element this={nav ? "nav" : "div"} class="ui-rows" class:ui-divided={divided} aria-label={label}>
  {@render children()}
</svelte:element>

<style>
  .ui-rows {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .ui-divided {
    gap: 0;
  }

  .ui-divided > :global(* + *) {
    border-top: 1px solid var(--set-line);
  }

  .ui-divided > :global(*) {
    border-radius: 0;
  }
</style>
