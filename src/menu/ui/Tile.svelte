<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    meta?: string;
    thumb?: string;
    icon?: string;
    size?: "sm" | "md";
    /** `nav`: a side-nav item, flat until picked; on phones and short screens it stacks into a rail icon over its title. */
    variant?: "card" | "nav";
    /** Lines the meta shows before it ends in an ellipsis; unset, it wraps freely. */
    clamp?: number;
    /** Unset on a plain action tile, so it carries no aria-pressed. */
    selected?: boolean;
    /** A place link marking where the player is now: aria-current, drawn like a pick. */
    current?: boolean;
    disabled?: boolean;
    /** Why a disabled tile is off: it stays at full contrast while the rest of the tile dims. */
    reason?: Snippet;
    tooltip?: string;
    onclick?: () => void;
    children?: Snippet;
  }

  let { title, meta, thumb, icon, size = "md", variant = "card", clamp, selected, current = false, disabled = false, reason, tooltip, onclick, children }: Props = $props();
</script>

<button type="button" class="ui-tile" data-size={size} data-variant={variant} aria-pressed={selected} aria-current={current || undefined} title={tooltip} {disabled} {onclick}>
  {#if thumb}<img class="ui-thumb" src={thumb} alt="" loading="lazy" />{:else if icon}<span class="ui-thumb ui-icon"><Icon name={icon} /></span>{/if}
  <span class="ui-text">
    <span class="ui-title">{title}</span>
    {#if meta}<small class="ui-meta" class:ui-clamp={clamp !== undefined} style:--clamp={clamp}>{meta}</small>{/if}
    {#if reason}
      <span class="ui-foot">{@render children?.()}<small class="ui-reason">{@render reason()}</small></span>
    {:else}
      {@render children?.()}
    {/if}
  </span>
</button>

<style>
  .ui-tile {
    --tile-h: 80px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-3);
    min-width: 0;
    min-height: var(--tile-h);
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

  .ui-tile:is([aria-pressed="true"], [aria-current="true"]) {
    border-color: var(--primary);
  }

  .ui-tile:focus-visible {
    outline: 2px solid var(--primary);
    /* Inset: a scrolling list (the car pick) clips anything drawn outside the tile. */
    outline-offset: -1px;
  }

  .ui-tile:disabled {
    cursor: default;
  }

  /* :global so the dim reaches content the caller passes in, which carries the caller's scope class. */
  .ui-tile:disabled > :not(.ui-text),
  .ui-tile:disabled .ui-text > :global(:not(.ui-foot)),
  .ui-tile:disabled .ui-foot > :global(:not(.ui-reason)) {
    opacity: 0.45;
  }

  .ui-reason {
    --icon-size: var(--text-md);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--foreground);
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1.4;
  }

  .ui-foot {
    display: flex;
    margin-top: var(--space-1);
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    min-width: 0;
  }

  .ui-thumb {
    flex: none;
    height: calc(var(--tile-h) - 2 * var(--space-2) - 2px);
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
    white-space: normal;
  }

  .ui-clamp {
    display: -webkit-box;
    overflow: hidden;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--clamp);
    line-clamp: var(--clamp);
  }

  [data-variant="nav"] {
    flex: none;
    border-color: transparent;
    background: none;
  }

  [data-variant="nav"]:hover:not(:disabled) {
    border-color: transparent;
    background: color-mix(in oklch, var(--set-raised) 50%, transparent);
  }

  [data-variant="nav"][aria-pressed="true"] {
    border-color: var(--set-line);
    background: var(--set-raised);
  }

  [data-variant="nav"] .ui-icon {
    background: none;
    color: var(--set-dim);
  }

  [data-variant="nav"][aria-pressed="true"] .ui-icon {
    color: var(--primary);
  }

  [data-variant="nav"] .ui-meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-height: 500px), (max-width: 600px) {
    [data-variant="nav"] {
      flex-direction: column;
      justify-content: center;
      gap: var(--space-1);
      height: auto;
      padding: var(--space-2) var(--space-1);
    }

    [data-variant="nav"] .ui-thumb {
      height: auto;
      aspect-ratio: auto;
    }

    [data-variant="nav"] .ui-text {
      justify-items: center;
      width: 100%;
    }

    [data-variant="nav"] .ui-title {
      max-width: 100%;
      font-size: var(--text-xs);
    }

    [data-variant="nav"] .ui-meta {
      display: none;
    }
  }
</style>
