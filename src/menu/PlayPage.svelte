<script lang="ts">
  import type { GoTo } from "../goals/goals";
  import { rgba, tier_metals } from "../theme/palette";
  import { mainland_seed } from "../world/world-pick";
  import { WorldKind } from "../worldgen/types";
  import { MINIS, WORLDS } from "../worlds/worlds";
  import CareerHero from "./CareerHero.svelte";
  import MapLegend, { type LegendItem } from "./MapLegend.svelte";
  import WorldMap from "./WorldMap.svelte";
  import GoalsCard from "./GoalsCard.svelte";
  import { thumb_url } from "./map-thumb";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Tile from "./ui/Tile.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";
  import { WorldMap as MapView } from "./world-map.svelte";

  interface Props extends PageProps {
    go_to: (to: GoTo) => void;
  }

  let { menu, live, shown, go_to }: Props = $props();

  const PLAYERS_MS = 250;
  const MAINLAND = WorldKind.MAINLAND;
  const MORE = [
    { title: "Create world", meta: "Pick a world, tune it, share its code", icon: "icon-dice", section: "world" },
    { title: "Modes", meta: "Races, drift, gymkhana", icon: "icon-modes", section: "modes" },
  ];

  const host = $derived(menu.host);
  const here = $derived(host.kind === MAINLAND);
  const map = new MapView();
  const seed = $derived(mainland_seed(host, live.prefs.last_mainland_seed));
  const running = $derived(live.live(() => host.mode_running()));
  let custom_thumb = $state<string>();

  // Cars are drawn only on the mainland being driven, so their entries show only there.
  const legend: LegendItem[] = $derived(here
    ? [
        { label: "You", swatch: "var(--cottontail)" },
        { label: "Circuit", swatch: "var(--accent)" },
        { label: "Players", swatch: "var(--secondary)" },
        { label: "Career events (grey: locked)", swatch: rgba(tier_metals[0]), diamond: true },
      ]
    : [{ label: "Circuit", swatch: "var(--accent)" }]);

  $effect(() => {
    if (!shown) return;
    map.show(seed, MAINLAND, true);
    const players = () => {
      if (document.hidden) return;
      map.show_players(host.map_players());
      map.show_markers(host.map_markers());
    };
    const timer = here ? window.setInterval(players, PLAYERS_MS) : 0;
    if (here) players();
    return () => {
      clearInterval(timer);
      map.stop();
    };
  });

  $effect(() => {
    if (!shown || host.code === null || custom_thumb) return;
    thumb_url({ seed: host.seed, kind: host.kind, levels: host.levels }).then(
      (url) => (custom_thumb = url),
      (error: unknown) => console.warn("map thumb: generation failed", error),
    );
  });

  function run(action: () => void) {
    menu.close();
    action();
  }
</script>

<div class="play">
  <div class="map">
    <WorldMap {map} label={`Map of Mainland ${seed}`}>
      <div class="map-tag">
        <SectionHead eyebrow={here ? "You are here" : "Main world"} title={`Mainland ${seed}`} />
      </div>
      <div class="legend"><MapLegend items={legend} /></div>
    </WorldMap>
  </div>

  <ScrollArea class="side" label="Play">
    <div class="column">
      {#if running !== null}
        <div class="run">
          <Button icon="icon-restart" onclick={() => run(() => host.restart_lap())}>Restart {running}</Button>
          <Button variant="danger" icon="icon-close" onclick={() => run(() => host.quit_mode())}>Quit {running}</Button>
        </div>
      {/if}

      <CareerHero stars={live.stars} onstart={(id) => host.start_event(id)} onall={() => menu.show("career")} />

      <Card variant="well">
        <SectionHead eyebrow="Free drive" title={WORLDS[MAINLAND].name}>
          {#snippet action()}
            <Button onclick={() => menu.drive(seed, MAINLAND)}>{here ? "Keep driving" : "Drive Mainland"}</Button>
          {/snippet}
        </SectionHead>
      </Card>

      <!-- A div, not a section: the pad's nearest() keeps focus inside a section, which hid the mini maps from Drive. -->
      <div class="group">
        <SectionHead eyebrow="Mini maps" />
        <div class="minis">
          {#each MINIS as { kind, name } (kind)}
            {@const current = kind === host.kind}
            <Tile
              size="sm"
              title={name}
              thumb={current && host.code !== null ? (custom_thumb ?? preview(kind)) : preview(kind)}
              selected={current}
              onclick={() => menu.drive(host.seed, kind, current ? host.levels : undefined)}
            />
          {/each}
        </div>
      </div>

      <div class="more">
        {#each MORE as item (item.section)}
          <Tile title={item.title} meta={item.meta} icon={item.icon} onclick={() => menu.show(item.section)} />
        {/each}
      </div>

      <GoalsCard {menu} {live} go={go_to} />
    </div>
  </ScrollArea>
</div>

<style>
  .play {
    display: grid;
    grid-template: "map side" minmax(0, 1fr) / minmax(0, 1fr) minmax(320px, 400px);
    gap: var(--space-5);
    height: 100%;
    min-height: 420px;
  }

  .map {
    grid-area: map;
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .map-tag,
  .legend {
    position: absolute;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-md);
    background: var(--set-panel);
  }

  .map-tag {
    top: var(--space-4);
    left: var(--space-4);
  }

  .legend {
    inset: auto var(--space-4) var(--space-4);
  }

  .play > :global(.side) {
    grid-area: side;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .run {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .group {
    display: grid;
    gap: var(--space-3);
  }

  .minis {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .more {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  @media (max-height: 500px) {
    .play {
      grid-template-columns: minmax(0, 4fr) minmax(0, 5fr);
      gap: var(--space-4);
      min-height: 0;
    }

    .legend {
      display: none;
    }
  }

  @media (orientation: portrait) {
    .play {
      grid-template:
        "map" min(56dvh, calc(100vw - 2 * var(--space-4)))
        "side" auto
        / minmax(0, 1fr);
      height: auto;
      min-height: 0;
    }
  }
</style>
