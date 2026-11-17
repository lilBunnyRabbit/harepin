<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    eyebrow?: string;
    title?: string;
    count?: number | string;
    level?: 2 | 3 | 4;
    role?: "card" | "page";
    action?: Snippet;
  }

  let { eyebrow, title, count, level = 3, role = "card", action }: Props = $props();
</script>

<header class="ui-head">
  <div class="ui-text">
    {#if eyebrow}<span class="ui-eyebrow" class:ui-over={title}>{eyebrow}</span>{/if}
    {#if title}
      <svelte:element this={`h${level}`} class="ui-title" data-role={role}>
        {title}
        {#if count !== undefined}<span class="ui-count">{count}</span>{/if}
      </svelte:element>
    {/if}
  </div>
  {#if action}<div class="ui-action">{@render action()}</div>{/if}
</header>

<style>
  .ui-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--gap-md);
    min-width: 0;
  }

  .ui-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .ui-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .ui-title {
    margin: 0;
    font-size: var(--type-h2);
    font-weight: 800;
    line-height: 1.15;
    text-wrap: balance;
  }

  [data-role="page"] {
    font-size: var(--type-h1);
    line-height: 1.1;
  }

  .ui-count {
    margin-left: var(--gap-xs);
    color: var(--dim);
    font-weight: 600;
  }

  .ui-action {
    flex: none;
  }
</style>
