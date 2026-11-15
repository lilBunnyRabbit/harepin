<script lang="ts">
  import ClassBadge from "../menu/ui/ClassBadge.svelte";
  import { change_chips, change_text, do_line, feel_line, trial_brief } from "./brief";
  import { goal_label } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";
  import More from "./More.svelte";

  interface Props {
    view: LabView;
    index: number;
  }

  let { view, index }: Props = $props();

  const lab = $derived(view.lab);
  const r = $derived(lab.trials[index]);
  const shown = $derived(lab.shown[index]);
  const brief = $derived(trial_brief(lab.pack, lab.trials, lab.shown, index));
  const feel = $derived(feel_line(shown.feel));
</script>

<div class="lab-brief-card">
  <dl class="lab-glance">
    <div>
      <dt>Car</dt>
      <dd class="lab-setup">
        {#if shown.open}
          <span class="lab-car">{r.spec.name}</span>
          <ClassBadge rating={{ class: r.class, pi: r.pi }} />
          {#each change_chips(brief.changes) as chip (chip)}<span class="lab-chip">{chip}</span>{/each}
        {:else}
          <span class="lab-car">Hidden</span><span class="lab-dim">rate it blind</span>
        {/if}
      </dd>
    </div>
    <div>
      <dt>Do</dt>
      <dd>{do_line(shown.try)} <span class="lab-goal">{goal_label(r.trial.goal)}</span></dd>
    </div>
    <div>
      <dt>Feel for</dt>
      <dd>{feel.notice}</dd>
    </div>
  </dl>

  <More>
    <dl class="lab-facts">
      <div>
        <dt>Question</dt>
        <dd>{brief.question}</dd>
      </div>
      {#if feel.setup}
        <div>
          <dt>Setup</dt>
          <dd>{feel.setup}</dd>
        </div>
      {/if}
      <div>
        <dt>Place</dt>
        <dd>{r.trial.station}/{r.lane.name}</dd>
      </div>
      {#if brief.changes.length || brief.pi}
        <div>
          <dt>Changed</dt>
          <dd>
            <ul>
              {#each brief.changes as c (c.what)}<li>{change_text(c)}</li>{/each}
              {#if brief.pi}<li>Class: {brief.pi}</li>{/if}
            </ul>
          </dd>
        </div>
      {/if}
    </dl>
  </More>
</div>

<style>
  .lab-brief-card {
    display: grid;
    gap: var(--space-6);
  }

  dl {
    display: grid;
    margin: 0;
  }

  .lab-glance {
    gap: var(--space-5);
  }

  .lab-facts {
    gap: var(--space-3);
  }

  dl div {
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

  .lab-glance dd {
    max-width: 65ch;
    font-size: var(--text-xl);
    line-height: 1.4;
  }

  .lab-glance .lab-setup {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .lab-car {
    font-weight: 600;
  }

  .lab-chip,
  .lab-goal {
    padding: var(--space-0) var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-soft);
    font-size: var(--text-lg);
    white-space: nowrap;
  }

  .lab-goal {
    color: var(--set-dim);
  }

  .lab-dim {
    color: var(--set-dim);
  }

  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding-left: var(--space-5);
  }

  @media (min-width: 720px) {
    dl div {
      grid-template-columns: 6rem minmax(0, 1fr);
      align-items: baseline;
      gap: var(--space-4);
    }
  }
</style>
