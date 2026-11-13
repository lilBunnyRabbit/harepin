<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    href?: string;
    external?: boolean;
    chevron?: boolean;
    title?: string;
    onclick?: () => void;
    children: Snippet;
  }

  let { href, external = false, chevron = false, title, onclick, children }: Props = $props();
</script>

{#snippet body()}
  {@render children()}
  {#if external}<Icon name="icon-external" />{:else if chevron}<Icon name="icon-back" flip />{/if}
{/snippet}

{#if href}
  <a class="ui-link" {href} {title} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined} {onclick}>{@render body()}</a>
{:else}
  <button type="button" class="ui-link" {title} {onclick}>{@render body()}</button>
{/if}

<style>
  .ui-link {
    --icon-size: 1.1em;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: auto;
    padding: 0;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .ui-link:hover {
    background: none;
    color: var(--foreground);
  }

  .ui-link:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
    border-radius: var(--radius-xs);
  }
</style>
