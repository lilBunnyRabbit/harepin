<script lang="ts">
  import SeriesCard from "./SeriesCard.svelte";
  import SeriesHead from "./SeriesHead.svelte";
  import SeriesStandings from "./SeriesStandings.svelte";
  import { event_score, next_event, place_text, step_focus, type SeriesView } from "./series-view";
  import { swipe } from "./series-swipe";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  let picked = $state<number | null>(null);
  const focus = $derived(picked ?? Math.max(next_event(season, progress, states), 0));
</script>

<div class="ah" data-series>
  <SeriesHead {season} {progress} {table} {onback}>
    <ol class="ah-pips" aria-label="Season progress">
      {#each season.events as event, i (event.id)}
        {@const score = event_score(season, progress, event)}
        <li data-state={states[i]} aria-current={i === focus}>
          <button type="button" onclick={() => (picked = i)} aria-label={event.name}>{score ? place_text(score) : i + 1}</button>
        </li>
      {/each}
    </ol>
  </SeriesHead>

  <div class="ah-body">
    <ol class="ah-road" aria-label="Events" use:swipe={(dir) => (picked = step_focus(focus, dir, season.events.length))}>
      {#each season.events as event, i (event.id)}
        <li class="ah-card" style:--k={i - focus} data-past={i < focus} data-front={i === focus} style:z-index={50 - Math.abs(i - focus)}>
          <SeriesCard {event} n={i + 1} state={states[i]} score={event_score(season, progress, event)} front={i === focus} {onstart} onpick={() => (picked = i)} />
        </li>
      {/each}
    </ol>
    <aside class="ah-tower">
      <SeriesStandings {table} shape="tower" />
      <button type="button" class="ah-reset" onclick={onreset}>{done ? "Run it again" : "Start over"}</button>
    </aside>
  </div>
</div>

<style>
  .ah {
    display: grid;
    overflow: clip;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-3);
    height: 100%;
    min-height: 20rem;
  }

  .ah-pips {
    display: flex;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ah-pips button {
    min-width: var(--control-h);
    height: var(--control-h-sm);
    padding: 0 var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 800;
    cursor: pointer;
  }

  .ah-pips [data-state="podium"] button {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  .ah-pips [data-state="open"] button {
    color: var(--foreground);
  }

  .ah-pips [aria-current="true"] button {
    outline: 2px solid var(--foreground);
    outline-offset: 2px;
  }

  .ah-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-4);
    min-height: 0;
  }

  .ah-road {
    position: relative;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    container-type: size;
    perspective: 120cqw;
    perspective-origin: 70% 30%;
    touch-action: pan-y;
  }

  .ah-card {
    --w: min(76cqh, 40cqw);
    position: absolute;
    top: 50%;
    left: calc(var(--w) / 2);
    width: var(--w);
    aspect-ratio: 4 / 5;
    max-height: 100cqh;
    transform: translate(-50%, -50%) translate3d(calc(var(--k) * 62%), calc(var(--k) * -6%), calc(var(--k) * -34cqw));
    transition:
      transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 300ms,
      filter 300ms;
  }

  .ah-card:not([data-front="true"]) {
    filter: brightness(0.8);
  }

  .ah-card[data-past="true"] {
    transform: translate(-50%, -50%) translate3d(calc(-70% + var(--k) * 20%), 18%, -20cqw) rotateY(35deg);
    opacity: 0.55;
  }

  .ah-tower {
    display: grid;
    align-content: center;
    justify-items: stretch;
    gap: var(--space-3);
  }

  .ah-reset {
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .ah-reset {
      display: none;
    }
  }
</style>
