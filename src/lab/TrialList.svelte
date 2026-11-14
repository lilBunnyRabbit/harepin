<script lang="ts">
  import { CLASS_LABELS } from "../car/pi";
  import Badge from "../menu/ui/Badge.svelte";
  import Tile from "../menu/ui/Tile.svelte";
  import { change_summary, comparisons, trial_brief } from "./brief";
  import { goal_label, STATUS_LABEL, STATUS_TONE } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";

  interface Props {
    view: LabView;
    onpick: (index: number) => void;
  }

  let { view, onpick }: Props = $props();

  const lab = $derived(view.lab);
  const order = $derived(
    comparisons(lab.pack, lab.shown).map(({ base, rest }) => ({
      base,
      place: `${lab.trials[base].trial.station}/${lab.trials[base].lane.name}`,
      rest: rest.map((i) => `#${i + 1} ${lab.shown[i].open ? change_summary(trial_brief(lab.pack, lab.trials, lab.shown, i).changes) : lab.shown[i].label}`).join(", "),
    })),
  );
  const rows = $derived(view.read(() => lab.trials.map((r, i) => ({ r, shown: lab.shown[i], status: lab.status(i), current: i === lab.at }))));
</script>

<div class="lab-intro">
  {#if lab.pack.aim}<p class="lab-aim">{lab.pack.aim}</p>{/if}
  <p class="lab-brief">{lab.pack.brief}</p>
  {#if order.length}
    <section class="lab-order" aria-label="Order of comparisons">
      <h3>Order of comparisons</h3>
      <ol>
        {#each order as g (g.base)}
          <li><b>#{g.base + 1} {lab.shown[g.base].label}</b> <span class="lab-place">{g.place}</span>, then against it: {g.rest}</li>
        {/each}
      </ol>
    </section>
  {/if}
</div>
<ol class="lab-trials">
  {#each rows as { r, shown, status, current }, i (r.trial.id)}
    <li>
      <Tile
        size="sm"
        title={`${i + 1}. ${shown.label}`}
        meta={`${shown.open ? `${r.spec.name} ${CLASS_LABELS[r.class]} ${r.pi} · ` : ""}${r.trial.station}/${r.lane.name} · ${goal_label(r.trial.goal)}`}
        selected={current}
        onclick={() => onpick(i)}
      >
        {#snippet aside()}<Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>{/snippet}
      </Tile>
    </li>
  {/each}
</ol>

<style>
  .lab-intro {
    display: grid;
    gap: var(--space-3);
    max-width: 75ch;
    margin-bottom: var(--space-5);
  }

  .lab-intro p {
    margin: 0;
    text-wrap: pretty;
  }

  .lab-aim {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .lab-brief,
  .lab-place {
    color: var(--set-dim);
  }

  .lab-order h3 {
    margin: 0 0 var(--space-2);
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .lab-order ol {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding-left: var(--space-5);
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
