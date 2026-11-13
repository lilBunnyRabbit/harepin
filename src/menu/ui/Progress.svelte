<script lang="ts">
  interface Props {
    value: number;
    max: number;
    label: string;
    marks?: readonly number[];
    size?: "bar" | "hero";
    /** A value being tried: the fill stops at the lower of the two and a dashed segment shows the gain or loss. */
    ghost?: number;
  }

  let { value, max, label, marks = [], size = "bar", ghost }: Props = $props();

  const share = (at: number) => `${(Math.min(Math.max(at, 0), max) / max) * 100}%`;
</script>

<div class="ui-progress" data-size={size} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
  <span class="ui-fill" style:width={share(ghost === undefined ? value : Math.min(value, ghost))}></span>
  {#if ghost !== undefined && ghost !== value}
    <span
      class="ui-ghost"
      data-trend={ghost > value ? "up" : "down"}
      style:left={share(Math.min(value, ghost))}
      style:width={`calc(${share(Math.max(value, ghost))} - ${share(Math.min(value, ghost))})`}
    ></span>
  {/if}
  {#each marks as mark (mark)}<span class="ui-mark" class:ui-passed={value >= mark} style:left={share(mark)}></span>{/each}
</div>

<style>
  .ui-progress {
    --track-h: 6px;
    --ring: 2px;
    position: relative;
    height: var(--track-h);
    border-radius: var(--radius-full);
    background: var(--set-well);
  }

  [data-size="hero"] {
    --track-h: 8px;
  }

  .ui-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: var(--primary);
  }

  .ui-ghost {
    position: absolute;
    inset-block: 0;
    border: 1.5px dashed var(--success);
    border-radius: inherit;
    background: color-mix(in oklch, var(--success) 25%, transparent);
  }

  .ui-ghost[data-trend="down"] {
    border-color: var(--error);
    background: color-mix(in oklch, var(--error) 30%, transparent);
  }

  .ui-mark {
    position: absolute;
    top: 50%;
    width: var(--track-h);
    height: var(--track-h);
    border: var(--ring) solid var(--set-panel);
    border-radius: var(--radius-full);
    background: var(--line-strong);
    translate: -50% -50%;
    box-sizing: content-box;
  }

  .ui-mark.ui-passed {
    background: var(--primary);
  }
</style>
