import { mount, unmount } from "svelte";
import { parse_build } from "../car/build";
import type { CarLimit, CarShelf } from "../car/car-pick";
import type { CarId } from "../car/cars";
import { PRESETS } from "../car/presets";
import { held_car } from "../modes/event-car";
import type { CareerEvent, Stars } from "./career";
import GateCardView from "./GateCard.svelte";
import { first_pick, gate_row } from "./gate";
import type { Marker } from "./markers";
import { unlocks } from "./rewards";
import "./markers.css";

export interface GateHost {
  start(id: string): void;
  shelves(limit: CarLimit): readonly CarShelf[];
  pick(title: string, limit: CarLimit, signal: AbortSignal): Promise<string | null>;
}

export type GateCar = { lent: CarId } | { row: true };

// Raw: a proxied marker would hold a copy of its event, which no longer matches the career's own.
export class GateView {
  marker = $state.raw<Marker | null>(null);
  open = $state(false);
  have = $state(0);
  car = $state.raw<GateCar | null>(null);
  shelves = $state.raw<readonly CarShelf[]>([]);
  picked = $state<string | null>(null);
}

// The row reads the class cap alone; the route's own limits are checked again on start, where the full picker opens if the pick misses them.
const limit_of = (event: CareerEvent): CarLimit | null => ("cap" in event.car ? { cap: event.car.cap, car_sized_only: false } : null);

function lent(event: CareerEvent, stars: Stars): CarId | null {
  const { car } = held_car(event, unlocks(stars).cars);
  if (!("preset" in car)) return null;
  return parse_build(PRESETS.find((p) => p.name === car.preset)?.code)?.car ?? null;
}

export class GateCard {
  readonly el = document.createElement("div");
  private readonly view = new GateView();
  private readonly shown: ReturnType<typeof mount>;
  private picking: AbortController | null = null;
  /** The car picked on the card, only while its start runs: the event's car step takes it instead of asking. */
  private armed: string | null = null;

  constructor(private readonly host: GateHost) {
    this.el.className = "event-gate";
    this.shown = mount(GateCardView, { target: this.el, props: { view: this.view, onstart: () => this.start(), onmore: () => void this.more() } });
  }

  get pick(): string | null {
    return this.armed;
  }

  show(marker: Marker | null, open: boolean, stars: Stars) {
    const { view } = this;
    const have = marker ? (stars[marker.event.id] ?? 0) : 0;
    if (marker === view.marker && open === view.open && have === view.have) return;
    if (marker !== view.marker) {
      this.picking?.abort();
      const limit = marker && limit_of(marker.event);
      const id = marker && lent(marker.event, stars);
      view.car = id ? { lent: id } : limit ? { row: true } : null;
      view.shelves = limit ? this.host.shelves(limit) : [];
      view.picked = first_pick(gate_row(view.shelves, null));
    }
    view.marker = marker;
    view.open = open;
    view.have = have;
  }

  start() {
    const { marker, open, picked } = this.view;
    if (!marker || !open) return;
    this.armed = picked;
    try {
      this.host.start(marker.event.id);
    } finally {
      this.armed = null;
    }
  }

  private async more() {
    const { marker } = this.view;
    const limit = marker && limit_of(marker.event);
    if (!marker || !limit) return;
    this.picking?.abort();
    const picking = new AbortController();
    this.picking = picking;
    const code = await this.host.pick(marker.event.name, limit, picking.signal);
    if (this.picking === picking) this.picking = null;
    if (code !== null && !picking.signal.aborted) this.view.picked = code;
  }

  dispose() {
    this.picking?.abort();
    void unmount(this.shown);
  }
}
