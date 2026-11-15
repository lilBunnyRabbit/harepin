<script lang="ts">
  import { KIND_NAMES, KIND_RULES, type EventState, type SeriesEvent } from "../career/series";
  import { event_art, lock_line, place_text, type CarNote, type EventScore } from "./series-view";
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
    /** Why the player's car can't race it: the card offers the garage in place of Race. */
    car?: CarNote | null;
    ongarage?: () => void;
    onstart: (id: string) => void;
    onpick?: () => void;
  }

  let { event, n, state, score, front, reward = null, lock = null, car = null, ongarage, onstart, onpick }: Props = $props();
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
    {#if !(car && state !== "locked")}<p class="sc-front">{KIND_RULES[event.kind]}</p>{/if}
    {#if state === "locked"}
      <span class="sc-lock"><Icon name="icon-lock" />{lock ?? lock_line(event)}</span>
    {:else if car}
      <p class="sc-car sc-front"><Icon name="icon-car" /><span>{car.why} <span class="sc-rule">{car.rule}</span></span></p>
      <div class="sc-act">
        <button type="button" class="sc-go sc-front" tabindex="-1" onclick={() => ongarage?.()}><Icon name="icon-car" />Change car</button>
      </div>
    {:else}
      <div class="sc-act">
        {#if score}<span class="sc-pts">{score.points} pts</span>{/if}
        <button type="button" class="sc-go sc-front" tabindex="-1" onclick={() => onstart(event.id)}><Icon name="icon-play" />{score ? "Again" : "Race"}</button>
      </div>
    {/if}
  </div>
  {#if onpick}<button type="button" class="sc-pick" tabindex="-1" aria-label={`Show ${event.name}`} onclick={onpick}></button>{/if}
</article>

<style>
  .sc {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    width: 100%;
    height: 100%;
    padding: max(var(--space-3), 6cqmin);
    overflow: hidden;
    container-type: size;
    border: 2px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
    box-shadow: var(--panel-shadow);
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
    align-items: start;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .sc-n {
    font-size: max(var(--text-2xl), 16cqmin);
    font-weight: 800;
    line-height: 0.9;
  }

  .sc-kind {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-xs);
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
    right: max(var(--space-3), 6cqmin);
    display: grid;
    place-items: center;
    width: max(var(--control-h), 22cqmin);
    aspect-ratio: 1;
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: max(var(--text-md), 7cqmin);
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
    gap: var(--space-2);
  }

  h3 {
    margin: 0;
    font-size: max(var(--text-lg), 10cqmin);
    font-weight: 800;
    line-height: 1.05;
    text-wrap: balance;
  }

  p {
    margin: 0;
    color: var(--set-dim);
    font-size: max(var(--text-sm), 4.5cqmin);
    text-wrap: pretty;
  }

  .sc-reward {
    --icon-size: 1em;
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--accent);
    color: var(--on-accent);
    font-size: max(var(--text-sm), 4.5cqmin);
    font-weight: 800;
    white-space: nowrap;
  }

  .sc-car {
    --icon-size: 1.1em;
    display: flex;
    align-items: start;
    gap: var(--space-2);
    color: var(--warning);
    font-weight: 700;
    text-shadow:
      0 0 2px var(--background-darkest),
      0 1px 8px var(--background-darkest);
  }

  .sc-car :global(svg) {
    flex: none;
    margin-top: 0.1em;
  }

  .sc-lock,
  .sc-act {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sc-lock {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .sc-act {
    justify-content: space-between;
  }

  .sc-pts {
    color: var(--set-dim);
    font-weight: 700;
    white-space: nowrap;
  }

  .sc-go {
    --icon-size: 1em;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: max(var(--control-h-lg), 18cqmin);
    margin-left: auto;
    padding: 0 max(var(--space-5), 9cqmin);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-size: max(var(--text-lg), 6.5cqmin);
    font-weight: 800;
    cursor: pointer;
  }

  @container (max-height: 14rem) {
    p:not(.sc-car),
    .sc-rule {
      display: none;
    }
  }

  /* Every card lays out the front card's lines and buttons, shown only on the front one: a snap then changes paint, not
     layout, and a layout of this page costs a whole frame on a slow phone. Titles sit at one height along the rail. */
  [data-front="false"] .sc-front,
  [data-front="true"] .sc-pick {
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
