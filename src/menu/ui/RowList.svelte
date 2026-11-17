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
    gap: var(--gap-xs);
    min-width: 0;
  }

  .ui-divided {
    gap: 0;
  }

  .ui-divided > :global(* + *) {
    border-top: 1px solid var(--line);
  }

  /* A settings list: taller rows parted by a line; the row under the cursor keeps its corners. */
  .ui-divided > :global(*) {
    min-height: var(--top-h);
    padding: var(--gap-md);
  }

  .ui-divided > :global(:not([data-focused])) {
    border-radius: 0;
  }
</style>
