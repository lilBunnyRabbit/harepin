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
  limit(event: CareerEvent): CarLimit | null;
  shelves(limit: CarLimit): readonly CarShelf[];
  pick(title: string, limit: CarLimit, signal: AbortSignal): Promise<string | null>;
  /** The loaded map's name, beside the card's "Here". */
  map(): string;
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
  map = $state("");
}

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
  /** The flag whose card Back put away: it stays away until the car leaves that flag. */
  private left: Marker | null = null;

  constructor(private readonly host: GateHost) {
    this.el.className = "event-gate";
    this.shown = mount(GateCardView, { target: this.el, props: { view: this.view, onstart: () => this.start(), onmore: () => void this.more(), onleave: () => this.leave() } });
  }

  get pick(): string | null {
    return this.armed;
  }

  show(at: Marker | null, open: boolean, stars: Stars) {
    const { view } = this;
    if (at !== this.left) this.left = null;
    const marker = this.left ? null : at;
    const have = marker ? (stars[marker.event.id] ?? 0) : 0;
    if (marker === view.marker && open === view.open && have === view.have) return;
    if (marker !== view.marker) {
      this.picking?.abort();
      const limit = marker && this.host.limit(marker.event);
      const id = marker && lent(marker.event, stars);
      view.car = id ? { lent: id } : limit ? { row: true } : null;
      view.shelves = limit ? this.host.shelves(limit) : [];
      view.picked = first_pick(gate_row(view.shelves, null));
      if (marker) view.map = this.host.map();
    }
    view.marker = marker;
    view.open = open;
    view.have = have;
  }

  /** Back on the card: true when a card was up to put away. */
  leave(): boolean {
    const { marker } = this.view;
    if (!marker) return false;
    this.picking?.abort();
    this.left = marker;
    this.view.marker = null;
    return true;
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
    const limit = marker && this.host.limit(marker.event);
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
