<script lang="ts">
  import SeriesCard from "./SeriesCard.svelte";
  import SeriesHead from "./SeriesHead.svelte";
  import SeriesStandings from "./SeriesStandings.svelte";
  import { event_score, next_event, step_focus, type SeriesView } from "./series-view";
  import { swipe } from "./series-swipe";

  const SPREAD = 7;
  const GAP = 6;

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  let picked = $state<number | null>(null);
  const focus = $derived(picked ?? Math.max(next_event(season, progress, states), 0));
  const angle = (k: number) => k * SPREAD + Math.sign(k) * GAP;
</script>

<div class="hd" data-series>
  <SeriesHead {season} {progress} {table} {onback} />
  <div class="hd-table">
    <SeriesStandings {table} shape="row" />
    <button type="button" class="hd-reset" onclick={onreset}>{done ? "Run it again" : "Start over"}</button>
  </div>

  <ol class="hd-fan" aria-label="Events" use:swipe={(dir) => (picked = step_focus(focus, dir, season.events.length))}>
    {#each season.events as event, i (event.id)}
      <li class="hd-card" style:--a={`${angle(i - focus)}deg`} style:z-index={i === focus ? 50 : 20 + i} data-front={i === focus}>
        <SeriesCard {event} n={i + 1} state={states[i]} score={event_score(season, progress, event)} front={i === focus} {onstart} onpick={() => (picked = i)} />
      </li>
    {/each}
  </ol>
</div>

<style>
  .hd {
    display: grid;
    overflow: clip;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: var(--space-3);
    height: 100%;
    min-height: 20rem;
  }

  .hd-table {
    position: relative;
    justify-self: center;
    width: min(100%, 80rem);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .hd-table :global(.ss) {
    flex: 1;
  }

  .hd-reset {
    flex: none;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .hd-fan {
    position: relative;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    container-type: size;
    perspective: 140cqh;
    perspective-origin: 50% 0%;
    touch-action: pan-y;
  }

  .hd-card {
    --w: min(66cqh, 26cqw);
    position: absolute;
    bottom: 0;
    left: 50%;
    width: var(--w);
    aspect-ratio: 4 / 5;
    transform-origin: 50% 320%;
    transform: translateX(-50%) translateY(46%) rotate(var(--a)) rotateX(14deg);
    transition: transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .hd-card[data-front="true"] {
    transform-origin: 50% 100%;
    transform: translateX(-50%) translateY(-2%) rotate(0deg) scale(1.15);
  }

  @media (max-height: 500px) {
    .hd-reset {
      display: none;
    }
  }
</style>
