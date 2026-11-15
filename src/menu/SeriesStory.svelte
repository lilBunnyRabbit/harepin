<script lang="ts">
  import SeriesCard from "./SeriesCard.svelte";
  import SeriesHead from "./SeriesHead.svelte";
  import SeriesStandings from "./SeriesStandings.svelte";
  import { event_score, next_event, place_text, step_focus, type SeriesView } from "./series-view";
  import { swipe } from "./series-swipe";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  let picked = $state<number | null>(null);
  const focus = $derived(picked ?? Math.max(next_event(season, progress, states), 0));
  const side = (k: number) => (k === 0 ? "front" : k === 1 ? "next" : k === -1 ? "prev" : k > 0 ? "far-next" : "far-prev");
</script>

<div class="st" data-series>
  <SeriesHead {season} {progress} {table} {onback} />

  <ol class="st-segs" aria-label="Season progress">
    {#each season.events as event, i (event.id)}
      {@const score = event_score(season, progress, event)}
      <li data-state={states[i]} aria-current={i === focus}>
        <button type="button" onclick={() => (picked = i)}>
          <span class="st-bar"></span>
          <span class="st-label">
            {#if states[i] === "locked"}<Icon name="icon-lock" />{/if}
            {score ? place_text(score) : event.final ? "Final" : `Event ${i + 1}`}
          </span>
        </button>
      </li>
    {/each}
  </ol>

  <ol class="st-stage" aria-label="Events" use:swipe={(dir) => (picked = step_focus(focus, dir, season.events.length))}>
    {#each season.events as event, i (event.id)}
      <li class="st-card" data-side={side(i - focus)}>
        <SeriesCard {event} n={i + 1} state={states[i]} score={event_score(season, progress, event)} front={i === focus} {onstart} onpick={() => (picked = i)} />
      </li>
    {/each}
  </ol>

  <div class="st-foot">
    <SeriesStandings {table} shape="row" />
    <button type="button" class="st-reset" onclick={onreset}>{done ? "Run it again" : "Start over"}</button>
  </div>
</div>

<style>
  .st {
    display: grid;
    overflow: clip;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    height: 100%;
    min-height: 20rem;
  }

  .st-segs {
    position: relative;
    justify-self: center;
    width: min(100%, 80rem);
    z-index: 100;
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .st-segs button {
    display: grid;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-1) 0;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    text-align: start;
    cursor: pointer;
  }

  .st-bar {
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--set-line);
  }

  .st-label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    --icon-size: 1em;
  }

  [data-state="podium"] .st-bar {
    background: var(--primary);
  }

  [data-state="podium"] button,
  [data-state="open"] button {
    color: var(--foreground);
  }

  [aria-current="true"] .st-bar {
    background: var(--foreground);
  }

  .st-stage {
    position: relative;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    container-type: size;
    perspective: 140cqw;
    touch-action: pan-y;
  }

  .st-card {
    --w: min(52cqw, 150cqh);
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--w);
    aspect-ratio: 16 / 10;
    transform: translate(-50%, -50%);
    transition:
      transform 550ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 400ms;
  }

  [data-side="next"],
  [data-side="far-next"] {
    transform-origin: 0% 50%;
    transform: translate(-50%, -50%) translateX(calc(100% + 2cqw)) rotateY(-62deg);
  }

  [data-side="prev"],
  [data-side="far-prev"] {
    transform-origin: 100% 50%;
    transform: translate(-50%, -50%) translateX(calc(-100% - 2cqw)) rotateY(62deg);
  }

  [data-side="far-next"] {
    transform: translate(-50%, -50%) translateX(calc(100% + 2cqw)) rotateY(-100deg);
  }

  [data-side="far-prev"] {
    transform: translate(-50%, -50%) translateX(calc(-100% - 2cqw)) rotateY(100deg);
  }

  [data-side^="far"] {
    opacity: 0;
    pointer-events: none;
  }

  [data-side="next"],
  [data-side="prev"] {
    filter: brightness(0.75);
  }

  .st-foot {
    position: relative;
    justify-self: center;
    width: min(100%, 80rem);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .st-foot :global(.ss) {
    flex: 1;
  }

  .st-reset {
    flex: none;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  @media (max-height: 500px) {
    .st {
      gap: var(--space-2);
    }

    .st-reset {
      display: none;
    }
  }
</style>
