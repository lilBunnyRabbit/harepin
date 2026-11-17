<script lang="ts" generics="T extends string">
  import Glyph from "./Glyph.svelte";
  import type { GlyphKeys, Tab } from "./types";

  interface Props {
    items: readonly Tab<T>[];
    value: T;
    label: string;
    prev?: GlyphKeys;
    next?: GlyphKeys;
    onchange?: (id: T) => void;
  }

  let { items, value, label, prev = { key: "Q", pad: "LB" }, next = { key: "E", pad: "RB" }, onchange }: Props = $props();
</script>

<nav class="ui-stations" aria-label={label}>
  <Glyph {...prev} />
  {#each items as item (item.id)}
    <button type="button" class="ui-station" aria-current={item.id === value ? "page" : undefined} onclick={() => onchange?.(item.id)}>{item.label}</button>
  {/each}
  <Glyph {...next} />
</nav>

<style>
  .ui-stations {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    min-width: 0;
    font-size: var(--type-h3);
  }

  .ui-stations :global(.ui-cap) {
    margin: 0 var(--gap-xs);
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .ui-station {
    position: relative;
    height: var(--top-h);
    padding: 0 var(--gap-md);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--dim);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  :root .ui-station:hover {
    color: var(--foreground);
  }

  :root .ui-station[aria-current] {
    color: var(--foreground);
    font-weight: 800;
  }

  .ui-station[aria-current]::after {
    content: "";
    position: absolute;
    right: var(--gap-md);
    bottom: var(--gap-xs);
    left: var(--gap-md);
    height: var(--mark-w);
    border-radius: var(--space-0);
    background: var(--foreground);
  }

  :root .ui-station:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
  }
</style>
