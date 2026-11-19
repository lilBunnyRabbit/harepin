<script lang="ts">
  import { car_shelves } from "../car/car-pick";
  import { load_builds } from "../car/builds";
  import { CARS } from "../car/cars";
  import { rating } from "../car/pi";
  import { open_presets } from "../career/rewards";
  import { CAR_PAGE, type CarPicker } from "./car-pick.svelte";
  import CarStill from "./CarStill.svelte";
  import { bare_enter, link_key } from "./drive-picks";
  import { car_fit, go_line, start_target, start_view, target_name, type StartTarget } from "./events-view";
  import type { Menu } from "./page";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PageFrame from "./ui/PageFrame.svelte";
  import PlaceLine from "./ui/PlaceLine.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import { menu_state } from "./ui/svelte-page.svelte";
  import "./events.css";

  interface Props {
    menu: Menu;
    picker: CarPicker;
    target: StartTarget;
    eyebrow?: string;
    title: string;
    shown: boolean;
    onclose: () => void;
    /** Opens the Garage, whose Back returns to this sheet; unset, the sheet offers no way there. */
    ongarage?: () => void;
  }

  let { menu, picker, target, eyebrow, title, shown, onclose, ongarage }: Props = $props();

  const live = $derived(menu_state(menu));
  const host = $derived(menu.host);
  const here = $derived({ kind: host.kind, seed: host.seed, levels: host.levels });
  const view = $derived(start_view(target, here));
  const go = $derived(go_line(view, target_name(target)));

  const build = $derived(live.live(() => host.garage.build));
  const shelves = $derived(view.limit ? car_shelves(build, load_builds(), open_presets(host.garage.held_cars), view.limit) : []);
  const mine = $derived(shelves.flatMap((shelf) => shelf.choices).find((choice) => choice.fitted) ?? null);
  const rated = $derived(rating(build));
  const fit = $derived(car_fit(rated, view.limit, mine?.blocked ?? null));
  const garage = $derived(view.lent ? undefined : ongarage);

  async function start() {
    if (!view.limit) return finish(null);
    const asked = picker.open({ title: view.title, limit: view.limit_text, shelves, note: go.note, back: view.title });
    menu.show(CAR_PAGE);
    const code = await asked;
    if (code) finish(code);
  }

  function finish(car: string | null) {
    // onclose clears the parent's target, which this prop reads.
    const picked = target;
    onclose();
    start_target(host, picked, car);
  }

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented) return;
    if (garage && link_key(event) === "g") return garage();
    if (!bare_enter(event)) return;
    event.preventDefault();
    void start();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet primary()}
  <PrimaryAction onclick={start}>{go.verb}</PrimaryAction>
{/snippet}

{#snippet links()}
  {#if garage}<KeyLink keys={{ key: "G" }} onclick={garage}>Garage</KeyLink>{/if}
{/snippet}

{#snippet shot()}
  <img class="ev-pic" src={view.img} alt="" />
{/snippet}

<PageFrame {eyebrow} {title} back={{ to: title, go: onclose }} {links} veil={0.82} note={go.note} {primary}>
  <div class="sheet start-sheet">
    <Card picture={shot} wide class="sheet-card" label={view.title}>
      <div class="ev-head">
        <span class="ev-eyebrow">{view.eyebrow}</span>
        <h2 class="ev-h1">{view.title}</h2>
        <PlaceLine place={view.place} tail={view.place.here ? "this map" : "another map"} />
      </div>
      {#if view.marks.length}
        <div class="sheet-marks">
          {#each view.marks as mark (mark.head)}
            <Chip inner><span class="sheet-mark-head">{mark.head}</span><span class="sheet-mark">{mark.text}</span></Chip>
          {/each}
        </div>
      {/if}
      {#if view.facts}<span class="ev-small">{view.facts}</span>{/if}
      <div class="sheet-car">
        {#if view.lent}
          <span class="sheet-lent ev-h3">{view.lent} car</span>
          <span class="ev-small sheet-fit">The event lends it</span>
        {:else}
          <span class="sheet-still"><CarStill car={build.car} {build} /></span>
          <span class="sheet-who">
            <span class="sheet-name">
              <b class="ev-h3 ev-nowrap">{CARS[build.car].name}</b>
              <ClassBadge rating={rated} />
              {#if view.limit?.cap}<span class="ev-small">cap</span><ClassBadge cap={view.limit.cap} />{/if}
            </span>
            {#if garage && fit.tune}
              <button type="button" class="ev-small sheet-fit sheet-tune" data-off={fit.off ? "" : undefined} onclick={garage}>{fit.text}</button>
            {:else}
              <span class="ev-small sheet-fit" data-off={fit.off ? "" : undefined}>{fit.text}</span>
            {/if}
          </span>
        {/if}
      </div>
    </Card>
  </div>
</PageFrame>

<style>
  .sheet {
    display: grid;
    place-items: center;
    height: 100%;
    min-height: 0;
  }

  .sheet > :global(.sheet-card) {
    width: min(600px, 100%);
    max-height: 100%;
  }

  .sheet > :global(.sheet-card > .ui-card-pic) {
    flex: 0 1 150px;
  }

  .sheet > :global(.sheet-card > .ui-card-cap) {
    gap: var(--gap);
  }

  .sheet-marks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .sheet-mark-head {
    color: var(--warning);
  }

  .sheet-mark {
    font-family: var(--font-mono);
  }

  .sheet-car {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    min-width: 0;
    padding: var(--gap-sm) var(--gap-md) var(--gap-sm) var(--gap-sm);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .sheet-still {
    display: grid;
    flex: none;
    width: 90px;
    height: 60px;
  }

  .sheet-still > :global(.still) {
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
  }

  .sheet-who {
    display: grid;
    flex: 1;
    justify-items: start;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .sheet-name {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .sheet-lent {
    flex: 1;
    padding-left: var(--gap-xs);
  }

  .sheet-lent + .sheet-fit {
    flex: none;
    text-align: right;
  }

  .sheet-who > .sheet-fit {
    text-align: left;
  }

  :root .sheet-tune {
    padding: 0;
    border: 0;
    background: none;
    color: var(--foreground);
    font: inherit;
    font-size: var(--type-small);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }

  .sheet-fit[data-off] {
    color: var(--foreground);
    font-weight: 700;
  }

  @media (max-height: 500px) {
    .sheet > :global(.sheet-card) {
      width: min(560px, 100%);
      height: 100%;
    }

    .sheet > :global(.sheet-card > .ui-card-pic) {
      flex: 0 0 30%;
    }

    .sheet > :global(.sheet-card > .ui-card-cap) {
      gap: var(--gap-sm);
    }

    .sheet-still {
      width: 60px;
      height: 40px;
    }
  }
</style>
