<script lang="ts">
  import Segmented from "../menu/ui/Segmented.svelte";
  import type { Option } from "../menu/ui/types";
  import { SCALE_MAX, SCALE_MIN } from "./answers";

  interface Props {
    label: string;
    low: string;
    high: string;
    value: number | null;
    onchange: (value: number) => void;
  }

  let { label, low, high, value, onchange }: Props = $props();

  const OPTIONS: Option<number>[] = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => ({ value: SCALE_MIN + i, label: String(SCALE_MIN + i) }));
</script>

<div class="lab-scale">
  <span class="lab-scale-label">{label}</span>
  <Segmented options={OPTIONS} {value} {label} {onchange} />
  <span class="lab-scale-ends"><span>{low}</span><span>{high}</span></span>
</div>

<style>
  .lab-scale {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .lab-scale-label {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  /* A thumb or a pad sets each step exactly: five big buttons, never a slider. */
  .lab-scale :global(.ui-segmented) {
    height: var(--control-h-lg);
  }

  .lab-scale :global(.ui-segment) {
    font-size: var(--text-lg);
  }

  .lab-scale-ends {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .lab-scale-ends span:last-child {
    text-align: end;
  }
</style>
