import { flushSync, mount } from "svelte";
import { event_of, type Stars } from "../career/career";
import type { MapMarker } from "../career/markers";
import { distance_text, elsewhere, first_pick, map_event, type Elsewhere, type MapEvent, type MapPin } from "../menu/maps";
import { WorldMap } from "../menu/world-map.svelte";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { PAGE_CALLOUTS } from "./map-callouts";
import MapOverlay from "./MapOverlay.svelte";
import { next_up } from "./next-up";

export interface MapOverlayHost {
  here: MapSpec;
  map_name(): string;
  stars(): Stars;
  flags(): readonly MapMarker[];
  you(): { x: number; z: number };
  /** The map binding's keys: input is blocked while the map is up, so the overlay closes on them itself. */
  map_keys(): readonly string[];
  go(id: string): void;
  other_maps(): void;
  /** The run on now, else null. */
  run(): MapRun | null;
}

/** A run's map: its route, you and the rivals only, no flags and no way off the map mid-run. */
export interface MapRun {
  name: string;
  route: readonly { x: number; z: number }[];
  closed: boolean;
  /** An AI car's name is blank: the field's names live with the race, a peer's comes with it. */
  rivals: readonly { name: string; x: number; z: number }[];
}

export interface MapFlag {
  event: MapEvent;
  pin: MapPin;
  distance: string;
  /** The flag the road's Next up ticket points at. */
  next: boolean;
}

export class MapOverlayView {
  shown = $state(false);
  name = $state("");
  /** Every flag on the map: Next up first, then nearest first. The card shows them a page at a time. */
  flags = $state.raw<readonly MapFlag[]>([]);
  page = $state(0);
  you = $state.raw<{ x: number; z: number } | null>(null);
  away = $state.raw<Elsewhere | null>(null);
  run = $state.raw<MapRun | null>(null);
  picked = $state<string | null>(null);
  close_keys = $state.raw<readonly string[]>([]);
  readonly map = new WorldMap();

  constructor(readonly host: MapOverlayHost) {}

  get is_open(): boolean {
    return this.shown;
  }

  get pages(): number {
    return Math.ceil(this.flags.length / PAGE_CALLOUTS);
  }

  get on_page(): readonly MapFlag[] {
    return this.flags.slice(this.page * PAGE_CALLOUTS, (this.page + 1) * PAGE_CALLOUTS);
  }

  open() {
    const { host } = this;
    const stars = host.stars();
    const you = host.you();
    const run = host.run();
    this.run = run;
    this.flags = run ? [] : flags_of(host.flags(), stars, you, host.here);
    this.page = 0;
    this.you = you;
    this.name = run?.name ?? host.map_name();
    this.close_keys = host.map_keys();
    this.away = run ? null : elsewhere(stars, host.here);
    this.picked = this.flags.find((flag) => flag.next)?.event.id ?? first_pick(this.on_page.map((flag) => flag.event))?.id ?? null;
    this.map.show(host.here.seed, host.here.kind, true, host.here.levels);
    this.shown = true;
  }

  close() {
    this.shown = false;
  }

  toggle() {
    if (this.shown) this.close();
    else this.open();
  }

  more() {
    if (this.pages < 2) return;
    this.page = (this.page + 1) % this.pages;
    this.picked = first_pick(this.on_page.map((flag) => flag.event))?.id ?? null;
  }

  go(id: string) {
    this.close();
    // The dialog closes in an effect: the flag's card takes the keys only once focus is back from it.
    flushSync();
    this.host.go(id);
  }

  other_maps() {
    if (this.run) return;
    this.close();
    this.host.other_maps();
  }
}

function flags_of(markers: readonly MapMarker[], stars: Stars, you: { x: number; z: number }, here: MapSpec): MapFlag[] {
  const up = next_up(stars, here);
  const lead = up?.place.here ? up.event.id : null;
  const found: { flag: MapFlag; metres: number }[] = [];
  for (const marker of markers) {
    const event = event_of(marker.label);
    if (!event) continue;
    const metres = Math.hypot(marker.x - you.x, marker.z - you.z);
    const flag = { event: map_event(event, stars), pin: { id: event.id, x: marker.x, z: marker.z, label: event.name, ink: marker.ink }, distance: distance_text(metres), next: event.id === lead };
    found.push({ flag, metres });
  }
  return found.sort((a, b) => Number(b.flag.next) - Number(a.flag.next) || a.metres - b.metres).map((one) => one.flag);
}

export function show_map_overlay(host: MapOverlayHost): MapOverlayView {
  const view = new MapOverlayView(host);
  const target = document.createElement("div");
  target.className = "map-overlay-host";
  document.body.append(target);
  mount(MapOverlay, { target, props: { view } });
  return view;
}
