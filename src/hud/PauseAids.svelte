<script lang="ts">
  import Chip from "../menu/ui/Chip.svelte";
  import type { PauseAid, PauseAids } from "./pause-view.svelte";

  interface Props {
    aids: PauseAids;
    onflip: (aid: PauseAid) => void;
  }

  let { aids, onflip }: Props = $props();

  const CHIPS: readonly { aid: PauseAid; label: string; title: string }[] = [
    { aid: "tcs", label: "TC", title: "Traction control" },
    { aid: "abs", label: "ABS", title: "ABS" },
    { aid: "assist", label: "Steer", title: "Steering assist" },
    { aid: "stability", label: "STM", title: "Stability" },
    { aid: "auto", label: "Auto", title: "Auto gearbox" },
    { aid: "lights", label: "Lights", title: "Headlights" },
  ];
</script>

<div class="pause-aids" role="group" aria-label="Driving aids">
  <span class="pause-aids-label">Assists</span>
  <div class="pause-aids-chips">
    {#each CHIPS as chip (chip.aid)}
      <Chip variant="toggle" pressed={aids[chip.aid]} title={chip.title} onclick={() => onflip(chip.aid)}>{chip.label}</Chip>
    {/each}
  </div>
</div>

<style>
  .pause-aids {
    display: grid;
    gap: var(--space-2);
  }

  .pause-aids-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .pause-aids-label {
    color: var(--dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (max-height: 500px) {
    .pause-aids-chips {
      flex-wrap: nowrap;
      gap: var(--space-1);
    }
  }
</style>
