<script lang="ts">
  interface Props {
    value: number;
    max: number;
    label: string;
    marks?: readonly number[];
    size?: "bar" | "hero";
  }

  let { value, max, label, marks = [], size = "bar" }: Props = $props();

  const share = (at: number) => `${(Math.min(Math.max(at, 0), max) / max) * 100}%`;
</script>

<div class="ui-progress" data-size={size} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
  <span class="ui-fill" style:width={share(value)}></span>
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
