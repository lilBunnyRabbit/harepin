<script lang="ts">
  import { onMount } from "svelte";
  import { CARS } from "../car/cars";
  import { car_facts } from "./car-facts";
  import CarFactsLine from "./CarFactsLine.svelte";
  import type { Garage } from "./garage.svelte";
  import GarageBuilds from "./GarageBuilds.svelte";
  import GarageHint from "./GarageHint.svelte";
  import { TABS, slot_icon } from "./garage-items";
  import GarageMeters from "./GarageMeters.svelte";
  import GarageStrip from "./GarageStrip.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Tabs from "./ui/Tabs.svelte";
  import Tile from "./ui/Tile.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends PageProps {
    garage: Garage;
  }

  let { garage, shown }: Props = $props();

  const SECTIONS = TABS.map((tab) => ({ id: tab.section, label: tab.label }));

  let canvas: HTMLCanvasElement;
  let top: HTMLElement;
  let rail = $state<HTMLElement | null>(null);
  let stats: HTMLElement;
  let bottom: HTMLElement;

  const section = $derived(TABS[garage.tab].section);
  const facts = $derived(car_facts(garage.shown));
  const items = $derived(garage.items);
  const slots = $derived(items.map((item) => ({ id: item.id, label: item.label })));

  onMount(() => {
    garage.attach({ canvas, panels: () => [top, rail, stats, bottom].filter((panel) => !!panel), sheet: () => rail });
  });

  $effect(() => {
    if (shown) garage.open();
    else garage.close();
  });

  $effect(() => {
    void garage.shown;
    garage.draw();
  });

  function pick_slot(id: string) {
    const item = items.find((it) => it.id === id);
    if (item) garage.select(item);
  }
</script>

<div class="garage" data-tab={section} data-input={garage.input} role="region" aria-label="Garage">
  <canvas class="garage-canvas" bind:this={canvas}></canvas>

  <header class="garage-top" bind:this={top}>
    <div class="garage-name">
      <SectionHead title={CARS[garage.shown.car].name} level={2} />
      <span class="garage-facts"><CarFactsLine {facts} words /></span>
    </div>
    <div class="garage-sections">
      <span class="garage-step-hint"><GarageHint keys={["prev"]} /></span>
      <Tabs items={SECTIONS} value={section} label="Garage sections" compact onchange={(id) => garage.switch_tab(TABS.findIndex((tab) => tab.section === id))} />
      <span class="garage-step-hint"><GarageHint keys={["next"]} /></span>
    </div>
  </header>

  <section class="garage-panel garage-rail" class:garage-sheet={garage.on_builds} bind:this={rail} aria-label={garage.on_builds ? "My builds" : "Slots"}>
    {#if garage.on_builds}
      <ScrollArea class="garage-scroll">
        <div class="garage-sheet-body"><GarageBuilds {garage} sheet={rail} /></div>
      </ScrollArea>
    {:else}
      <div class="garage-slot-tabs">
        <Tabs items={slots} value={garage.item.id} label="Slots" onchange={pick_slot} />
      </div>
      <ScrollArea class="garage-scroll garage-slot-list">
        <ul class="garage-slots">
          {#each items as item (item.id)}
            <li>
              <Tile
                size="sm"
                icon={slot_icon(item.id)}
                title={item.name(item.at(garage.current))}
                meta={item.label}
                selected={item.id === garage.item.id}
                onclick={() => garage.select(item)}
              />
            </li>
          {/each}
        </ul>
      </ScrollArea>
    {/if}
  </section>

  <section class="garage-panel garage-stats" bind:this={stats} aria-label="Stats">
    <GarageMeters current={garage.current} shown={garage.shown} />
  </section>

  <section class="garage-bottom" bind:this={bottom} aria-label="Options" aria-hidden={garage.on_builds || undefined}>
    {#if !garage.on_builds}<GarageStrip {garage} />{/if}
    <div class="garage-hints">
      <GarageHint keys={["move"]} label="Slot / part" />
      <GarageHint keys={["accept"]} label="Fit" />
      <GarageHint keys={["prev", "next"]} label="Sections" />
    </div>
  </section>
</div>

<style>
  .garage {
    --garage-glow: var(--background);
    --garage-floor: var(--background-darkest);
    --garage-rail-w: 300px;
    --garage-stats-w: 300px;
    --garage-bottom-h: 168px;
    --garage-inset: var(--space-4);
    position: relative;
    display: grid;
    grid-template:
      "top top top" auto
      "rail . stats" minmax(0, 1fr)
      "bottom bottom bottom" var(--garage-bottom-h)
      / var(--garage-rail-w) minmax(0, 1fr) var(--garage-stats-w);
    gap: var(--space-4);
    height: 100%;
    min-height: 0;
    padding: var(--garage-inset);
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: radial-gradient(ellipse 60% 70% at 50% 55%, var(--garage-glow), var(--garage-floor) 78%);
    color: var(--foreground);
    font-size: var(--text-md);
    /* A pinch here is the car's zoom; left to the browser it zooms the page and pushes the panels off screen. */
    touch-action: none;
  }

  :global(:root[data-scheme="light"]) .garage {
    --garage-glow: var(--background-lighter);
    --garage-floor: var(--background-dark);
  }

  .garage-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .garage-top {
    --garage-side: top;
    position: relative;
    display: grid;
    grid-area: top;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-3);
    pointer-events: none;
  }

  .garage-top > * {
    pointer-events: auto;
  }

  .garage-name {
    display: flex;
    align-items: center;
    gap: var(--space-2) var(--space-5);
    min-width: 0;
  }

  .garage-facts {
    display: flex;
    min-width: 0;
    color: var(--set-dim);
  }

  .garage-sections {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .garage-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .garage-rail {
    --garage-side: left;
    grid-area: rail;
    align-self: start;
    max-height: 100%;
  }

  .garage-sheet {
    grid-row: rail-start / bottom-end;
  }

  .garage-rail > :global(.garage-scroll) {
    flex: 0 1 auto;
  }

  .garage-slot-tabs {
    display: none;
  }

  .garage-slots {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    list-style: none;
  }

  .garage-slots > li {
    display: grid;
  }

  .garage-sheet-body {
    display: grid;
    gap: var(--space-6);
    padding: var(--space-5);
  }

  .garage-stats {
    --garage-side: right;
    grid-area: stats;
    align-self: start;
    gap: var(--space-4);
    max-height: 100%;
    padding: var(--space-5);
    overflow-y: auto;
    scrollbar-width: none;
  }

  /* A fixed band across the whole stage: the car is framed once into what the panels leave, so nothing here may change size between slots or sections. */
  .garage-bottom {
    --garage-side: bottom;
    position: relative;
    display: grid;
    grid-area: bottom;
    grid-template-rows: auto minmax(0, 1fr) auto;
    justify-items: center;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .garage-bottom > :global(*) {
    min-width: 0;
    max-width: 100%;
  }

  .garage[data-tab="builds"] .garage-bottom {
    visibility: hidden;
  }

  .garage-hints {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2) var(--space-5);
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  @media (pointer: coarse) {
    .garage-hints {
      display: none;
    }
  }

  @media (orientation: landscape) and (max-height: 500px), (orientation: landscape) and (max-width: 700px) {
    .garage {
      --garage-sheet-w: clamp(320px, 46vw, 400px);
      --garage-inset: var(--space-3);
      grid-template:
        "top top" auto
        ". rail" auto
        ". ." minmax(0, 1fr)
        "stats bottom" auto
        / minmax(0, 1fr) var(--garage-sheet-w);
      gap: var(--space-3);
    }

    .garage-top {
      grid-template-columns: minmax(0, 1fr) var(--garage-sheet-w);
    }

    .garage-sections {
      justify-content: end;
    }

    .garage-rail {
      --garage-side: right;
      border-color: transparent;
      background: none;
    }

    .garage-sheet {
      grid-row: rail-start / bottom-end;
      border-color: var(--set-line);
      background: var(--set-panel);
    }

    .garage-stats {
      --garage-side: bottom;
      align-self: end;
      padding: var(--space-3) var(--space-4);
    }

    .garage-bottom {
      --garage-side: right;
      grid-template-rows: auto;
    }

    .garage-sheet-body {
      padding: var(--space-4);
    }
  }

  @media (orientation: landscape) and (max-height: 500px), (max-width: 700px) {
    .garage-step-hint {
      display: none;
    }

    .garage-slot-tabs {
      display: block;
      min-width: 0;
    }

    .garage-rail > :global(.garage-slot-list) {
      display: none;
    }
  }

  @media (orientation: portrait) and (max-width: 700px) {
    .garage {
      --garage-inset: var(--space-3);
      grid-template:
        "top" auto
        "rail" auto
        "." minmax(0, 1fr)
        "stats" auto
        "bottom" auto
        / minmax(0, 1fr);
      gap: var(--space-3);
    }

    .garage[data-tab="builds"] {
      grid-template:
        "top" auto
        "rail" minmax(0, 1fr)
        "stats" auto
        / minmax(0, 1fr);
    }

    .garage-top {
      grid-template-columns: minmax(0, 1fr);
    }

    .garage-rail {
      --garage-side: top;
      border-color: transparent;
      background: none;
    }

    .garage-sheet {
      grid-row: auto;
      align-self: stretch;
      border-color: var(--set-line);
      background: var(--set-panel);
    }

    .garage-stats {
      --garage-side: bottom;
      padding: var(--space-3) var(--space-4);
    }

    .garage-bottom {
      grid-template-rows: auto;
    }

    .garage[data-tab="builds"] .garage-bottom {
      display: none;
    }

    /* A sliver of car peeking round the builds sheet reads as a glitch. */
    .garage[data-tab="builds"] .garage-canvas {
      visibility: hidden;
    }

    .garage-sheet-body {
      padding: var(--space-4);
    }
  }
</style>
