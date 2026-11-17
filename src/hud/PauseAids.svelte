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
      <Chip variant="toggle" inner icon={aids[chip.aid] ? "icon-check" : undefined} pressed={aids[chip.aid]} title={chip.title} onclick={() => onflip(chip.aid)}>{chip.label}</Chip>
    {/each}
  </div>
</div>

<style>
  .pause-aids {
    display: grid;
    align-content: start;
    gap: var(--gap-sm);
  }

  .pause-aids-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .pause-aids-label {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
