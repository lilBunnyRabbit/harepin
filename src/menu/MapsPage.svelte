<script lang="ts">
  import { untrack } from "svelte";
  import { MAX_EVENT_STARS, event_of } from "../career/career";
  import type { CarPicker } from "./car-pick.svelte";
  import { aim_or_go, bare_enter, link_key } from "./drive-picks";
  import { target_of, type StartTarget } from "./events-view";
  import { thumb_url } from "./map-thumb";
  import { MAKE_PAGE, MAPS_PAGE, first_pick, map_stops, type MapEvent, type MapPin, type MapStop } from "./maps";
  import MenuFrame from "./MenuFrame.svelte";
  import StartSheet from "./StartSheet.svelte";
  import Card from "./ui/Card.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import MapPins from "./ui/MapPins.svelte";
  import PlaceLine from "./ui/PlaceLine.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Row from "./ui/Row.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";
  import WorldMap from "./WorldMap.svelte";
  import { WorldMap as MapView } from "./world-map.svelte";

  const THUMB_SIDE = 96;

  interface Props extends PageProps {
    picker: CarPicker;
  }

  let { menu, live, shown, picker }: Props = $props();

  const host = $derived(menu.host);
  const here = $derived({ kind: host.kind, seed: host.seed, levels: host.levels });
  const here_name = $derived(live.live(() => host.map_name()));
  const stops = $derived(map_stops(live.stars, here, here_name));
  let code = $state<string | null>(null);
  let picked = $state<string | null>(null);
  let thumbs = $state<Record<string, string>>({});
  // With nothing left to start here, the page opens on the next map that has something.
  const stop = $derived(stops.find((one) => one.code === code) ?? stops.find((one) => one.events.some((event) => event.open)) ?? stops[0]);
  const event = $derived(stop.events.find((one) => one.id === picked && one.open) ?? open_pick(stop));
  const open = $derived(stop.events.filter((one) => one.open).length);
  const markers = $derived(stop.place.here ? live.live(() => host.map_markers()) : []);
  const pins = $derived<MapPin[]>(markers.map((marker) => ({ id: marker.label, x: marker.x, z: marker.z, ink: marker.ink, label: event_of(marker.label)?.name ?? marker.label })));
  const you = $derived(stop.place.here ? (live.live(() => host.map_players()).find((player) => player.you) ?? null) : null);
  const away = $derived(stop.place.here ? null : stop.place.name);
  const verb = $derived(event ? `Race ${event.title}` : away ? `Travel to ${away}` : `Drive ${stop.name.split(" · ")[0]}`);
  const note = $derived(away ? `Double-click or Enter to go.${event ? "" : " Travel loads the map."}` : "");
  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  const view = new MapView();
  const stop_code = $derived(stop.code);

  function open_pick(of: MapStop): MapEvent | null {
    const first = first_pick(of.events);
    return first?.open ? first : null;
  }

  // Keyed on the code: each menu refresh rebuilds the stops, and a rerun would drop a map still generating.
  $effect(() => {
    if (!shown || !stop_code) return;
    const { map, place } = untrack(() => stop);
    view.show(map.seed, map.kind, place.here, map.levels);
  });

  // The page stays mounted: the next open starts on the loaded map, not the one browsed last.
  $effect(() => {
    if (shown) return;
    view.stop();
    code = null;
    picked = null;
  });

  $effect(() => {
    if (!shown) return;
    for (const one of stops) {
      if (untrack(() => thumbs[one.code])) continue;
      thumb_url(one.map, THUMB_SIDE).then(
        (url) => (thumbs[one.code] = url),
        (error: unknown) => console.warn("map thumb: generation failed", error),
      );
    }
  });

  function pick_map(next: MapStop) {
    if (next.code === stop.code) return;
    code = next.code;
    picked = null;
  }

  function pick_event(id: string) {
    picked = id;
  }

  function go() {
    if (event) return void (target = target_of(host, "event", event.id));
    if (stop.place.here) return menu.close();
    menu.drive(stop.map.seed, stop.map.kind, stop.map.levels);
  }

  const press = (click: MouseEvent, aim: () => void) => aim_or_go(click, aim, go);

  function key(press: KeyboardEvent) {
    if (!shown || target) return;
    if (link_key(press) === "n") return menu.show(MAKE_PAGE);
    if (!bare_enter(press)) return;
    press.preventDefault();
    go();
  }
</script>

<svelte:window onkeydown={key} />

{#if target}
  <StartSheet {menu} {picker} {target} eyebrow="Home" title="Maps" {shown} onclose={() => (target = null)} />
{:else}
<MenuFrame {menu} id={MAPS_PAGE} eyebrow="Home" title="Maps" veil={0.55} {note}>
  <div class="maps">
    <Card pad="none" class="maps-big" label={stop.name}>
      <div class="maps-shot">
        <WorldMap map={view} label={`Map of ${stop.name}`}>
          {#if stop.place.here}
            <MapPins size={view.status === "ready" ? view.size : null} {pins} picked={event?.id ?? null} {you} onpick={pick_event} />
          {/if}
        </WorldMap>
      </div>
      <div class="maps-side">
        <header>
          <span class="maps-eyebrow">{stop.name.split(" · ")[0]} · {open ? `${open} ${open === 1 ? "event" : "events"} open` : "free roam"}</span>
          <h2>{stop.name}</h2>
          {#if stop.place.here}
            <PlaceLine place={stop.place} tail={stop.of ? `${stop.got} of ${stop.of} ★` : undefined} />
          {:else if stop.of}
            <span class="maps-sub">{stop.got} of {stop.of} ★</span>
          {/if}
        </header>
        {#if stop.events.length}
          <ScrollArea class="maps-events">
            {#each stop.events as one (one.id)}
              {#if one.open}
                <Row fill label={one.title} help={one.eyebrow} focused={one.id === event?.id} onfocus={() => pick_event(one.id)} onclick={(click) => press(click, () => pick_event(one.id))}>
                  {#snippet control()}
                    <span class="maps-stars" role="img" aria-label={`${one.stars} of ${MAX_EVENT_STARS} stars`}><b>{"★".repeat(one.stars)}</b>{"★".repeat(MAX_EVENT_STARS - one.stars)}</span>
                  {/snippet}
                </Row>
              {:else}
                <Row fill icon="icon-lock" label={one.title} help={one.note} />
              {/if}
            {/each}
          </ScrollArea>
        {:else}
          <p class="maps-sub">No events on this map. It is yours to roam.</p>
        {/if}
      </div>
    </Card>

    <nav class="maps-rail" aria-label="Maps">
      {#each stops as one (one.code)}
        <Card pad="sm" flat class="maps-stop" focused={one.code === stop.code} label={one.name} onfocus={() => pick_map(one)} onclick={(click) => press(click, () => pick_map(one))}>
          {#snippet picture()}
            <img src={thumbs[one.code] ?? preview(one.map.kind)} alt="" decoding="async" />
          {/snippet}
          <b class="maps-name">{one.name}</b>
          {#if one.place.here}
            <PlaceLine place={one.place} tail={one.of ? `${one.got} of ${one.of} ★` : undefined} />
          {:else}
            {@const count = one.events.filter((each) => each.open).length}
            <span class="maps-sub">{count} {count === 1 ? "event" : "events"} open</span>
          {/if}
        </Card>
      {/each}
    </nav>
  </div>

  {#snippet links()}
    <KeyLink keys={{ key: "N" }} onclick={() => menu.show(MAKE_PAGE)}>Make a map</KeyLink>
  {/snippet}

  {#snippet primary()}
    <PrimaryAction onclick={go}>{verb}</PrimaryAction>
  {/snippet}
</MenuFrame>
{/if}

<style>
  .maps {
    --rail-w: calc(var(--top-h) * 7);
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--rail-w);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .maps > :global(.maps-big) {
    flex-direction: row;
    gap: 0;
    overflow: hidden;
  }

  .maps-shot {
    position: relative;
    flex: none;
    height: 100%;
    max-width: 58%;
    aspect-ratio: 1;
  }

  .maps-side {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
    padding: var(--pad);
  }

  header {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .maps-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.1;
    text-wrap: balance;
  }

  .maps-sub {
    margin: 0;
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .maps-side > :global(.maps-events) {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    min-height: 0;
  }

  .maps-side > :global(.maps-events > *) {
    flex: none;
  }

  .maps-stars {
    color: var(--line-strong);
    font-size: var(--type-body);
    letter-spacing: 0.1em;
  }

  .maps-stars b {
    color: var(--accent);
  }

  .maps-rail {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
  }

  /* The rail scrolls, so a ring outside its cards would be cut at the sides: it sits inside the edge, as a row's does. */
  .maps-rail > :global(.ui-card) {
    outline-offset: calc(var(--mark-w) * -1);
  }

  .maps-rail > :global(.maps-stop) {
    flex: none;
    flex-direction: row;
    height: calc(var(--row-h) * 2.5);
  }

  .maps-rail > :global(.maps-stop > .ui-card-pic) {
    flex: none;
    aspect-ratio: 1;
  }

  .maps-rail > :global(.maps-stop > .ui-card-cap) {
    flex: 1;
    justify-content: center;
    gap: var(--gap-xs);
  }

  .maps-name {
    overflow: hidden;
    font-size: var(--type-body);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-height: 500px) {
    .maps {
      --rail-w: calc(var(--top-h) * 6.5);
    }

    h2 {
      font-size: var(--type-h2);
    }
  }

  /* Portrait: the maps run as a strip along the top, and the picked map stacks under it, its map over its events. */
  @media (orientation: portrait) and (max-width: 700px) {
    .maps {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto;
      height: auto;
    }

    .maps-rail {
      grid-row: 1;
      flex-direction: row;
      overflow: auto hidden;
    }

    .maps-rail > :global(.maps-stop) {
      width: calc(var(--top-h) * 5);
    }

    .maps > :global(.maps-big) {
      flex-direction: column;
    }

    .maps-shot {
      width: 100%;
      max-width: none;
      height: auto;
    }

    .maps-side > :global(.maps-events) {
      overflow: visible;
      mask-image: none;
    }

    h2 {
      font-size: var(--type-h2);
    }
  }
</style>
