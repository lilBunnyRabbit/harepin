<script lang="ts">
  import SeriesCard from "./SeriesCard.svelte";
  import SeriesHead from "./SeriesHead.svelte";
  import SeriesStandings from "./SeriesStandings.svelte";
  import { event_score, next_event, place_text, step_focus, type SeriesView } from "./series-view";
  import { swipe } from "./series-swipe";
  import Icon from "./ui/Icon.svelte";

  interface SnapEvent extends Event {
    snapTargetInline: Element | null;
  }

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  let strip = $state<HTMLOListElement>();
  let focus = $state(0);
  const slots = $derived(season.events.length + 1);

  function show(i: number, behavior: ScrollBehavior = "smooth") {
    strip?.children[i]?.scrollIntoView({ inline: "center", block: "nearest", behavior });
  }

  $effect(() => {
    const start = Math.max(next_event(season, progress, states), 0);
    focus = start;
    requestAnimationFrame(() => show(start, "instant"));
  });

  $effect(() => {
    if (!strip) return;
    const node = strip;
    const snapped = (e: Event) => {
      const target = (e as SnapEvent).snapTargetInline;
      if (target instanceof HTMLElement) focus = Number(target.dataset.i);
    };
    node.addEventListener("scrollsnapchange", snapped);
    return () => node.removeEventListener("scrollsnapchange", snapped);
  });
</script>

<div class="fl" data-series>
  <SeriesHead {season} {progress} {table} {onback} />

  <div class="fl-stage">
  <ol class="fl-strip" aria-label="Events" bind:this={strip} use:swipe={(dir) => show(step_focus(focus, dir, slots))}>
    {#each season.events as event, i (event.id)}
      <li data-i={i}>
        <div class="fl-card">
          <SeriesCard {event} n={i + 1} state={states[i]} score={event_score(season, progress, event)} front={i === focus} {onstart} onpick={() => show(i)} />
        </div>
      </li>
    {/each}
    <li data-i={season.events.length}>
      <div class="fl-card fl-table">
        <h3>Standings</h3>
        <SeriesStandings {table} shape="tower" />
        <button type="button" class="fl-reset" onclick={onreset}>{done ? "Run it again" : "Start over"}</button>
        {#if focus !== season.events.length}<button type="button" class="fl-pick" aria-label="Show standings" onclick={() => show(season.events.length)}></button>{/if}
      </div>
    </li>
  </ol>
  </div>

  <ol class="fl-rail" aria-label="Season progress">
    {#each season.events as event, i (event.id)}
      {@const score = event_score(season, progress, event)}
      <li data-state={states[i]} aria-current={i === focus}>
        <button type="button" onclick={() => show(i)} aria-label={event.name}>
          {#if states[i] === "locked"}<Icon name="icon-lock" />{:else}{score ? place_text(score) : i + 1}{/if}
        </button>
      </li>
    {/each}
    <li class="fl-rail-table" aria-current={focus === season.events.length}>
      <button type="button" onclick={() => show(season.events.length)}>Table</button>
    </li>
  </ol>
</div>

<style>
  .fl {
    display: grid;
    overflow: clip;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    height: 100%;
    min-height: 20rem;
  }

  .fl-stage {
    min-height: 0;
    container-type: size;
  }

  .fl-strip {
    --w: min(78cqh, 34cqw);
    --step: calc(var(--w) * 0.52);
    display: flex;
    align-items: center;
    height: 100%;
    margin: 0;
    padding: 0 calc(50% - var(--step) / 2);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    list-style: none;
    touch-action: pan-x;
  }

  .fl-strip li {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--step);
    height: 100%;
    scroll-snap-align: center;
    view-timeline: --card inline;
  }

  .fl-card {
    flex: none;
    width: var(--w);
    aspect-ratio: 4 / 5;
    max-height: 98cqh;
    animation: flow linear both;
    animation-timeline: --card;
  }

  @keyframes flow {
    0% {
      z-index: 1;
      transform: perspective(160cqh) translateX(-30%) rotateY(-42deg) scale(0.72);
      filter: brightness(0.6);
    }
    40% {
      z-index: 5;
      transform: perspective(160cqh) translateX(-8%) rotateY(-30deg) scale(0.8);
      filter: brightness(0.75);
    }
    50% {
      z-index: 10;
      transform: none;
      filter: none;
    }
    60% {
      z-index: 5;
      transform: perspective(160cqh) translateX(8%) rotateY(30deg) scale(0.8);
      filter: brightness(0.75);
    }
    100% {
      z-index: 1;
      transform: perspective(160cqh) translateX(30%) rotateY(42deg) scale(0.72);
      filter: brightness(0.6);
    }
  }

  .fl-table {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 2px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .fl-table h3 {
    margin: 0;
    font-size: var(--text-xl);
  }

  .fl-table :global(.ss) {
    border: 0;
    padding: 0;
    background: none;
  }

  .fl-reset {
    justify-self: start;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .fl-pick {
    position: absolute;
    inset: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .fl-rail {
    position: relative;
    z-index: 20;
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .fl-rail li {
    display: flex;
    align-items: center;
  }

  .fl-rail li:not(:last-child)::after {
    content: "";
    width: var(--space-3);
    height: 2px;
    margin-left: var(--space-2);
    background: var(--set-line);
  }

  .fl-rail li[data-state="podium"]::after {
    background: var(--primary);
  }

  .fl-rail button {
    display: grid;
    place-items: center;
    min-width: var(--control-h);
    height: var(--control-h);
    padding: 0 var(--space-2);
    border: 2px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 800;
    cursor: pointer;
  }

  .fl-rail [data-state="podium"] button {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--on-primary);
  }

  .fl-rail [data-state="open"] button {
    color: var(--foreground);
  }

  .fl-rail [aria-current="true"] button {
    outline: 2px solid var(--foreground);
    outline-offset: 2px;
  }

  .fl-rail-table button {
    padding: 0 var(--space-4);
  }
</style>
