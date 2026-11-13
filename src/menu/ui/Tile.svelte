<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    meta?: string;
    thumb?: string;
    icon?: string;
    size?: "sm" | "md";
    selected?: boolean;
    disabled?: boolean;
    onclick?: () => void;
    children?: Snippet;
  }

  let { title, meta, thumb, icon, size = "md", selected = false, disabled = false, onclick, children }: Props = $props();
</script>

<button type="button" class="ui-tile" data-size={size} aria-pressed={selected} {disabled} {onclick}>
  {#if thumb}<img class="ui-thumb" src={thumb} alt="" loading="lazy" />{:else if icon}<span class="ui-thumb ui-icon"><Icon name={icon} /></span>{/if}
  <span class="ui-text">
    <span class="ui-title">{title}</span>
    {#if meta}<small class="ui-meta">{meta}</small>{/if}
    {@render children?.()}
  </span>
</button>

<style>
  .ui-tile {
    --tile-h: 80px;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    height: var(--tile-h);
    padding: var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-md);
    background: var(--set-raised);
    color: var(--foreground);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  [data-size="sm"] {
    --tile-h: 64px;
  }

  .ui-tile:hover:not(:disabled) {
    border-color: var(--line-strong);
  }

  .ui-tile[aria-pressed="true"] {
    border-color: var(--primary);
  }

  .ui-tile:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-tile:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .ui-thumb {
    flex: none;
    height: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    object-fit: cover;
    background: var(--set-well);
  }

  .ui-icon {
    display: grid;
    place-items: center;
    color: var(--primary);
  }

  .ui-text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
  }

  .ui-title {
    overflow: hidden;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ui-meta {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
  }
</style>
