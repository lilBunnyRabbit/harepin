<script lang="ts">
  import { KIND_NAMES, KIND_RULES } from "../career/series";
  import SeriesBack from "./SeriesBack.svelte";
  import { driver_code, event_art, event_score, lock_line, next_event, place_text, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  const next = $derived(next_event(season, progress, states));
  const lead = $derived(table[0]?.points ?? 0);
  const ran = $derived(season.events.filter((event) => progress.results[event.id]).length);
  const reached = $derived(Math.max(0, ...season.events.map((event, i) => (progress.results[event.id] ? i : 0))));
  const up = $derived(next >= 0 ? season.events[next] : null);
</script>

<div class="tc">
  <aside class="tc-tower" aria-label="Standings">
    <SeriesBack {onback} />
    <p class="tc-label">{done ? "Final" : `After ${ran} of ${season.events.length}`}</p>
    <ol>
      {#each table as row, i (row.driver)}
        <li data-you={row.you} data-rival={row.rival}>
          <span class="tc-pos">{i + 1}</span>
          <span class="tc-code" title={row.name}>{driver_code(row)}</span>
          <span class="tc-full">{row.name}</span>
          <b>{i === 0 ? row.points : `+${lead - row.points}`}</b>
        </li>
      {/each}
    </ol>
    <button type="button" class="tc-reset" onclick={onreset}>Start over</button>
  </aside>

  <main class="tc-main">
    <header>
      <p>Harepin Series · Season {season.id.slice(1)}</p>
      <h2>{season.name}</h2>
    </header>

    <ol class="tc-road" style:--stops={season.events.length} aria-label="Events">
      <li class="tc-line" aria-hidden="true"><span style:--lit={reached / (season.events.length - 1)}></span></li>
      {#each season.events as event, i (event.id)}
        {@const state = states[i]}
        {@const score = event_score(season, progress, event)}
        <li class="tc-stop" style:--i={i} data-up={i % 2 === 0} data-state={state} data-next={i === next} data-final={event.final === true}>
          <button type="button" class="tc-card" disabled={state === "locked"} onclick={() => onstart(event.id)}>
            <img src={event_art(event)} alt="" loading="lazy" />
            <span class="tc-kind">{event.final ? "Final" : KIND_NAMES[event.kind]}</span>
            {#if state === "locked"}<span class="tc-lockmark"><Icon name="icon-lock" /></span>{/if}
            <span class="tc-text">
              <span class="tc-name">{event.name}</span>
              <span class="tc-res">
                {#if score}<b data-podium={state === "podium"}>{place_text(score)}</b> · {score.points} pts{:else if state === "locked"}{lock_line(event)}{:else}Not run yet{/if}
              </span>
            </span>
          </button>
          <span class="tc-node">{#if state === "podium"}<Icon name="icon-check" />{:else}{i + 1}{/if}</span>
        </li>
      {/each}
    </ol>

    {#if up}
      <section class="tc-next">
        <div>
          <p>Up next · {up.final ? "Final" : KIND_NAMES[up.kind]}</p>
          <h3>{up.name}</h3>
          <span>{KIND_RULES[up.kind]}</span>
        </div>
        <button type="button" class="tc-go" onclick={() => onstart(up.id)}><Icon name="icon-play" />Race</button>
      </section>
    {/if}
  </main>
</div>

<style>
  .tc {
    display: grid;
    grid-template-columns: 17rem minmax(0, 1fr);
    gap: var(--space-8);
    height: 100%;
  }

  .tc-tower {
    display: grid;
    justify-items: start;
    grid-template-rows: auto auto 1fr auto;
    gap: var(--space-3);
    min-height: 0;
  }

  .tc-label,
  header p,
  .tc-next p {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tc-tower ol {
    display: grid;
    justify-self: stretch;
    align-content: start;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tc-tower li {
    display: grid;
    grid-template-columns: 2.25em minmax(0, 1fr) auto;
    align-items: center;
    height: var(--control-h-lg);
    padding-right: var(--space-3);
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--set-panel);
    font-variant-numeric: tabular-nums;
  }

  .tc-pos {
    display: grid;
    place-items: center;
    height: 100%;
    background: var(--set-raised);
    font-weight: 800;
  }

  .tc-code {
    display: none;
    padding-left: var(--space-2);
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .tc-full {
    padding-left: var(--space-3);
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tc-tower li[data-you="true"] {
    background: var(--primary);
    color: var(--on-primary);
  }

  .tc-tower li[data-you="true"] .tc-full {
    color: inherit;
  }

  .tc-tower li[data-you="true"] .tc-pos {
    background: color-mix(in oklch, var(--background-darkest) 20%, transparent);
  }

  .tc-tower li[data-rival="true"] .tc-pos {
    background: var(--warning);
    color: var(--background-darkest);
  }

  .tc-reset {
    justify-self: start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .tc-main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-6);
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: calc(var(--text-3xl) * 1.6);
    font-weight: 800;
    line-height: 1.05;
  }

  .tc-road {
    --node: 2.25rem;
    display: grid;
    grid-template-columns: repeat(calc(var(--stops) + 1), minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr) var(--node) minmax(0, 1fr);
    gap: var(--space-4) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tc-stop {
    display: contents;
  }

  .tc-line {
    grid-row: 2;
    grid-column: 2 / calc(var(--stops) + 1);
    align-self: center;
    height: var(--space-1);
    margin-inline: calc(-1 * var(--space-3) / 2);
    border-radius: var(--radius-full);
    background: var(--set-line);
  }

  .tc-line span {
    display: block;
    width: calc(var(--lit) * 100%);
    height: 100%;
    border-radius: inherit;
    background: var(--primary);
  }

  .tc-card {
    grid-column: calc(var(--i) + 1) / span 2;
    grid-row: 3;
    position: relative;
    min-height: 0;
    padding: 0;
    overflow: hidden;
    border: 2px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
    color: var(--foreground);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  [data-up="true"] .tc-card {
    grid-row: 1;
  }

  .tc-card:disabled {
    cursor: default;
  }

  [data-next="true"] .tc-card {
    border-color: var(--primary);
  }

  .tc-card img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  [data-state="locked"] .tc-card img {
    filter: grayscale(1) brightness(0.4);
  }

  .tc-kind {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    padding: var(--space-0) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--surface);
    max-width: calc(100% - 2 * var(--space-3));
    overflow: hidden;
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  [data-final="true"] .tc-kind {
    background: var(--accent);
    color: var(--on-accent);
  }

  .tc-lockmark {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    color: var(--set-dim);
  }

  .tc-text {
    position: absolute;
    inset: auto 0 0;
    display: grid;
    gap: var(--space-0);
    padding: var(--space-6) var(--space-3) var(--space-3);
    background: linear-gradient(to top, var(--background-darkest), transparent);
  }

  .tc-node {
    grid-column: calc(var(--i) + 1) / span 2;
    grid-row: 2;
    justify-self: center;
    position: relative;
    display: grid;
    place-items: center;
    width: var(--node);
    height: var(--node);
    border: 2px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-well);
    font-weight: 800;
  }

  [data-state="podium"] .tc-node {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  [data-next="true"] .tc-node {
    border-color: var(--primary);
    color: var(--primary);
  }

  .tc-name {
    font-size: var(--text-xl);
    font-weight: 800;
    line-height: 1.2;
  }

  .tc-res {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .tc-res b[data-podium="true"] {
    color: var(--success);
  }

  .tc-next {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .tc-next div {
    display: grid;
    flex: 1;
    gap: var(--space-1);
  }

  .tc-next h3 {
    margin: 0;
    font-size: var(--text-2xl);
  }

  .tc-next span {
    color: var(--set-dim);
  }

  .tc-go {
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
    .tc {
      grid-template-columns: 9rem minmax(0, 1fr);
      gap: var(--space-4);
    }

    .tc-tower {
      gap: var(--space-2);
    }

    .tc-tower li {
      grid-template-columns: 1.75em minmax(0, 1fr) auto;
      height: var(--control-h-sm);
      padding-right: var(--space-2);
      font-size: var(--text-sm);
    }

    .tc-code {
      display: block;
    }

    .tc-full,
    .tc-label,
    .tc-reset,
    header p,
    .tc-res,
    .tc-next span,
    .tc-next p {
      display: none;
    }

    .tc-main {
      gap: var(--space-3);
    }

    h2 {
      font-size: var(--text-2xl);
    }

    .tc-road {
      --node: 1.75rem;
      grid-template-columns: repeat(var(--stops), minmax(0, 1fr));
      grid-template-rows: minmax(0, 1fr) var(--node);
      gap: var(--space-2);
    }

    .tc-line {
      grid-column: 1 / -1;
      margin-inline: calc(50% / var(--stops));
    }

    .tc-card,
    [data-up="true"] .tc-card {
      grid-column: calc(var(--i) + 1);
      grid-row: 1;
    }

    .tc-node {
      grid-column: calc(var(--i) + 1);
    }

    .tc-kind {
      top: var(--space-2);
      left: var(--space-2);
    }

    .tc-text {
      padding: var(--space-4) var(--space-2) var(--space-2);
    }

    .tc-name {
      font-size: var(--text-md);
    }

    .tc-next {
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    }

    .tc-next h3 {
      font-size: var(--text-lg);
    }

    .tc-go {
      height: var(--control-h);
      padding: 0 var(--space-5);
      font-size: var(--text-lg);
    }
  }
</style>
