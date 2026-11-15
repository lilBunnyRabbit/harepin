<script lang="ts">
  import { KIND_NAMES, KIND_RULES, ordinal } from "../career/series";
  import SeriesBack from "./SeriesBack.svelte";
  import { deck_slot, type DeckLayout } from "./series-deck";
  import { event_art, event_score, lock_line, next_event, place_text, rival_gap, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  interface Props extends SeriesView {
    layout: DeckLayout;
  }

  let { layout, season, progress, states, table, done, onstart, onback, onreset }: Props = $props();

  const next = $derived(next_event(season, progress, states));
  let picked = $state<number | null>(null);
  const focus = $derived(picked ?? Math.max(next, 0));
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const duel = $derived(rival_gap(season, table));
  const ran = $derived(season.events.filter((event) => progress.results[event.id]).length);
</script>

<div class="dk" data-layout={layout}>
  <header class="dk-top">
    <SeriesBack {onback} />
    <div class="dk-title">
      <h2>{season.name} series</h2>
      <ol class="dk-pips" aria-label="Season progress">
        {#each season.events as event, i (event.id)}
          {@const score = event_score(season, progress, event)}
          <li data-state={states[i]} aria-current={i === focus}>
            <button type="button" onclick={() => (picked = i)} title={event.name}>{score ? place_text(score) : i + 1}</button>
          </li>
        {/each}
      </ol>
    </div>
    <div class="dk-me">
      <b>{ran ? ordinal(rank) : "–"}</b>
      <span>{me?.points ?? 0} pts</span>
      {#if duel}<span class="dk-rival">{duel.rival.name} {duel.gap >= 0 ? `${duel.gap} behind` : `${-duel.gap} ahead`}</span>{/if}
    </div>
  </header>

  <ol class="dk-stage" aria-label="Events">
    {#each season.events as event, i (event.id)}
      {@const state = states[i]}
      {@const score = event_score(season, progress, event)}
      {@const slot = deck_slot(layout, i - focus, i, season.events.length)}
      <li class="dk-card" style:transform={slot.transform} style:z-index={slot.z} data-dim={slot.dim} data-front={i === focus} data-state={state} data-final={event.final === true}>
        <img src={event_art(event)} alt="" />
        <div class="dk-shade"></div>
        <span class="dk-n">{String(i + 1).padStart(2, "0")}</span>
        <span class="dk-kind">{event.final ? "Final" : KIND_NAMES[event.kind]}</span>
        <div class="dk-body">
          <h3>{event.name}</h3>
          {#if i === focus}<p>{KIND_RULES[event.kind]}</p>{/if}
          {#if state === "locked"}
            <span class="dk-lock"><Icon name="icon-lock" />{lock_line(event)}</span>
          {:else}
            <div class="dk-act">
              {#if score}<span class="dk-score" data-podium={state === "podium"}><b>{place_text(score)}</b> {score.points} pts</span>{/if}
              {#if i === focus}<button type="button" class="dk-go" onclick={() => onstart(event.id)}><Icon name="icon-play" />{score ? "Again" : "Race"}</button>{/if}
            </div>
          {/if}
        </div>
        {#if i !== focus}<button type="button" class="dk-pick" aria-label={`Show ${event.name}`} onclick={() => (picked = i)}></button>{/if}
      </li>
    {/each}
  </ol>

  <footer class="dk-foot">
    <ol class="dk-table" aria-label="Standings">
      {#each table as row, i (row.driver)}
        <li data-you={row.you} data-rival={row.rival}><span>{i + 1}</span>{row.name}<b>{row.points}</b></li>
      {/each}
    </ol>
    <button type="button" class="dk-reset" onclick={onreset}>{done ? "Run it again" : "Start over"}</button>
  </footer>
</div>

<style>
  .dk {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-4);
    height: 100%;
    container-type: size;
  }

  .dk-top {
    position: relative;
    z-index: 200;
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .dk-title {
    display: grid;
    gap: var(--space-2);
    margin-right: auto;
  }

  h2 {
    margin: 0;
    font-size: calc(var(--text-3xl) * 1.4);
    font-weight: 800;
    line-height: 1.05;
  }

  .dk-pips {
    display: flex;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .dk-pips button {
    min-width: 2.75rem;
    height: var(--control-h-sm);
    padding: 0 var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    cursor: pointer;
  }

  .dk-pips [data-state="podium"] button {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  .dk-pips [data-state="locked"] button {
    opacity: 0.6;
  }

  .dk-pips [aria-current="true"] button {
    outline: 2px solid var(--foreground);
    outline-offset: 2px;
  }

  .dk-me {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
  }

  .dk-me b {
    font-size: var(--text-2xl);
  }

  .dk-rival {
    color: var(--warning);
    font-weight: 600;
  }

  .dk-stage {
    position: relative;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    perspective: 140cqw;
    transform-style: preserve-3d;
    --x: 50%;
    --y: 50%;
  }

  [data-layout="road"] .dk-stage {
    --x: 30%;
    perspective-origin: 30% 40%;
  }

  [data-layout="ring"] .dk-stage {
    --y: 42%;
    perspective-origin: 50% -30%;
  }

  [data-layout="ring"] .dk-card {
    height: 50cqh;
  }

  [data-layout="lane"] .dk-stage {
    --y: 46%;
    perspective-origin: 50% 35%;
  }

  .dk-card {
    position: absolute;
    left: var(--x);
    top: var(--y);
    display: grid;
    grid-template: "n kind" auto ". ." 1fr "body body" auto / auto 1fr;
    height: 60cqh;
    aspect-ratio: 4 / 5;
    padding: var(--space-5);
    overflow: hidden;
    border: 2px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
    box-shadow: var(--panel-shadow);
    transition:
      transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1),
      filter 300ms;
    backface-visibility: hidden;
  }

  .dk-card[data-front="true"] {
    border-color: var(--primary);
  }

  .dk-card[data-dim="true"] {
    filter: brightness(0.7);
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  [data-state="locked"] img {
    filter: grayscale(1) brightness(0.45);
  }

  .dk-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, var(--background-darkest) 0%, color-mix(in oklch, var(--background-darkest) 55%, transparent) 35%, transparent 60%);
  }

  .dk-n,
  .dk-kind,
  .dk-body {
    position: relative;
  }

  .dk-n {
    grid-area: n;
    font-size: calc(var(--text-3xl) * 1.6);
    font-weight: 800;
    line-height: 1;
  }

  .dk-kind {
    grid-area: kind;
    justify-self: end;
    align-self: start;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  [data-final="true"] .dk-kind {
    background: var(--accent);
    color: var(--on-accent);
  }

  .dk-body {
    grid-area: body;
    display: grid;
    gap: var(--space-2);
  }

  h3 {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.1;
  }

  .dk-body p {
    margin: 0;
    color: var(--set-dim);
    text-wrap: pretty;
  }

  .dk-lock,
  .dk-act {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .dk-lock {
    color: var(--set-dim);
    font-weight: 600;
  }

  .dk-act {
    justify-content: space-between;
  }

  .dk-score {
    color: var(--set-dim);
    white-space: nowrap;
  }

  .dk-score b {
    color: var(--foreground);
    font-size: var(--text-xl);
  }

  .dk-score[data-podium="true"] b {
    color: var(--success);
  }

  .dk-go {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h-lg);
    margin-left: auto;
    padding: 0 var(--space-6);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-size: var(--text-xl);
    font-weight: 800;
    cursor: pointer;
  }

  .dk-pick {
    position: absolute;
    inset: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .dk-foot {
    position: relative;
    z-index: 200;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .dk-table {
    display: flex;
    flex: 1;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    scrollbar-width: none;
    list-style: none;
  }

  .dk-table li {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-panel);
    font-weight: 600;
    white-space: nowrap;
  }

  .dk-table li span {
    color: var(--set-dim);
  }

  .dk-table li[data-you="true"] {
    border-color: var(--primary);
  }

  .dk-table li[data-rival="true"] {
    border-color: var(--warning);
  }

  .dk-reset {
    flex: none;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .dk {
      gap: var(--space-2);
    }

    h2 {
      font-size: var(--text-xl);
    }

    .dk-title {
      gap: var(--space-1);
    }

    .dk-pips button {
      min-width: 2.25rem;
      height: var(--control-h-sm);
      font-size: var(--text-xs);
    }

    .dk-rival,
    .dk-body p,
    .dk-reset,
    .dk-foot {
      display: none;
    }

    .dk-me b {
      font-size: var(--text-xl);
    }

    .dk-card {
      height: 66cqh;
      padding: var(--space-3);
    }

    .dk-n {
      font-size: var(--text-3xl);
    }

    h3 {
      font-size: var(--text-xl);
    }

    .dk-go {
      height: var(--control-h);
      padding: 0 var(--space-4);
      font-size: var(--text-lg);
    }
  }
</style>
