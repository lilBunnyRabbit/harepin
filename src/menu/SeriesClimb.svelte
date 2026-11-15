<script lang="ts">
  import { KIND_NAMES, KIND_RULES, ordinal } from "../career/series";
  import SeriesBack from "./SeriesBack.svelte";
  import { driver_code, event_art, event_score, lock_line, next_event, place_text, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  const next = $derived(next_event(season, progress, states));
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const ran = $derived(season.events.filter((e) => progress.results[e.id]).length);
  const top = $derived(Math.max(1, ...table.map((row) => row.points)));
  const up = $derived(next >= 0 ? season.events[next] : null);
</script>

<div class="cl">
  <header class="cl-top">
    <SeriesBack {onback} />
    <div class="cl-title">
      <p>Season {season.id.slice(1)} · step {Math.min(ran + 1, season.events.length)} of {season.events.length}</p>
      <h2>{season.name} series</h2>
    </div>
    <span class="cl-me"><b>{ran ? ordinal(rank) : "–"}</b> {me?.points ?? 0} pts</span>
  </header>

  <ol class="cl-stairs" style:--steps={season.events.length} aria-label="Events">
    {#each season.events as event, i (event.id)}
      {@const state = states[i]}
      {@const score = event_score(season, progress, event)}
      <li class="cl-step" style:--i={i} data-state={state} data-next={i === next} data-final={event.final === true}>
        {#if i === next}<span class="cl-you">You are here</span>{/if}
        <button type="button" class="cl-block" disabled={state === "locked"} onclick={() => onstart(event.id)}>
          <span class="cl-face">
            <img src={event_art(event)} alt="" />
            <span class="cl-n">{i + 1}</span>
            <span class="cl-text">
              <span class="cl-kind">{event.final ? "Final" : KIND_NAMES[event.kind]}</span>
              <span class="cl-name">{event.name}</span>
              <span class="cl-res">
                {#if score}<b>{place_text(score)}</b> · {score.points} pts{:else if state === "locked"}<Icon name="icon-lock" />{:else}Open{/if}
              </span>
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ol>

  <aside class="cl-podium" aria-label="Standings">
    <p class="cl-eyebrow">{done ? "Final standings" : "Standings"}</p>
    <ol>
      {#each table as row, i (row.driver)}
        <li style:--h={row.points / top} data-you={row.you} data-rival={row.rival}>
          <b>{row.points}</b>
          <span class="cl-bar"></span>
          <span class="cl-who" title={row.name}>{i + 1} {driver_code(row)}</span>
        </li>
      {/each}
    </ol>
    <button type="button" class="cl-reset" onclick={onreset}>Start over</button>
  </aside>

  {#if up}
    <section class="cl-next">
      <div>
        <p class="cl-eyebrow">Next step · {up.final ? "Final" : KIND_NAMES[up.kind]}</p>
        <h3>{up.name}</h3>
        <span>{states[next] === "locked" ? lock_line(up) : KIND_RULES[up.kind]}</span>
      </div>
      <button type="button" class="cl-go" onclick={() => onstart(up.id)}><Icon name="icon-play" />Race</button>
    </section>
  {/if}
</div>

<style>
  .cl {
    --depth: 3rem;
    display: grid;
    grid-template: "top top" auto "stairs podium" minmax(0, 1fr) "next podium" auto / minmax(0, 1fr) 20rem;
    gap: var(--space-5) var(--space-8);
    height: 100%;
  }

  .cl-top {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .cl-title {
    margin-right: auto;
  }

  .cl-title p,
  .cl-eyebrow {
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

  .cl-me {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
  }

  .cl-me b {
    font-size: var(--text-2xl);
  }

  .cl-stairs {
    grid-area: stairs;
    display: grid;
    grid-template-columns: repeat(var(--steps), minmax(0, 1fr));
    align-items: end;
    gap: 0;
    min-height: 0;
    margin: 0;
    padding: 0 var(--depth) 0 0;
    list-style: none;
    perspective: 80rem;
    perspective-origin: 10% -40%;
  }

  .cl-step {
    position: relative;
    display: grid;
    height: calc((35% + var(--i) * 13%) - var(--depth));
    transform-style: preserve-3d;
  }

  .cl-you {
    position: absolute;
    bottom: calc(100% + var(--depth) + var(--space-3));
    left: 50%;
    translate: -50% 0;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--primary);
    color: var(--on-primary);
    font-size: var(--text-sm);
    font-weight: 800;
    white-space: nowrap;
  }

  .cl-block {
    position: relative;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--foreground);
    font: inherit;
    text-align: start;
    transform-style: preserve-3d;
    cursor: pointer;
  }

  .cl-block:disabled {
    cursor: default;
  }

  .cl-block::before,
  .cl-block::after {
    content: "";
    position: absolute;
  }

  .cl-block::before {
    inset: auto 0 100% 0;
    height: var(--depth);
    background: var(--set-raised);
    border: 1px solid var(--set-line);
    transform-origin: 50% 100%;
    transform: rotateX(70deg);
  }

  .cl-block::after {
    inset: 0 auto 0 100%;
    width: var(--depth);
    background: var(--background-darkest);
    transform-origin: 0 50%;
    transform: rotateY(70deg);
  }

  [data-state="podium"] .cl-block::before {
    background: var(--primary);
  }

  [data-next="true"] .cl-block::before {
    background: color-mix(in oklch, var(--primary) 45%, var(--set-raised));
  }

  [data-final="true"] .cl-block::before {
    background: var(--accent);
  }

  .cl-face {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid var(--set-line);
    background: var(--set-well);
  }

  [data-next="true"] .cl-face {
    border-color: var(--primary);
  }

  .cl-face img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  [data-state="locked"] .cl-face img {
    filter: grayscale(1) brightness(0.4);
  }

  .cl-face::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, var(--background-darkest) 10%, transparent 70%);
  }

  .cl-n,
  .cl-text {
    position: relative;
    z-index: 1;
  }

  .cl-n {
    padding: var(--space-3);
    font-size: calc(var(--text-3xl) * 1.4);
    font-weight: 800;
    line-height: 1;
  }

  .cl-text {
    display: grid;
    align-self: end;
    gap: var(--space-1);
    padding: var(--space-3);
  }

  .cl-kind {
    color: var(--set-dim);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cl-name {
    font-size: var(--text-lg);
    font-weight: 800;
    line-height: 1.2;
  }

  .cl-res {
    display: flex;
    gap: var(--space-1);
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .cl-res b {
    color: var(--success);
  }

  .cl-podium {
    grid-area: podium;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .cl-podium ol {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    align-items: end;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cl-podium li {
    display: flex;
    flex-direction: column;
    justify-content: end;
    height: 100%;
    justify-items: center;
    align-self: stretch;
    align-content: end;
    gap: var(--space-1);
    min-width: 0;
  }

  .cl-bar {
    width: 100%;
    height: calc(var(--h) * (100% - 3rem) + var(--space-2));
    border-radius: var(--radius-xs) var(--radius-xs) 0 0;
    background: var(--set-raised);
    box-shadow: inset calc(-1 * var(--space-1)) 0 0 color-mix(in oklch, var(--background-darkest) 35%, transparent);
  }

  [data-you="true"] .cl-bar {
    background: var(--primary);
  }

  [data-rival="true"] .cl-bar {
    background: var(--warning);
  }

  .cl-podium li b {
    font-size: var(--text-md);
  }

  .cl-who {
    font-size: var(--text-2xs);
    font-weight: 700;
    white-space: nowrap;
  }

  .cl-reset {
    justify-self: start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .cl-next {
    grid-area: next;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .cl-next div {
    display: grid;
    flex: 1;
    gap: var(--space-1);
  }

  .cl-next .cl-eyebrow {
    color: var(--primary);
  }

  h3 {
    margin: 0;
    font-size: var(--text-2xl);
  }

  .cl-next span {
    color: var(--set-dim);
  }

  .cl-go {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h-lg);
    padding: 0 var(--space-8);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-size: var(--text-xl);
    font-weight: 800;
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .cl {
      --depth: 1.5rem;
      grid-template: "top" auto "stairs" minmax(0, 1fr) "next" auto / minmax(0, 1fr);
      gap: var(--space-2);
    }

    .cl-podium,
    .cl-title p,
    .cl-next span,
    .cl-next .cl-eyebrow,
    .cl-kind,
    [data-state="open"] .cl-res,
    [data-state="locked"] .cl-res {
      display: none;
    }

    h2 {
      font-size: var(--text-2xl);
    }

    .cl-me b {
      font-size: var(--text-xl);
    }

    .cl-step {
      height: calc((52% + var(--i) * 9%) - var(--depth));
    }

    .cl-n {
      padding: var(--space-2);
      font-size: var(--text-2xl);
    }

    .cl-text {
      padding: var(--space-2);
    }

    .cl-name {
      font-size: var(--text-sm);
    }

    .cl-you {
      font-size: var(--text-xs);
    }

    .cl-next {
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    }

    h3 {
      font-size: var(--text-lg);
    }

    .cl-go {
      height: var(--control-h);
      padding: 0 var(--space-5);
      font-size: var(--text-lg);
    }
  }
</style>
