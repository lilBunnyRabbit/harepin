<script module lang="ts">
  export interface LegendItem {
    label: string;
    swatch: string;
    /** Drawn as a diamond, like the event icons on the map. */
    diamond?: boolean;
  }
</script>

<script lang="ts">
  interface Props {
    items: readonly LegendItem[];
    stack?: boolean;
  }

  let { items, stack = false }: Props = $props();
</script>

<ul class="legend" class:stack>
  {#each items as item (item.label)}
    <li class:diamond={item.diamond} style:--swatch={item.swatch}>{item.label}</li>
  {/each}
</ul>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .stack {
    flex-direction: column;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  li::before {
    content: "";
    width: 0.8em;
    height: 0.8em;
    border-radius: var(--radius-full);
    background: var(--swatch);
  }

  .diamond::before {
    border-radius: 0;
    rotate: 45deg;
    scale: 0.85;
  }
</style>
