<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    lede: string;
    visual_on_short?: boolean;
    copy: Snippet;
    visual?: Snippet;
  }

  let { title, lede, visual_on_short = true, copy, visual }: Props = $props();
</script>

<div class="guide-layout" class:guide-split={!!visual} class:guide-drop={!visual_on_short}>
  <div class="guide-copy">
    <header class="guide-head">
      <h2 class="guide-title">{title}</h2>
      <p class="guide-lede">{lede}</p>
    </header>
    {@render copy()}
  </div>
  {#if visual}<div class="guide-visual">{@render visual()}</div>{/if}
</div>

<style>
  .guide-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: var(--space-6) var(--space-8);
    min-height: 100%;
  }

  .guide-split {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }

  .guide-copy,
  .guide-visual {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .guide-visual {
    gap: var(--space-3);
  }

  .guide-head {
    display: grid;
    gap: var(--space-3);
  }

  .guide-title {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 700;
    line-height: 1.1;
    text-wrap: balance;
  }

  .guide-lede {
    margin: 0;
    max-width: 52ch;
    color: var(--set-dim);
    font-size: var(--text-lg);
    line-height: 1.45;
    text-wrap: pretty;
  }

  @media (max-width: 600px) {
    .guide-split {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-height: 500px) {
    .guide-layout {
      gap: var(--space-4) var(--space-6);
    }

    .guide-copy {
      gap: var(--space-4);
    }

    .guide-head {
      gap: var(--space-2);
    }

    .guide-title {
      font-size: var(--text-2xl);
    }

    .guide-lede {
      font-size: var(--text-md);
    }

    .guide-drop {
      grid-template-columns: minmax(0, 1fr);
    }

    .guide-drop .guide-visual {
      display: none;
    }
  }
</style>
