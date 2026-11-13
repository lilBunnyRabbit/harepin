<script lang="ts">
  import { CLASS_LABELS } from "../car/pi";
  import type { CareerEvent } from "../career/career";
  import "./class-badge.css";

  interface Props {
    event: CareerEvent;
  }

  let { event }: Props = $props();
</script>

{#if "preset" in event.car}
  <span class="preset">{event.car.preset} car</span>
{:else}
  <span class="class-badge" data-class={event.car.cap} aria-label={`Class ${CLASS_LABELS[event.car.cap]} or lower`}>
    <b class="class-badge-letter">{CLASS_LABELS[event.car.cap]}</b>
    <span class="class-badge-pi">max</span>
  </span>
{/if}

<style>
  .preset {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }
</style>
