<script lang="ts">
  import Segmented from "../menu/ui/Segmented.svelte";
  import TextField from "../menu/ui/TextField.svelte";
  import { questions_of } from "./answers";
  import { metric_pairs } from "./export";
  import { against_text, feel_line, trial_brief } from "./brief";
  import { shown_metrics, split_metrics } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";
  import More from "./More.svelte";
  import Scale from "./Scale.svelte";

  interface Props {
    view: LabView;
    index: number;
  }

  let { view, index }: Props = $props();

  const lab = $derived(view.lab);
  const r = $derived(lab.trials[index]);
  const questions = $derived(questions_of(lab.pack, r.trial));
  const metrics = $derived(view.read(() => lab.results[index].metrics));
  const field = $derived(view.read(() => lab.results[index].field));
  const gap_text = (gap: number) => (Number.isNaN(gap) ? "" : `+${gap.toFixed(1)} s`);
  const numbers = $derived(split_metrics(metrics ? shown_metrics(metric_pairs(metrics), r.station?.id ?? null) : [], r.station?.id ?? null));
  const brief = $derived(trial_brief(lab.pack, lab.trials, lab.shown, index));
  const feel = $derived(feel_line(lab.shown[index].feel));
  const given = $derived(view.read(() => ({ ...lab.answers[r.trial.id] })));
  const scale_of = (v: string | number | undefined) => (typeof v === "number" ? v : null);
  const text_of = (v: string | number | undefined) => (typeof v === "string" ? v : "");
</script>

<div class="lab-result">
  <section class="lab-questions" aria-label="Your take">
    {#each questions as q (q.id)}
      {#if q.kind === "scale"}
        <Scale label={q.label} low={q.low} high={q.high} value={scale_of(given[q.id])} onchange={(v) => lab.answer(r.trial.id, q, v)} />
      {:else if q.kind === "pick"}
        <div class="lab-pick">
          <span class="lab-pick-label">{q.label}</span>
          <Segmented options={q.options.map((o) => ({ value: o, label: o }))} value={text_of(given[q.id]) || null} label={q.label} onchange={(v) => lab.answer(r.trial.id, q, v)} />
        </div>
      {:else}
        <TextField label={q.label} value={text_of(given[q.id])} placeholder="Optional, one line" enterkeyhint="done" oninput={(e) => lab.answer(r.trial.id, q, e.currentTarget.value)} />
      {/if}
    {/each}
  </section>

  <section class="lab-numbers" aria-label="Numbers">
    {#if metrics}
      <dl class="lab-lead">
        {#each numbers.lead as m (m.key)}
          <div><dt>{m.label}</dt><dd>{m.value}</dd></div>
        {/each}
      </dl>
    {:else}
      <p class="lab-none">Nothing measured: the clock starts at the first throttle.</p>
    {/if}
    {#if field}
      <ol class="lab-field" aria-label="Running order">
        {#each field as row, i (i)}
          <li data-you={row.you}><span class="lab-field-place">{i + 1}</span><span class="lab-field-name">{row.you ? "You" : row.name}</span><span class="lab-field-gap">{i === 0 ? "" : gap_text(row.gap)}</span></li>
        {/each}
      </ol>
    {/if}
    <More>
      <div class="lab-more-grid">
        <dl class="lab-facts">
          <div><dt>Feel for</dt><dd>{feel.notice}</dd></div>
          <div><dt>Question</dt><dd>{brief.question}</dd></div>
          <div><dt>Compared with</dt><dd>{against_text(brief, lab.shown)}</dd></div>
        </dl>
        {#if numbers.rest.length}
          <dl class="lab-rest">
            {#each numbers.rest as m (m.key)}
              <div><dt>{m.label}</dt><dd>{m.value}</dd></div>
            {/each}
          </dl>
        {/if}
      </div>
    </More>
  </section>
</div>

<style>
  .lab-result {
    display: grid;
    gap: var(--space-6);
  }

  .lab-numbers,
  .lab-questions {
    display: grid;
    align-content: start;
    gap: var(--space-5);
    min-width: 0;
  }

  dl {
    display: grid;
    margin: 0;
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
    overflow-wrap: anywhere;
    text-wrap: pretty;
  }

  .lab-lead {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .lab-lead div {
    align-content: start;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-soft);
  }

  .lab-lead dd {
    font-size: var(--text-2xl);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .lab-more-grid {
    display: grid;
    gap: var(--space-5);
  }

  .lab-facts {
    gap: var(--space-3);
  }

  .lab-rest {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
    gap: var(--space-3) var(--space-4);
  }

  .lab-rest dd {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .lab-field {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    font-variant-numeric: tabular-nums;
  }

  .lab-field li {
    display: grid;
    grid-template-columns: 2ch minmax(0, 1fr) auto;
    gap: var(--space-3);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
  }

  .lab-field li[data-you="true"] {
    background: var(--set-soft);
    font-weight: 600;
  }

  .lab-field-place,
  .lab-field-gap {
    color: var(--set-dim);
  }

  .lab-field-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lab-none {
    margin: 0;
    color: var(--set-dim);
    text-wrap: pretty;
  }

  .lab-pick {
    display: grid;
    gap: var(--space-2);
  }

  .lab-pick-label {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .lab-pick :global(.ui-segmented) {
    height: var(--control-h-lg);
  }

  @media (min-width: 720px) {
    .lab-result {
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
      gap: var(--space-8);
    }
  }
</style>
