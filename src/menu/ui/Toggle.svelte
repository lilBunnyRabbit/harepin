<script lang="ts">
  interface Props {
    checked: boolean;
    label: string;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(), label, disabled = false, onchange }: Props = $props();

  function flip() {
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button type="button" class="ui-toggle" role="switch" aria-checked={checked} aria-label={label} {disabled} onclick={flip}>
  <span class="ui-knob"></span>
</button>

<style>
  .ui-toggle {
    --w: 40px;
    --h: 24px;
    position: relative;
    flex: none;
    width: var(--w);
    height: var(--h);
    padding: 0;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-well);
    cursor: pointer;
  }

  .ui-toggle::after {
    content: "";
    position: absolute;
    inset: calc((var(--h) - max(var(--h), var(--control-h))) / 2);
  }

  .ui-knob {
    position: absolute;
    top: var(--space-0);
    left: var(--space-0);
    width: calc(var(--h) - 6px);
    height: calc(var(--h) - 6px);
    border-radius: 50%;
    background: var(--set-dim);
    transition:
      translate 140ms ease-out,
      background-color 140ms ease-out;
  }

  .ui-toggle[aria-checked="true"] {
    border-color: color-mix(in oklch, var(--primary) 45%, transparent);
  }

  .ui-toggle[aria-checked="true"] .ui-knob {
    translate: calc(var(--w) - var(--h)) 0;
    background: var(--primary);
  }

  .ui-toggle:hover:not(:disabled) {
    background: var(--set-well);
  }

  .ui-toggle:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-toggle:disabled {
    opacity: 0.45;
    cursor: default;
  }

  @media (pointer: coarse) {
    .ui-toggle {
      --w: 48px;
      --h: 28px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-knob {
      transition: none;
    }
  }
</style>
