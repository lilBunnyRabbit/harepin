<script lang="ts">
  import type { Snippet } from "svelte";
  import Glyph from "./Glyph.svelte";
  import type { GlyphKeys } from "./types";

  interface Props {
    keys?: GlyphKeys;
    onclick: () => void;
    children: Snippet;
  }

  let { keys, onclick, children }: Props = $props();
</script>

<button type="button" class="ui-key-link" data-nav {onclick}>
  {#if keys}<Glyph {...keys} />{/if}
  {@render children()}
</button>

<style>
  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .ui-key-link {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--gap-sm);
    height: var(--top-h);
    padding: 0;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--foreground);
    font: inherit;
    font-size: var(--type-body);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  :root .ui-key-link:hover {
    color: var(--cottontail);
  }

  :root .ui-key-link:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  @media (max-height: 500px) {
    :root .ui-key-link {
      padding: 0 var(--pad);
      border: 1px solid var(--line-strong);
      background: var(--surface);
    }
  }
</style>
