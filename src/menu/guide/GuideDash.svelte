<script lang="ts">
  import type { Aids } from "../guide-rules";
  import Progress from "../ui/Progress.svelte";
  import { AID_LIGHTS } from "./guide-text";

  interface Props {
    aids: Aids;
  }

  let { aids }: Props = $props();
</script>

<div class="guide-dash" aria-hidden="true">
  <div class="guide-speed">
    <b class="guide-kmh">48</b>
    <span class="guide-unit">km/h</span>
    <span class="guide-gear">3</span>
  </div>
  <Progress value={46} max={100} label="Revs" />
  <span class="guide-lights">
    {#each AID_LIGHTS as [key, label] (key)}<i class:guide-on={aids[key]}>{label}</i>{/each}
  </span>
</div>

<style>
  .guide-dash {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .guide-speed {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .guide-kmh {
    font-family: var(--font-mono);
    font-size: var(--text-3xl);
    font-weight: 700;
    line-height: 1.1;
  }

  .guide-unit {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .guide-gear {
    margin-left: auto;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--set-well);
    color: var(--primary);
    font-family: var(--font-mono);
    font-size: var(--text-xl);
    font-weight: 700;
  }

  .guide-lights {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .guide-lights i {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-style: normal;
  }

  .guide-lights i::before {
    content: "";
    width: var(--space-2);
    height: var(--space-2);
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-full);
    box-sizing: border-box;
  }

  .guide-lights .guide-on {
    color: var(--foreground);
  }

  .guide-lights .guide-on::before {
    border-color: var(--success);
    background: var(--success);
  }
</style>
