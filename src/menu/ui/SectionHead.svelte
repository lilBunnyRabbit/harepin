<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    eyebrow?: string;
    title?: string;
    count?: number | string;
    level?: 2 | 3 | 4;
    action?: Snippet;
  }

  let { eyebrow, title, count, level = 3, action }: Props = $props();
</script>

<header class="ui-head">
  <div class="ui-text">
    {#if eyebrow}<span class="ui-eyebrow">{eyebrow}</span>{/if}
    {#if title}
      <svelte:element this={`h${level}`} class="ui-title">
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
    gap: var(--space-3);
    min-width: 0;
  }

  .ui-text {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .ui-eyebrow {
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .ui-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
  }

  .ui-count {
    margin-left: var(--space-1);
    color: var(--set-dim);
    font-weight: 600;
  }

  .ui-action {
    flex: none;
  }

  @media (max-height: 500px) {
    .ui-eyebrow {
      display: none;
    }
  }
</style>
