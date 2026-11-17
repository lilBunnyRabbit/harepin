<script lang="ts">
  import { ADJUST_EVENT } from "./dom";
  import SeriesCard from "./SeriesCard.svelte";
  import SeriesHead from "./SeriesHead.svelte";
  import SeriesSeasons from "./SeriesSeasons.svelte";
  import SeriesStandings from "./SeriesStandings.svelte";
  import { event_score, next_event, place_text, reward_line, round_line, step_focus, terms_line, type SeriesView } from "./series-view";
  import { swipe } from "./series-swipe";
  import Icon from "./ui/Icon.svelte";

  interface SnapEvent extends Event {
    snapTargetInline: Element | null;
  }

  let { season, progress, states, table, done, wallet, onstart, onfront, onreset, seasons, at, onseason, lock }: SeriesView = $props();

  const round = $derived(round_line(progress));

  let strip = $state<HTMLOListElement>();
  let focus = $state(0);
  const last = $derived(season.events.length);

  function show(i: number, behavior: ScrollBehavior = "smooth") {
    strip?.children[i]?.scrollIntoView({ inline: "center", block: "nearest", behavior });
  }

  $effect(() => onfront?.(focus));

  const step = (dir: 1 | -1) => show(step_focus(focus, dir, last + 1));

  function start_front() {
    const event = season.events[focus];
    if (!event || states[focus] === "locked") return;
    onstart(event.id);
  }

  $effect(() => {
    const start = Math.max(next_event(season, progress, states), 0);
    focus = start;
    requestAnimationFrame(() => show(start, "instant"));
  });

  // The strip is the one focus stop for the pad and arrow keys: left / right arrive as the menu's adjust event, A as a
  // click with no pointer behind it (detail 0), Enter as a key.
  $effect(() => {
    if (!strip) return;
    const node = strip;
    const snapped = (e: Event) => {
      const target = (e as SnapEvent).snapTargetInline;
      if (target instanceof HTMLElement) focus = Number(target.dataset.i);
    };
    const adjust = (e: Event) => step((e as CustomEvent<number>).detail > 0 ? 1 : -1);
    node.addEventListener("scrollsnapchange", snapped);
    node.addEventListener(ADJUST_EVENT, adjust);
    return () => {
      node.removeEventListener("scrollsnapchange", snapped);
      node.removeEventListener(ADJUST_EVENT, adjust);
    };
  });

  function pressed(e: MouseEvent) {
    if (e.target === e.currentTarget && e.detail === 0) start_front();
  }

  function key(e: KeyboardEvent) {
    if (e.target !== e.currentTarget || e.key !== "Enter") return;
    e.preventDefault();
    start_front();
  }
</script>

<div class="fl" data-series>
  <SeriesHead {season} {progress} {table} credits={wallet.credits}>
    {#snippet title()}<SeriesSeasons {seasons} {at} {onseason} />{/snippet}
    {terms_line(season)}{#if round} · {round}{/if}
  </SeriesHead>

  <div class="fl-stage">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events: the strip is the pad's focus stop; its cards' buttons are click targets only -->
    <ol class="fl-strip" aria-label="Events" tabindex="0" data-adjust bind:this={strip} use:swipe={step} onclick={pressed} onkeydown={key}>
      {#each season.events as event, i (event.id)}
        <li data-i={i}>
          <div class="fl-card">
            <SeriesCard {event} n={i + 1} state={states[i]} score={event_score(season, progress, event)} front={i === focus} reward={event.final ? reward_line(season, wallet, progress) : null} {lock} onpick={() => (i === focus ? start_front() : show(i))} />
          </div>
        </li>
      {/each}
      <li data-i={last}>
        <div class="fl-card fl-table" data-front={focus === last}>
          <h3>Standings</h3>
          <SeriesStandings {table} />
          {#if !lock}<button type="button" class="fl-reset" tabindex={focus === last ? 0 : -1} onclick={onreset}>{done ? "Run it again" : "Start over"}</button>{/if}
          <button type="button" class="fl-pick" tabindex="-1" aria-label="Show standings" onclick={() => show(last)}></button>
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
    <li class="fl-rail-table" aria-current={focus === last}>
      <button type="button" onclick={() => show(last)}>Table</button>
    </li>
  </ol>
</div>

<style>
  .fl {
    display: grid;
    overflow: clip;
    overflow-clip-margin: var(--space-1);
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
    /* One step holds half the front card and half a turned one (0.75 of it, at most 0.86 with perspective) plus a gap.
       Both poses blend linearly over one step, so through a swipe the two half widths sum to the same: no card ever
       reaches over its neighbour. */
    --step: calc(var(--w) * 0.86 + var(--space-4));
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
  }

  .fl-strip:focus-visible {
    outline: none;
  }

  .fl-strip:focus-visible :is(:global(.sc[data-front="true"]), .fl-table[data-front="true"]) {
    outline: 3px solid var(--foreground);
    outline-offset: 3px;
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
    position: relative;
    flex: none;
    width: var(--w);
    aspect-ratio: 4 / 5;
    max-height: 98cqh;
    animation: flow linear both;
    animation-timeline: --card;
    animation-range: cover calc(50% - var(--step)) cover calc(50% + var(--step));
  }

  /* Transform and opacity only, so the flow runs on the compositor while the scene renders behind: an animated
     z-index or filter puts every card back on the main thread each scroll frame. */
  .fl-card::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
    background: var(--background-darkest);
    pointer-events: none;
    animation: shade linear both;
    animation-timeline: --card;
    animation-range: cover calc(50% - var(--step)) cover calc(50% + var(--step));
  }

  @keyframes shade {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0;
    }
  }

  @keyframes flow {
    0% {
      transform: perspective(160cqh) rotateY(-35deg) scale(0.75);
    }
    50% {
      transform: none;
    }
    100% {
      transform: perspective(160cqh) rotateY(35deg) scale(0.75);
    }
  }

  .fl-table {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--space-3);
    padding: max(var(--space-4), 6cqmin);
    container-type: size;
    border: 2px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .fl-table[data-front="true"] {
    border-color: var(--primary);
  }

  .fl-table h3 {
    margin: 0;
    font-size: max(var(--text-xl), 8cqmin);
  }

  .fl-table :global(.ss) {
    font-size: max(var(--text-md), 5cqmin);
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

  .fl-table[data-front="true"] .fl-pick {
    visibility: hidden;
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

  /* Portrait: the front card takes most of the width, and the rail drops its links to fit every round. */
  @media (max-width: 700px) {
    .fl-strip {
      --w: min(78cqh, 68cqw);
    }

    .fl-rail {
      gap: var(--gap-xs);
    }

    .fl-rail li:not(:last-child)::after {
      display: none;
    }

    .fl-rail-table button {
      padding: 0 var(--gap-md);
    }
  }
</style>
