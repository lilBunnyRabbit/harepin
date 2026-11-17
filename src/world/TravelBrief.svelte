<script lang="ts">
  import { CARS } from "../car/cars";
  import { rating } from "../car/pi";
  import { MAX_EVENT_STARS } from "../career/career";
  import { PICTURE_SIDE } from "../hud/minimap";
  import CarStill from "../menu/CarStill.svelte";
  import { free_enter } from "../menu/enter-key";
  import { thumb_url } from "../menu/map-thumb";
  import Chip from "../menu/ui/Chip.svelte";
  import ClassBadge from "../menu/ui/ClassBadge.svelte";
  import PageFrame from "../menu/ui/PageFrame.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import Progress from "../menu/ui/Progress.svelte";
  import { brief_of } from "./brief";
  import type { BriefView } from "./travel-brief.svelte";

  interface Props {
    view: BriefView;
    onstart: () => void;
  }

  let { view, onstart }: Props = $props();

  const travel = $derived(view.travel);
  const facts = $derived(brief_of(travel));
  let map = $state<string>();

  $effect(() => {
    thumb_url(travel.map, PICTURE_SIDE).then(
      (url) => (map = url),
      (error: unknown) => console.warn("travel: no map picture", error),
    );
  });

  function key(press: KeyboardEvent) {
    if (!free_enter(press) || !view.ready) return;
    // The chat opens on Enter too, in the capture phase of the same window: this listener is older, so it stops there.
    press.preventDefault();
    press.stopImmediatePropagation();
    onstart();
  }
</script>

<svelte:window onkeydowncapture={key} />

<section class="travel" aria-label={`Travelling to ${travel.to}`}>
  <PageFrame eyebrow={travel.from ? `Travelling · ${travel.from} to` : "Travelling to"} title={travel.to} note={view.ready ? undefined : "Lights up when the map is ready."}>
    <div class="travel-body">
      <div class="travel-brief">
        <span class="travel-eyebrow">{facts.eyebrow}</span>
        <h2>{facts.name}</h2>
        {#if facts.goal}<p class="travel-goal">{facts.goal}</p>{/if}
        {#if facts.marks.length}
          <div class="travel-marks">
            {#each facts.marks as mark (mark.stars)}
              <span class="travel-mark" aria-label={`${mark.stars} of ${MAX_EVENT_STARS} stars: ${mark.text}`}><Chip inner><i>{"★".repeat(mark.stars)}</i><span>{mark.text}</span></Chip></span>
            {/each}
          </div>
        {/if}
        {#if facts.specs.length}
          <dl class="travel-specs">
            {#each facts.specs as spec (spec.label)}
              <div><dt class="travel-eyebrow">{spec.label}</dt><dd>{spec.value}</dd></div>
            {/each}
          </dl>
        {/if}
        <div class="travel-car">
          <CarStill car={facts.lent?.car ?? view.build.car} />
          <div class="travel-car-text">
            {#if facts.lent}
              <b>{facts.lent.name}</b>
            {:else}
              <b>{CARS[view.build.car].name}<ClassBadge rating={rating(view.build)} /></b>
            {/if}
            <small>{facts.start}</small>
          </div>
        </div>
      </div>

      <div class="travel-map" role="img" aria-label={`Map of ${travel.to}`}>
        {#if map}<img src={map} alt="" />{/if}
      </div>

      <div class="travel-load">
        <b>{view.step.label}</b>
        <Progress value={view.step.share} max={1} label={`Building ${travel.to}`} />
      </div>
    </div>

    {#snippet primary()}
      <PrimaryAction disabled={!view.ready} onclick={onstart}>Start</PrimaryAction>
    {/snippet}
  </PageFrame>
</section>

<style>
  .travel {
    position: absolute;
    inset: 0;
    font-family: var(--font-sans);
    text-align: left;
  }

  .travel-body {
    display: grid;
    grid-template: minmax(0, 1fr) auto / minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
  }

  .travel-brief {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: var(--gap-md);
    min-width: 0;
  }

  .travel-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: var(--display-1);
    font-weight: 800;
    line-height: 1.05;
    text-wrap: balance;
  }

  .travel-goal {
    max-width: 30em;
    margin: 0;
    color: var(--dim);
    font-weight: 600;
  }

  .travel-marks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .travel-mark i {
    color: var(--cottontail);
    font-style: normal;
  }

  .travel-mark span {
    font-family: var(--font-mono);
  }

  .travel-specs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm) var(--pad);
    margin: 0;
  }

  .travel-specs div {
    display: grid;
    gap: var(--gap-xs);
  }

  .travel-specs dd {
    margin: 0;
    font-weight: 700;
  }

  .travel-car {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    padding: var(--gap-sm) var(--gap-md) var(--gap-sm) var(--gap-sm);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .travel-car > :global(.still) {
    flex: none;
    width: 6.5rem;
  }

  .travel-car-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .travel-car-text b {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    font-size: var(--type-h3);
    font-weight: 800;
    line-height: 1.15;
  }

  .travel-car-text small {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .travel-map,
  .travel-load {
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .travel-map {
    display: grid;
    min-height: 0;
    overflow: hidden;
  }

  .travel-map img {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: cover;
  }

  .travel-load {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(8em, auto) minmax(0, 1fr);
    align-items: center;
    gap: var(--gap);
    padding: var(--gap-md) var(--pad);
    white-space: nowrap;
  }

  @media (max-height: 500px) {
    .travel-body {
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    }

    .travel-brief {
      gap: var(--gap-sm);
    }

    .travel-goal {
      display: none;
    }

    .travel-car > :global(.still) {
      width: 4.25rem;
    }
  }
</style>
