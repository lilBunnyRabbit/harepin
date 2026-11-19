<script lang="ts">
  import { KIND_NAMES, KIND_RULES, type EventState, type SeriesEvent } from "../career/series";
  import { event_art, lock_line, place_text, type EventScore } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  interface Props {
    event: SeriesEvent;
    n: number;
    state: EventState;
    score: EventScore | null;
    front: boolean;
    /** The final's prize line; null on every other event. */
    reward?: string | null;
    /** Shown on a locked card in place of what opens the event: a shut season's reason. */
    lock?: string | null;
    onpick?: () => void;
  }

  let { event, n, state, score, front, reward = null, lock = null, onpick }: Props = $props();
</script>

<article class="sc" data-state={state} data-front={front} data-final={event.final === true}>
  <img src={event_art(event)} alt="" draggable="false" />
  <div class="sc-shade"></div>
  <header>
    <span class="sc-n">{String(n).padStart(2, "0")}</span>
    <span class="sc-kind">{event.final ? "Final" : KIND_NAMES[event.kind]}</span>
  </header>
  {#if score}<span class="sc-stamp" data-podium={state === "podium"}>{place_text(score)}</span>{/if}
  <div class="sc-body">
    <h3>{event.name}</h3>
    {#if reward}<span class="sc-reward"><Icon name="icon-car" />{reward}</span>{/if}
    <p class="sc-front">{KIND_RULES[event.kind]}</p>
    {#if state === "locked"}
      <span class="sc-lock"><Icon name="icon-lock" />{lock ?? lock_line(event)}</span>
    {:else if score}
      <span class="sc-pts">{score.points} pts</span>
    {/if}
  </div>
  {#if onpick}<button type="button" class="sc-pick" tabindex="-1" aria-label={front && state !== "locked" ? `Race ${event.name}` : `Show ${event.name}`} onclick={onpick}></button>{/if}
</article>

<style>
  .sc {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    width: 100%;
    height: 100%;
    padding: max(var(--gap-md), 6cqmin);
    overflow: hidden;
    container-type: size;
    border: 2px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--row);
    box-shadow: var(--shadow);
    user-select: none;
  }

  .sc[data-front="true"] {
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

  .sc-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to bottom, color-mix(in oklch, var(--background-darkest) 70%, transparent) 0%, transparent 28%),
      linear-gradient(to top, var(--background-darkest) 0%, color-mix(in oklch, var(--background-darkest) 55%, transparent) 40%, transparent 65%);
  }

  header,
  .sc-body {
    position: relative;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: var(--gap-sm);
  }

  .sc-n {
    font-size: max(var(--type-h2), 16cqmin);
    font-weight: 800;
    line-height: 0.9;
  }

  .sc-kind {
    padding: var(--gap-xs) var(--gap-sm);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  [data-final="true"] .sc-kind {
    background: var(--accent);
    color: var(--on-accent);
  }

  .sc-stamp {
    position: absolute;
    top: 32%;
    right: max(var(--gap-md), 6cqmin);
    display: grid;
    place-items: center;
    width: max(var(--control-h), 22cqmin);
    aspect-ratio: 1;
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: max(var(--type-body), 7cqmin);
    font-weight: 800;
    rotate: -8deg;
  }

  .sc-stamp[data-podium="true"] {
    background: var(--success);
    color: var(--background-darkest);
  }

  .sc-body {
    display: grid;
    align-self: end;
    gap: var(--gap-sm);
  }

  h3 {
    margin: 0;
    font-size: max(var(--type-body), 10cqmin);
    font-weight: 800;
    line-height: 1.05;
    text-wrap: balance;
  }

  p {
    margin: 0;
    color: var(--dim);
    font-size: max(var(--type-small), 4.5cqmin);
    text-wrap: pretty;
  }

  .sc-reward {
    --icon-size: 1em;
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: var(--gap-sm);
    padding: var(--gap-xs) var(--gap-md);
    border-radius: var(--radius-full);
    background: var(--accent);
    color: var(--on-accent);
    font-size: max(var(--type-small), 4.5cqmin);
    font-weight: 800;
    white-space: nowrap;
  }

  .sc-lock {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
  }

  .sc-lock {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .sc-pts {
    color: var(--dim);
    font-weight: 700;
    white-space: nowrap;
  }

  @container (max-height: 14rem) {
    p {
      display: none;
    }
  }

  /* Every card lays out the front card's lines and buttons, shown only on the front one: a snap then changes paint, not
     layout, and a layout of this page costs a whole frame on a slow phone. Titles sit at one height along the rail. */
  [data-front="false"] .sc-front {
    visibility: hidden;
  }

  .sc-pick {
    position: absolute;
    inset: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }
</style>
