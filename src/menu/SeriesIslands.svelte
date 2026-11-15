<script lang="ts">
  import { BONUS_NAMES, BONUS_POINTS, KIND_BONUSES, KIND_NAMES, KIND_RULES, ordinal } from "../career/series";
  import { series_map } from "../career/series-run";
  import { thumb_url } from "./map-thumb";
  import SeriesBack from "./SeriesBack.svelte";
  import { event_score, lock_line, next_event, place_text, rival_gap, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  const SPOTS: readonly [number, number][] = [
    [14, 74],
    [36, 82],
    [44, 50],
    [24, 26],
    [60, 18],
    [84, 40],
  ];
  const MAP_SIZE = 280;

  const next = $derived(next_event(season, progress, states));
  let picked = $state<number | null>(null);
  const shown = $derived(picked ?? Math.max(next, 0));
  const event = $derived(season.events[shown]);
  const status = $derived(states[shown]);
  const score = $derived(event_score(season, progress, event));
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const duel = $derived(rival_gap(season, table));
  const ran = $derived(season.events.filter((e) => progress.results[e.id]).length);
  const maps = $derived(season.events.map((e) => thumb_url(series_map(season, e), MAP_SIZE)));
  const focus = $derived(SPOTS[shown] ?? SPOTS[0]);
</script>

<div class="is">
  <header class="is-top">
    <SeriesBack {onback} />
    <div class="is-title">
      <p>Season {season.id.slice(1)} · {ran} of {season.events.length} islands raced</p>
      <h2>{season.name} series</h2>
    </div>
    <span class="is-me"><b>{ran ? ordinal(rank) : "–"}</b> {me?.points ?? 0} pts</span>
  </header>

  <div class="is-sea">
    <div class="is-board" style:--fx={`${focus[0]}%`} style:--fy={`${focus[1]}%`}>
      <svg class="is-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {#each SPOTS.slice(1) as [x, y], i (i)}
          <line x1={SPOTS[i][0]} y1={SPOTS[i][1]} x2={x} y2={y} data-lit={progress.results[season.events[i + 1].id] !== undefined} />
        {/each}
      </svg>
      {#each season.events as item, i (item.id)}
        {@const s = event_score(season, progress, item)}
        <button
          type="button"
          class="is-isle"
          style:left={`${SPOTS[i][0]}%`}
          style:top={`${SPOTS[i][1]}%`}
          data-state={states[i]}
          data-next={i === next}
          aria-current={i === shown}
          onclick={() => (picked = i)}
        >
          {#await maps[i] then url}<img src={url} alt="" />{/await}
          <span class="is-pin">
            <span class="is-n">{#if states[i] === "podium"}<Icon name="icon-check" />{:else if states[i] === "locked"}<Icon name="icon-lock" />{:else}{i + 1}{/if}</span>
            <span class="is-label">{item.name}{#if s}<b>{place_text(s)}</b>{/if}</span>
          </span>
        </button>
      {/each}
    </div>
  </div>

  <aside class="is-panel">
    <section class="is-event">
      <p class="is-eyebrow">Island {shown + 1} · {event.final ? "Final" : KIND_NAMES[event.kind]}</p>
      <h3>{event.name}</h3>
      <p class="is-rule">{KIND_RULES[event.kind]}</p>
      <ul class="is-bonus">
        {#each KIND_BONUSES[event.kind] as bonus (bonus)}<li>{BONUS_NAMES[bonus]} <b>+{BONUS_POINTS[bonus]}</b></li>{/each}
      </ul>
      {#if status === "locked"}
        <span class="is-lock"><Icon name="icon-lock" />{lock_line(event)}</span>
      {:else}
        <div class="is-cta">
          <button type="button" class="is-go" onclick={() => onstart(event.id)}><Icon name="icon-play" />{score ? "Race again" : "Race"}</button>
          {#if score}<span>Best <b>{place_text(score)}</b> · {score.points} pts</span>{/if}
        </div>
      {/if}
    </section>
    <section class="is-table" aria-label="Standings">
      <p class="is-eyebrow">{done ? "Final standings" : "Standings"}{#if duel} · <em>{duel.rival.name} {duel.gap >= 0 ? `${duel.gap} behind` : `${-duel.gap} ahead`}</em>{/if}</p>
      <ol>
        {#each table as row, i (row.driver)}
          <li data-you={row.you}><span>{i + 1}</span>{row.name}<b>{row.points}</b></li>
        {/each}
      </ol>
      <button type="button" class="is-reset" onclick={onreset}>Start over</button>
    </section>
  </aside>
</div>

<style>
  .is {
    display: grid;
    grid-template: "top top" auto "sea panel" minmax(0, 1fr) / minmax(0, 1fr) 22rem;
    gap: var(--space-4) var(--space-6);
    height: 100%;
  }

  .is-top {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }

  .is-title {
    margin-right: auto;
  }

  .is-title p,
  .is-eyebrow {
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

  .is-me {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
  }

  .is-me b {
    font-size: var(--text-2xl);
  }

  .is-sea {
    grid-area: sea;
    position: relative;
    min-height: 0;
    perspective: 60rem;
    perspective-origin: 50% 0%;
  }

  .is-board {
    position: absolute;
    inset: 4% 6% 10%;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(circle, var(--line) 1px, transparent 1.5px) 0 0 / var(--space-6) var(--space-6),
      color-mix(in oklch, var(--background-darkest) 80%, transparent);
    transform-origin: var(--fx) var(--fy);
    transform: rotateX(50deg) scale(1.05);
    transform-style: preserve-3d;
    transition: transform-origin 600ms ease;
  }

  .is-path {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  line {
    stroke: var(--line-strong);
    stroke-width: 4;
    stroke-dasharray: 10 8;
    vector-effect: non-scaling-stroke;
  }

  line[data-lit="true"] {
    stroke: var(--primary);
    stroke-dasharray: none;
  }

  .is-isle {
    position: absolute;
    width: clamp(5rem, 9vw, 9rem);
    aspect-ratio: 1;
    padding: 0;
    border: 3px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-well);
    translate: -50% -50%;
    transform-style: preserve-3d;
    cursor: pointer;
  }

  .is-isle img {
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
  }

  .is-isle[data-state="locked"] img {
    filter: grayscale(1) brightness(0.5);
  }

  .is-isle[data-state="podium"] {
    border-color: var(--primary);
  }

  .is-isle[aria-current="true"] {
    border-color: var(--foreground);
    box-shadow: 0 0 0 var(--space-2) color-mix(in oklch, var(--primary) 40%, transparent);
  }

  .is-pin {
    position: absolute;
    bottom: 50%;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    transform-origin: 50% 100%;
    transform: translateX(-50%) rotateX(-50deg);
    pointer-events: none;
  }

  .is-n {
    display: grid;
    place-items: center;
    width: var(--control-h);
    height: var(--control-h);
    border: 2px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-panel);
    color: var(--foreground);
    font-size: var(--text-lg);
    font-weight: 800;
  }

  [data-state="podium"] .is-n {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  [data-next="true"] .is-n {
    border-color: var(--primary);
    color: var(--primary);
  }

  .is-label {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--set-panel);
    color: var(--foreground);
    font-size: var(--text-md);
    font-weight: 700;
    white-space: nowrap;
  }

  .is-label b {
    color: var(--success);
  }

  .is-panel {
    grid-area: panel;
    display: grid;
    align-content: start;
    gap: var(--space-4);
    min-height: 0;
  }

  .is-event,
  .is-table {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .is-event .is-eyebrow {
    color: var(--primary);
  }

  h3 {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.1;
  }

  .is-rule {
    margin: 0;
    color: var(--set-dim);
  }

  .is-bonus {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .is-bonus li {
    padding: var(--space-0) var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
  }

  .is-bonus b {
    color: var(--success);
  }

  .is-lock,
  .is-cta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--set-dim);
    font-weight: 600;
  }

  .is-cta b {
    color: var(--success);
  }

  .is-go {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h-lg);
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

  em {
    color: var(--warning);
    font-style: normal;
  }

  .is-table ol {
    display: grid;
    gap: var(--space-0);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .is-table li {
    display: grid;
    grid-template-columns: 1.5em minmax(0, 1fr) auto;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .is-table li span {
    color: var(--set-dim);
  }

  .is-table li[data-you="true"] {
    background: var(--primary);
    color: var(--on-primary);
  }

  .is-table li[data-you="true"] span {
    color: inherit;
  }

  .is-reset {
    justify-self: start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .is {
      grid-template: "top top" auto "sea panel" minmax(0, 1fr) / minmax(0, 1fr) 15rem;
      gap: var(--space-2) var(--space-4);
    }

    .is-title p,
    .is-table,
    .is-bonus,
    .is-rule,
    .is-cta span {
      display: none;
    }

    h2 {
      font-size: var(--text-2xl);
    }

    .is-me b {
      font-size: var(--text-xl);
    }

    .is-board {
      inset: 0 2% 6%;
    }

    .is-isle {
      width: 4.5rem;
    }

    .is-n {
      width: var(--control-h-sm);
      height: var(--control-h-sm);
      font-size: var(--text-md);
    }

    .is-label {
      font-size: var(--text-sm);
    }

    .is-event {
      align-self: end;
      padding: var(--space-4);
    }

    h3 {
      font-size: var(--text-2xl);
    }

    .is-go {
      height: var(--control-h);
      padding: 0 var(--space-5);
      font-size: var(--text-lg);
    }
  }
</style>
