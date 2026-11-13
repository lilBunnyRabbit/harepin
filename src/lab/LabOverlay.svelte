<script lang="ts">
  import Button from "../menu/ui/Button.svelte";
  import Dialog from "../menu/ui/Dialog.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import { goal_label, STATUS_LABEL } from "./lab-text";
  import type { LabView } from "./lab-view.svelte";
  import ResultCard from "./ResultCard.svelte";
  import TrialList from "./TrialList.svelte";

  interface Props {
    view: LabView;
  }

  let { view }: Props = $props();

  const lab = $derived(view.lab);
  const count = $derived(lab.trials.length);
  const at = $derived(view.read(() => lab.at));
  const now = $derived(view.read(() => (at < 0 ? null : { r: lab.trials[at], status: lab.status(at) })));
  const shown = $derived(view.screen);
  const result = $derived(shown?.kind === "result" ? shown.index : null);
  const live = $derived(view.read(() => lab.live));
  const resume_label = $derived(!live ? (at < 0 ? "Start" : "Retry trial") : now?.status === "new" ? "Start" : "Back to trial");
  const driven = $derived(view.read(() => lab.trials.filter((_, i) => lab.status(i) !== "new").length));

  function go(index: number) {
    view.screen = null;
    void lab.begin(index);
  }

  // A dialog closed by the screen moving on fires its close too: only the one still shown clears it.
  function close(kind: "list" | "result") {
    if (view.screen?.kind === kind) view.screen = null;
    // A closed dialog hands focus back to the strip button that opened it, where Space would press it again.
    const back = document.activeElement;
    if (back instanceof HTMLElement && back.closest(".lab-strip")) back.blur();
  }

  function resume() {
    if (live) view.screen = null;
    else go(Math.max(0, at));
  }
</script>

<div class="hud lab-strip" role="group" aria-label="Feel lab">
  <span class="lab-now">
    <b>Lab {at + 1}/{count}</b>
    {#if now}<span class="lab-id">{now.r.trial.id}</span><span class="lab-goal">{goal_label(now.r.trial.goal)} · {STATUS_LABEL[now.status]}</span>{/if}
  </span>
  <IconButton icon="icon-menu" label="Trials" title="Trials" onclick={() => (view.screen = { kind: "list" })} />
  <IconButton icon="icon-restart" label="Retry trial" title="Retry (\)" disabled={at < 0} onclick={() => go(at)} />
  <IconButton icon="icon-check" label="Stop and rate" title="Stop and rate" disabled={at < 0} onclick={() => lab.end_trial()} />
</div>

<Dialog open={shown?.kind === "list"} title={lab.pack.title} subtitle={`r${lab.pack.rev} · ${count} trials · ${driven} driven · nothing here is saved to your records`} wide onclose={() => close("list")}>
  <TrialList {view} onpick={go} />
  {#if view.refused !== null}
    <label class="lab-refused">
      <span>The browser refused the clipboard: select this and copy it.</span>
      <textarea readonly rows="6" onfocus={(e) => e.currentTarget.select()}>{view.refused}</textarea>
    </label>
  {/if}
  {#snippet actions()}
    <div class="lab-actions">
      <Button icon="icon-share" onclick={() => view.copy()}>Copy results</Button>
      <Button variant="primary" icon="icon-play" onclick={resume}>{resume_label}</Button>
    </div>
  {/snippet}
</Dialog>

{#if result !== null}
  {@const r = lab.trials[result]}
  <Dialog open={true} title={`${result + 1}/${count} ${r.trial.id}`} subtitle={`${r.spec.name} · ${r.trial.station}/${r.lane.name} · ${view.read(() => STATUS_LABEL[lab.status(result)])}`} wide onclose={() => close("result")}>
    <ResultCard {view} index={result} />
    {#snippet actions()}
      <div class="lab-actions">
        <Button icon="icon-menu" onclick={() => (view.screen = { kind: "list" })}>Trials</Button>
        <Button icon="icon-share" onclick={() => view.copy()}>Copy</Button>
        <Button icon="icon-back" disabled={result === 0} onclick={() => go(result - 1)}>Previous</Button>
        <Button icon="icon-restart" onclick={() => go(result)}>Retry</Button>
        <Button variant="primary" icon="icon-play" disabled={result + 1 >= count} onclick={() => go(result + 1)}>Next</Button>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  /* The lab times no laps: its strip takes the lap strip's place. */
  :global(:root[data-hud] body:has(.lab-strip) #strip) {
    display: none;
  }

  .lab-strip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: calc(100vw - 2 * var(--inset));
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  }

  .lab-now {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-2);
    min-width: 0;
    margin-right: var(--space-2);
  }

  .lab-id {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lab-goal {
    color: var(--dim);
    font-size: var(--text-sm);
  }

  .lab-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .lab-refused {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-4);
    color: var(--set-dim);
  }

  .lab-refused textarea {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-soft);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    resize: vertical;
    user-select: text;
  }
</style>
