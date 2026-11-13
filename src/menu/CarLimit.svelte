<script lang="ts">
  import type { CareerEvent } from "../career/career";
  import ClassBadge from "./ui/ClassBadge.svelte";

  interface Props {
    event: CareerEvent;
  }

  let { event }: Props = $props();
</script>

{#if "preset" in event.car}
  <span class="preset">{event.car.preset} car</span>
{:else}
  <ClassBadge cap={event.car.cap} />
{/if}

<style>
  .preset {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }
</style>
