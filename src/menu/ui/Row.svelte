<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    help?: string;
    icon?: string;
    href?: string;
    external?: boolean;
    onclick?: () => void;
    control?: Snippet;
    detail?: Snippet;
    badge?: Snippet;
    fill?: boolean;
    focused?: boolean;
    /** Phones put the control under the label, at full width. */
    stack?: boolean;
    /** The lead icon and the control sit on the label's line instead of the row's middle, for rows whose text runs to several lines. */
    top?: boolean;
  }

  let { label, help, icon, href, external = false, onclick, control, detail, badge, fill = false, focused = false, stack = false, top = false }: Props = $props();
</script>

{#snippet text()}
  {#if icon}<span class="ui-lead"><Icon name={icon} /></span>{/if}
  <span class="ui-text">
    <span class="ui-label">{label}{#if badge}<span class="ui-badge">{@render badge()}</span>{/if}</span>
    {#if help}<small class="ui-help">{help}</small>{/if}
    {#if detail}<span class="ui-help">{@render detail()}</span>{/if}
  </span>
  {#if control}<span class="ui-control">{@render control()}</span>{/if}
{/snippet}

{#if href}
  <a class="ui-row ui-action" class:ui-fill={fill} data-focused={focused ? "" : undefined} {href} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined}>
    {@render text()}
    {#if !control}<span class="ui-end"><Icon name={external ? "icon-external" : "icon-back"} flip={!external} /></span>{/if}
  </a>
{:else if onclick}
  <button type="button" class="ui-row ui-action" class:ui-fill={fill} data-focused={focused ? "" : undefined} {onclick}>
    {@render text()}
    {#if !control}<span class="ui-end"><Icon name="icon-back" flip /></span>{/if}
  </button>
{:else}
  <div class="ui-row" class:ui-fill={fill} class:ui-stack={stack} class:ui-top={top} data-focused={focused ? "" : undefined}>
    {@render text()}
  </div>
{/if}

<style>
  .ui-row {
    --icon-size: 1.15em;
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    width: 100%;
    min-width: 0;
    min-height: var(--row-h);
    height: auto;
    padding: var(--gap-sm) var(--gap-md);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--foreground);
    font: inherit;
    font-size: var(--type-body);
    text-align: left;
    text-decoration: none;
    white-space: normal;
  }

  .ui-fill {
    background: var(--row);
  }

  .ui-top {
    align-items: flex-start;
  }

  .ui-top > :is(.ui-lead, .ui-control) {
    height: calc(var(--type-body) * 1.35);
  }

  .ui-action {
    cursor: pointer;
  }

  .ui-action:hover,
  [data-focused] {
    background: var(--row-on);
  }

  .ui-action:hover .ui-end {
    color: var(--foreground);
  }

  [data-focused],
  .ui-row:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
  }

  .ui-lead,
  .ui-end {
    display: flex;
    flex: none;
    color: var(--dim);
  }

  .ui-text {
    display: grid;
    flex: 1;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .ui-label {
    font-weight: 700;
    line-height: 1.35;
  }

  .ui-badge {
    display: inline-flex;
    align-items: center;
    margin-left: var(--gap-sm);
    vertical-align: middle;
  }

  .ui-help {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 500;
    line-height: 1.35;
    text-wrap: pretty;
  }

  .ui-control {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--gap-sm);
  }

  @media (max-width: 600px) {
    .ui-stack {
      flex-wrap: wrap;
      row-gap: var(--gap-md);
    }

    .ui-stack .ui-control {
      flex: 1 0 100%;
    }

    .ui-stack .ui-control > :global(*) {
      flex: 1;
    }
  }
</style>
