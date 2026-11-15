<script lang="ts">
  import { KIND_NAMES, KIND_RULES, ordinal } from "../career/series";
  import SeriesBack from "./SeriesBack.svelte";
  import { event_art, event_score, lock_line, next_event, place_text, rival_gap, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  const next = $derived(next_event(season, progress, states));
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const duel = $derived(rival_gap(season, table));
  const ran = $derived(Object.keys(progress.results).length);
</script>

<div class="ra">
  <header class="ra-top">
    <SeriesBack {onback} />
    <div class="ra-title">
      <p>Harepin Series · Season {season.id.slice(1)}</p>
      <h2>{season.name}</h2>
    </div>
    <dl class="ra-me">
      <div><dt>Standing</dt><dd>{ran ? ordinal(rank) : "–"}</dd></div>
      <div><dt>Points</dt><dd>{me?.points ?? 0}</dd></div>
      {#if duel}
        <div class="ra-rival">
          <dt>Rival</dt>
          <dd>{duel.rival.name}<small>{duel.gap === 0 ? "level" : duel.gap > 0 ? `you lead by ${duel.gap}` : `${-duel.gap} ahead`}</small></dd>
        </div>
      {/if}
    </dl>
  </header>

  <ol class="ra-rail" aria-label="Events">
    {#each season.events as event, i (event.id)}
      {@const state = states[i]}
      {@const score = event_score(season, progress, event)}
      <li class="ra-card" data-state={state} data-next={i === next} data-final={event.final === true}>
        <img src={event_art(event)} alt="" loading="lazy" />
        <div class="ra-shade"></div>
        <div class="ra-head">
          <span class="ra-n">{String(i + 1).padStart(2, "0")}</span>
          <span class="ra-kind">{event.final ? "Final" : KIND_NAMES[event.kind]}</span>
        </div>
        <div class="ra-body">
          <h3>{event.name}</h3>
          <p class="ra-rule">{KIND_RULES[event.kind]}</p>
          {#if state === "locked"}
            <p class="ra-lock"><Icon name="icon-lock" />{lock_line(event)}</p>
          {:else}
            <div class="ra-act">
              {#if score}<span class="ra-score" data-podium={state === "podium"}><b>{place_text(score)}</b> {score.points} pts</span>{/if}
              <button type="button" class="ra-go" onclick={() => onstart(event.id)}>{score ? "Again" : "Race"}</button>
            </div>
          {/if}
        </div>
      </li>
    {/each}
  </ol>

  <footer class="ra-table">
    <span class="ra-label">{done ? "Final standings" : "Standings"}</span>
    <ol>
      {#each table as row, i (row.driver)}
        <li data-you={row.you} data-rival={row.rival}><span>{i + 1}</span>{row.name}<b>{row.points}</b></li>
      {/each}
    </ol>
    <button type="button" class="ra-reset" onclick={onreset}>Start over</button>
  </footer>
</div>

<style>
  .ra {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-5);
    height: 100%;
  }

  .ra-top {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    min-width: 0;
  }

  .ra-title {
    margin-right: auto;
  }

  .ra-title p,
  dt,
  .ra-label {
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

  .ra-me {
    display: flex;
    gap: var(--space-8);
    margin: 0;
  }

  dd {
    display: grid;
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }

  .ra-rival dd {
    font-size: var(--text-xl);
    line-height: 1.4;
  }

  .ra-rival dt {
    color: var(--warning);
  }

  dd small {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .ra-rail {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: calc((100% - 3 * var(--space-4)) / 3.5);
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    list-style: none;
  }

  .ra-card {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
    scroll-snap-align: start;
  }

  .ra-card[data-next="true"] {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 1px var(--primary);
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 50%;
  }

  [data-state="locked"] img {
    filter: grayscale(1) brightness(0.45);
  }

  .ra-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, var(--background-darkest) 0%, color-mix(in oklch, var(--background-darkest) 60%, transparent) 30%, transparent 50%),
      linear-gradient(to bottom, color-mix(in oklch, var(--background-darkest) 50%, transparent) 0%, transparent 25%);
  }

  .ra-head,
  .ra-body {
    position: relative;
  }

  .ra-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    padding: var(--space-4);
  }

  .ra-n {
    font-size: calc(var(--text-3xl) * 1.6);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .ra-kind {
    white-space: nowrap;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  [data-final="true"] .ra-kind {
    background: var(--accent);
    color: var(--on-accent);
  }

  .ra-body {
    display: grid;
    align-content: end;
    gap: var(--space-2);
    padding: var(--space-4);
  }

  h3 {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: 800;
    line-height: 1.15;
    text-wrap: balance;
  }

  .ra-rule {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  .ra-lock {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .ra-act {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .ra-score {
    white-space: nowrap;
    font-size: var(--text-md);
    color: var(--set-dim);
  }

  .ra-score b {
    color: var(--foreground);
    font-size: var(--text-xl);
  }

  .ra-score[data-podium="true"] b {
    color: var(--success);
  }

  .ra-go {
    flex: none;
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

  [data-next="true"] .ra-go {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  .ra-table {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .ra-table ol {
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

  .ra-table li {
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

  .ra-table li span {
    color: var(--set-dim);
    font-variant-numeric: tabular-nums;
  }

  .ra-table li b {
    font-variant-numeric: tabular-nums;
  }

  .ra-table li[data-you="true"] {
    border-color: var(--primary);
  }

  .ra-table li[data-rival="true"] {
    border-color: var(--warning);
  }

  .ra-reset {
    flex: none;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .ra {
      gap: var(--space-3);
    }

    h2 {
      font-size: var(--text-3xl);
    }

    .ra-me {
      gap: var(--space-5);
    }

    dd {
      font-size: var(--text-2xl);
    }

    .ra-rival dd {
      font-size: var(--text-lg);
    }

    .ra-rail {
      grid-auto-columns: calc((100% - 2 * var(--space-3)) / 2.6);
      gap: var(--space-3);
    }

    .ra-rule,
    .ra-label,
    .ra-reset {
      display: none;
    }

    .ra-head,
    .ra-body {
      padding: var(--space-3);
    }

    .ra-n {
      font-size: var(--text-3xl);
    }

    h3 {
      font-size: var(--text-xl);
    }
  }
</style>
