<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../menu/ui/Button.svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const uid = $props.id();
  let open = $state(false);
</script>

<div class="lab-more">
  <Button variant="secondary" size="sm" aria-expanded={open} aria-controls={uid} onclick={() => (open = !open)}>{open ? "Less" : "More"}</Button>
  {#if open}<div class="lab-more-body" id={uid}>{@render children()}</div>{/if}
</div>

<style>
  .lab-more {
    display: grid;
    justify-items: start;
    gap: var(--space-4);
    min-width: 0;
  }

  .lab-more-body {
    justify-self: stretch;
    min-width: 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--set-line);
  }
</style>
