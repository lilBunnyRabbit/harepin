<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    variant?: "status" | "toggle";
    icon?: string;
    pressed?: boolean;
    tone?: "live" | "idle" | "error";
    title?: string;
    onclick?: () => void;
    children: Snippet;
  }

  let { variant = "status", icon, pressed = $bindable(false), tone = "idle", title, onclick, children }: Props = $props();

  function flip() {
    pressed = !pressed;
    onclick?.();
  }
</script>

{#if variant === "toggle"}
  <button type="button" class="ui-chip" aria-pressed={pressed} {title} onclick={flip}>
    {#if icon}<Icon name={icon} />{/if}
    {@render children()}
  </button>
{:else}
  <span class="ui-chip" {title}>
    <span class="ui-dot" data-tone={tone}></span>
    {@render children()}
  </span>
{/if}

<style>
  .ui-chip {
    --icon-size: var(--text-lg);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    height: var(--control-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-panel);
    color: var(--foreground);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 600;
    white-space: nowrap;
  }

  button.ui-chip {
    cursor: pointer;
  }

  button.ui-chip:hover {
    border-color: var(--line-strong);
  }

  button.ui-chip[aria-pressed="true"] {
    border-color: var(--primary);
    background: var(--set-raised);
  }

  button.ui-chip:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-dot {
    flex: none;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--set-dim);
  }

  [data-tone="live"] {
    background: var(--success);
  }

  [data-tone="error"] {
    background: var(--error);
  }
</style>
