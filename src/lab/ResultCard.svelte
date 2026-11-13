<script lang="ts">
  import Segmented from "../menu/ui/Segmented.svelte";
  import TextField from "../menu/ui/TextField.svelte";
  import { questions_of } from "./answers";
  import { metric_pairs } from "./export";
  import { METRIC_LABEL } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";
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
  const given = $derived(view.read(() => ({ ...lab.answers[r.trial.id] })));
  const scale_of = (v: string | number | undefined) => (typeof v === "number" ? v : null);
  const text_of = (v: string | number | undefined) => (typeof v === "string" ? v : "");
</script>

<div class="lab-result">
  <section class="lab-questions" aria-label="Your take">
    <p class="lab-feel">{r.trial.feel}</p>
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
      <dl>
        {#each metric_pairs(metrics) as [key, text] (key)}
          <div><dt>{METRIC_LABEL[key] ?? key}</dt><dd>{text}</dd></div>
        {/each}
      </dl>
    {:else}
      <p class="lab-none">Nothing measured: the clock starts at the first throttle.</p>
    {/if}
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
    gap: var(--space-4);
    min-width: 0;
  }

  .lab-feel,
  .lab-none {
    margin: 0;
    color: var(--set-dim);
    text-wrap: pretty;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }

  dl div {
    display: grid;
    min-width: 0;
  }

  dt {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  dd {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
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
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    }
  }
</style>
