<script lang="ts">
  import { CLASS_LABELS } from "../car/pi";
  import { against_text, change_text, trial_brief } from "./brief";
  import { goal_label } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";

  interface Props {
    view: LabView;
    index: number;
  }

  let { view, index }: Props = $props();

  const lab = $derived(view.lab);
  const r = $derived(lab.trials[index]);
  const shown = $derived(lab.shown[index]);
  const brief = $derived(trial_brief(lab.pack, lab.trials, lab.shown, index));
</script>

<div class="lab-brief-card">
  <p class="lab-question">{brief.question}</p>
  <dl class="lab-facts">
    <div>
      <dt>Compared with</dt>
      <dd>{against_text(brief, lab.shown)}</dd>
    </div>
    <div>
      <dt>Car</dt>
      <dd>{shown.open ? `${r.spec.name} · ${CLASS_LABELS[r.class]} ${r.pi}` : "Hidden: rate it blind"}</dd>
    </div>
    {#if brief.against >= 0 && !brief.hidden}
      <div>
        <dt>What's different</dt>
        <dd>
          {#if brief.changes.length || brief.pi}
            <ul>
              {#each brief.changes as c (c.what)}<li>{change_text(c)}</li>{/each}
              {#if brief.pi}<li>Class: {brief.pi}</li>{/if}
            </ul>
          {:else}
            Same car and setup
          {/if}
        </dd>
      </div>
    {/if}
    <div>
      <dt>Drive</dt>
      <dd>{shown.try} <span class="lab-dim">· {goal_label(r.trial.goal)}, {r.trial.station}/{r.lane.name}</span></dd>
    </div>
    <div>
      <dt>Feel for</dt>
      <dd>{shown.feel}</dd>
    </div>
  </dl>
</div>

<style>
  .lab-brief-card {
    display: grid;
    gap: var(--space-5);
  }

  .lab-question {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    text-wrap: balance;
  }

  .lab-facts {
    display: grid;
    gap: var(--space-4);
    margin: 0;
  }

  .lab-facts div {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  dt {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  dd {
    margin: 0;
    text-wrap: pretty;
  }

  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding-left: var(--space-5);
  }

  .lab-dim {
    color: var(--set-dim);
  }

  @media (min-width: 720px) {
    .lab-facts div {
      grid-template-columns: 9rem minmax(0, 1fr);
      gap: var(--space-4);
    }
  }
</style>
