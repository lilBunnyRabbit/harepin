<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";

  interface Props extends HTMLButtonAttributes {
    icon: string;
    label: string;
    shape?: "square" | "round";
    size?: "sm" | "md";
    flip?: boolean;
  }

  let { icon, label, shape = "square", size = "md", flip = false, type = "button", class: extra, ...rest }: Props = $props();
</script>

<button {type} class={["ui-icon-button", extra]} data-shape={shape} data-size={size} aria-label={label} {...rest}>
  <Icon name={icon} {flip} />
</button>

<style>
  .ui-icon-button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--control-h);
    height: var(--control-h);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--foreground);
    cursor: pointer;
  }

  .ui-icon-button:hover:not(:disabled) {
    background: var(--set-well);
  }

  .ui-icon-button:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-icon-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  [data-shape="round"] {
    border-color: var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-raised);
  }

  [data-size="sm"] {
    width: var(--control-h-sm);
    height: var(--control-h-sm);
  }
</style>
