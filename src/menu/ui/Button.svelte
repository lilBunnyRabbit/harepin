<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";

  interface Props extends HTMLButtonAttributes {
    variant?: "primary" | "secondary" | "quiet" | "danger";
    size?: "sm" | "md" | "lg";
    icon?: string;
    children: Snippet;
  }

  let { variant = "secondary", size = "md", icon, type = "button", class: extra, children, ...rest }: Props = $props();
</script>

<button {type} class={["ui-button", extra]} data-variant={variant} data-size={size} {...rest}>
  {#if icon}<Icon name={icon} />{/if}
  {@render children()}
</button>

<style>
  .ui-button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: var(--control-h);
    padding: 0 var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-raised);
    color: var(--foreground);
    font: inherit;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
  }

  .ui-button:hover:not(:disabled) {
    border-color: var(--line-strong);
  }

  .ui-button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  [data-size="sm"] {
    height: var(--control-h-sm);
    padding: 0 var(--space-3);
    font-size: var(--text-md);
  }

  [data-size="lg"] {
    height: var(--control-h-lg);
    padding: 0 var(--space-6);
    border-radius: var(--radius-md);
  }

  [data-variant="primary"] {
    border-color: transparent;
    background: var(--primary);
    color: var(--on-primary);
  }

  [data-variant="primary"]:hover:not(:disabled) {
    border-color: transparent;
    filter: brightness(1.08);
  }

  [data-variant="quiet"] {
    border-color: transparent;
    background: none;
    color: var(--set-dim);
  }

  [data-variant="quiet"]:hover:not(:disabled) {
    border-color: transparent;
    color: var(--foreground);
  }

  [data-variant="danger"] {
    border-color: var(--error);
    color: var(--error);
  }

  [data-variant="danger"]:hover:not(:disabled) {
    border-color: var(--error);
    background: color-mix(in oklch, var(--error) 16%, transparent);
  }
</style>
