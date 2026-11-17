<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    variant?: "status" | "toggle";
    inner?: boolean;
    icon?: string;
    pressed?: boolean;
    tone?: "live" | "idle" | "error";
    focused?: boolean;
    title?: string;
    onclick?: () => void;
    children: Snippet;
  }

  let { variant = "status", inner = false, icon, pressed = $bindable(false), tone, focused = false, title, onclick, children }: Props = $props();

  function flip() {
    pressed = !pressed;
    onclick?.();
  }
</script>

{#snippet body()}
  {#if tone}<span class="ui-dot" data-tone={tone}></span>{/if}
  {#if icon}<Icon name={icon} />{/if}
  {@render children()}
{/snippet}

{#if variant === "toggle"}
  <button type="button" class="ui-chip" class:ui-inner={inner} data-focused={focused ? "" : undefined} aria-pressed={pressed} {title} onclick={flip}>{@render body()}</button>
{:else if onclick}
  <button type="button" class="ui-chip" class:ui-inner={inner} data-focused={focused ? "" : undefined} {title} {onclick}>{@render body()}</button>
{:else}
  <span class="ui-chip" class:ui-inner={inner} data-focused={focused ? "" : undefined} {title}>{@render body()}</span>
{/if}

<style>
  .ui-chip {
    --icon-size: 1.15em;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.45em;
    min-width: 0;
    height: var(--chip-h);
    padding: 0 var(--gap-md);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--foreground);
    font: inherit;
    font-size: var(--type-small);
    font-weight: 700;
    white-space: nowrap;
  }

  .ui-inner {
    height: var(--chip-h-in);
    padding: 0 var(--gap-sm);
    border-color: var(--line);
    background: var(--fill);
  }

  button.ui-chip {
    cursor: pointer;
  }

  button.ui-chip:hover {
    border-color: var(--dim);
  }

  button.ui-chip[aria-pressed="false"] {
    color: var(--dim);
  }

  button.ui-chip[aria-pressed="true"] {
    border-color: var(--primary);
  }

  .ui-chip[data-focused] {
    background: var(--row-on);
  }

  [data-focused],
  button.ui-chip:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  .ui-dot {
    flex: none;
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: var(--dim);
  }

  [data-tone="live"] {
    background: var(--success);
  }

  [data-tone="error"] {
    background: var(--error);
  }
</style>
