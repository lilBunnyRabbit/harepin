<script lang="ts">
  import { KIND_NAMES, KIND_RULES, ordinal } from "../career/series";
  import SeriesBack from "./SeriesBack.svelte";
  import { event_art, event_score, lock_line, next_event, place_text, rival_gap, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  const next = $derived(next_event(season, progress, states));
  const ahead = $derived(season.events.slice(Math.max(0, next)));
  const behind = $derived(season.events.slice(0, Math.max(0, next)));
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const duel = $derived(rival_gap(season, table));
  const ran = $derived(season.events.filter((event) => progress.results[event.id]).length);
</script>

<div class="rd">
  <header class="rd-top">
    <SeriesBack {onback} />
    <div class="rd-title">
      <p>Season {season.id.slice(1)} · {ran} of {season.events.length} run</p>
      <h2>{season.name} series</h2>
    </div>
    <div class="rd-me">
      <b>{ran ? ordinal(rank) : "–"}</b>
      <span>{me?.points ?? 0} pts</span>
      {#if duel}<span class="rd-rival">{duel.rival.name} {duel.gap >= 0 ? `+${duel.gap} behind you` : `${-duel.gap} ahead`}</span>{/if}
    </div>
  </header>

  <div class="rd-stage">
    {#if behind.length}
      <ol class="rd-behind" aria-label="Run">
        {#each behind as event, i (event.id)}
          {@const score = event_score(season, progress, event)}
          <li data-state={states[i]}>
            <img src={event_art(event)} alt="" />
            <span>{String(i + 1).padStart(2, "0")}</span>
            {#if score}<b>{place_text(score)}</b>{/if}
          </li>
        {/each}
      </ol>
    {/if}
    <ol class="rd-track" aria-label="Events">
      <li class="rd-road" aria-hidden="true">
        <span style:--lit={0.5 / ahead.length}></span>
      </li>
      {#each ahead as event (event.id)}
        {@const i = season.events.indexOf(event)}
        {@const state = states[i]}
        {@const score = event_score(season, progress, event)}
        <li class="rd-card" data-state={state} data-next={i === next} data-final={event.final === true}>
          <img src={event_art(event)} alt="" />
          <div class="rd-shade"></div>
          <span class="rd-n">{String(i + 1).padStart(2, "0")}</span>
          <span class="rd-kind">{event.final ? "Final" : KIND_NAMES[event.kind]}</span>
          <div class="rd-body">
            <h3>{event.name}</h3>
            {#if i === next}<p>{KIND_RULES[event.kind]}</p>{/if}
            {#if state === "locked"}
              <span class="rd-lock"><Icon name="icon-lock" />{lock_line(event)}</span>
            {:else}
              <div class="rd-act">
                {#if score}<span class="rd-score" data-podium={state === "podium"}><b>{place_text(score)}</b> {score.points} pts</span>{/if}
                <button type="button" class="rd-go" onclick={() => onstart(event.id)}>{#if i === next}<Icon name="icon-play" />{/if}{score ? "Again" : "Race"}</button>
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  </div>

  <footer class="rd-foot">
    <ol class="rd-table" aria-label="Standings">
      {#each table as row, i (row.driver)}
        <li data-you={row.you} data-rival={row.rival}><span>{i + 1}</span>{row.name}<b>{row.points}</b></li>
      {/each}
    </ol>
    <button type="button" class="rd-reset" onclick={onreset}>Start over</button>
  </footer>
</div>

<style>
  .rd {
    --card: clamp(15rem, 30vw, 30rem);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-4);
    height: 100%;
  }

  .rd-top {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .rd-title {
    margin-right: auto;
  }

  .rd-title p {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: calc(var(--text-3xl) * 1.6);
    font-weight: 800;
    line-height: 1.05;
  }

  .rd-me {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
  }

  .rd-me b {
    font-size: var(--text-2xl);
  }

  .rd-rival {
    color: var(--warning);
    font-weight: 600;
  }

  .rd-stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
    perspective: 70rem;
    perspective-origin: 20% 10%;
  }

  .rd-track {
    position: absolute;
    top: 6%;
    bottom: 22%;
    left: calc(6rem + var(--space-8));
    display: flex;
    gap: var(--space-8);
    margin: 0;
    padding: 0;
    list-style: none;
    transform-origin: 0 50%;
    transform: rotateY(32deg);
    transform-style: preserve-3d;
  }

  .rd-behind {
    position: absolute;
    top: 6%;
    left: 0;
    z-index: 1;
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rd-behind li {
    position: relative;
    display: flex;
    align-items: end;
    justify-content: space-between;
    width: 6rem;
    aspect-ratio: 16 / 10;
    padding: var(--space-1) var(--space-2);
    overflow: hidden;
    border: 2px solid var(--primary);
    border-radius: var(--radius-md);
    font-weight: 800;
  }

  .rd-behind li span,
  .rd-behind li b {
    position: relative;
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    background: var(--surface);
  }

  .rd-behind li b {
    color: var(--success);
  }

  .rd-road {
    position: absolute;
    top: calc(100% + var(--space-5));
    left: 0;
    width: 100%;
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--set-line);
  }

  .rd-road span {
    display: block;
    width: calc(var(--lit) * 100%);
    height: 100%;
    border-radius: inherit;
    background: var(--primary);
  }

  .rd-card {
    position: relative;
    flex: none;
    display: grid;
    grid-template: "n kind" auto ". ." 1fr "body body" auto / auto 1fr;
    width: var(--card);
    padding: var(--space-5);
    overflow: hidden;
    border: 2px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
  }

  .rd-card[data-next="true"] {
    border-color: var(--primary);
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

  .rd-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, var(--background-darkest) 0%, color-mix(in oklch, var(--background-darkest) 50%, transparent) 35%, transparent 60%);
  }

  .rd-n,
  .rd-kind,
  .rd-body {
    position: relative;
  }

  .rd-n {
    grid-area: n;
    font-size: calc(var(--text-3xl) * 2);
    font-weight: 800;
    line-height: 1;
  }

  .rd-kind {
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

  [data-final="true"] .rd-kind {
    background: var(--accent);
    color: var(--on-accent);
  }

  .rd-body {
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

  .rd-body p {
    margin: 0;
    color: var(--set-dim);
  }

  .rd-lock,
  .rd-act {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .rd-lock {
    color: var(--set-dim);
    font-weight: 600;
  }

  .rd-act {
    justify-content: space-between;
    margin-top: var(--space-2);
  }

  .rd-score {
    color: var(--set-dim);
    white-space: nowrap;
  }

  .rd-score b {
    color: var(--foreground);
    font-size: var(--text-xl);
  }

  .rd-score[data-podium="true"] b {
    color: var(--success);
  }

  .rd-go {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h);
    margin-left: auto;
    padding: 0 var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-raised);
    color: var(--foreground);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  [data-next="true"] .rd-go {
    height: var(--control-h-lg);
    padding: 0 var(--space-8);
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
    font-size: var(--text-xl);
  }

  .rd-foot {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .rd-table {
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

  .rd-table li {
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

  .rd-table li span {
    color: var(--set-dim);
  }

  .rd-table li[data-you="true"] {
    border-color: var(--primary);
  }

  .rd-table li[data-rival="true"] {
    border-color: var(--warning);
  }

  .rd-reset {
    flex: none;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .rd {
      --card: 15rem;
      gap: var(--space-2);
    }

    h2 {
      font-size: var(--text-2xl);
    }

    .rd-title p,
    .rd-rival,
    .rd-body p,
    .rd-reset {
      display: none;
    }

    .rd-track {
      top: 4%;
      bottom: 14%;
      gap: var(--space-5);
    }

    .rd-card {
      padding: var(--space-3);
    }

    .rd-n {
      font-size: var(--text-3xl);
    }

    h3 {
      font-size: var(--text-xl);
    }

    [data-next="true"] .rd-go {
      height: var(--control-h);
      padding: 0 var(--space-5);
      font-size: var(--text-lg);
    }
  }
</style>
