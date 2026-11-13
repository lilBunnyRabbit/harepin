<script lang="ts">
  import { CLASS_LABELS } from "../car/pi";
  import Badge from "../menu/ui/Badge.svelte";
  import Tile from "../menu/ui/Tile.svelte";
  import { goal_label, STATUS_LABEL, STATUS_TONE } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";

  interface Props {
    view: LabView;
    onpick: (index: number) => void;
  }

  let { view, onpick }: Props = $props();

  const lab = $derived(view.lab);
  const rows = $derived(view.read(() => lab.trials.map((r, i) => ({ r, status: lab.status(i), current: i === lab.at }))));
</script>

<p class="lab-brief">{lab.pack.brief}</p>
<ol class="lab-trials">
  {#each rows as { r, status, current }, i (r.trial.id)}
    <li>
      <Tile
        size="sm"
        title={`${i + 1}. ${r.trial.id}`}
        meta={`${r.spec.name} ${CLASS_LABELS[r.class]} ${r.pi} · ${r.trial.station}/${r.lane.name} · ${goal_label(r.trial.goal)}`}
        selected={current}
        onclick={() => onpick(i)}
      >
        {#snippet aside()}<Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>{/snippet}
      </Tile>
    </li>
  {/each}
</ol>

<style>
  .lab-brief {
    margin: 0 0 var(--space-4);
    color: var(--set-dim);
    text-wrap: pretty;
  }

  .lab-trials {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .lab-trials li {
    display: grid;
    min-width: 0;
  }
</style>
