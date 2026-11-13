<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    format?: (value: number) => string;
    disabled?: boolean;
    onchange?: (value: number) => void;
  }

  let { value = $bindable(), min, max, step = 1, label, format = String, disabled = false, onchange }: Props = $props();

  const fill = $derived(`${((value - min) / (max - min)) * 100}%`);
</script>

<div class="ui-slider">
  <input type="range" class="ui-range" {min} {max} {step} {disabled} aria-label={label} style:--fill={fill} bind:value oninput={() => onchange?.(value)} />
  <output class="ui-value">{format(value)}</output>
</div>

<style>
  .ui-slider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .ui-range {
    --thumb: 18px;
    flex: 1;
    min-width: 0;
    height: 6px;
    margin: 0;
    appearance: none;
    border-radius: var(--radius-full);
    background: linear-gradient(to right, var(--primary) var(--fill), var(--set-well) var(--fill));
    cursor: pointer;
  }

  .ui-range::-webkit-slider-thumb {
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    border: 2px solid var(--primary);
    background: var(--set-raised);
  }

  .ui-range::-moz-range-thumb {
    box-sizing: border-box;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    border: 2px solid var(--primary);
    background: var(--set-raised);
  }

  .ui-range:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 4px;
  }

  .ui-range:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .ui-value {
    min-width: 4ch;
    font-family: var(--font-mono);
    font-size: var(--text-md);
    font-weight: 700;
    text-align: right;
  }

  @media (pointer: coarse) {
    .ui-range {
      --thumb: 24px;
    }
  }
</style>
