import { mount } from "svelte";
import type { CarId } from "../car/cars";
import type { WorldKind } from "../worldgen/types";
import Pause from "./Pause.svelte";

export type PauseAct = "reset" | "leave" | "camera" | "chat" | "settings" | "showroom" | "map" | "events" | "garage" | "online";
export type PauseAid = "tcs" | "abs" | "assist" | "stability" | "auto" | "lights";
export type PauseAids = Record<PauseAid, boolean>;

export interface RoamCard {
  kind: "roam";
  map: string;
  world: WorldKind;
  /** The next event's line, "Sand trail · on Dune sea"; null once every open event has 3 stars. */
  next: string | null;
  next_world: WorldKind | null;
  flags: number;
  tier: string;
  players: number;
  car: CarId;
}

export interface RunCard {
  kind: "event";
  mode: string;
  title: string;
  facts: readonly string[];
}

export type PauseCard = RoamCard | RunCard;

export interface PauseHost {
  /** No peers: the sim holds while the pause is up. */
  solo(): boolean;
  card(): PauseCard;
  aids(): PauseAids;
  toggle(aid: PauseAid): void;
  act(act: PauseAct): void;
}

export class PauseView {
  shown = $state(false);
  card = $state<PauseCard | null>(null);
  aids = $state<PauseAids | null>(null);
  solo = $state(true);

  constructor(readonly host: PauseHost) {}

  get is_open(): boolean {
    return this.shown;
  }

  open() {
    this.card = this.host.card();
    this.aids = this.host.aids();
    this.solo = this.host.solo();
    this.shown = true;
  }

  close() {
    this.shown = false;
  }

  toggle() {
    if (this.shown) this.close();
    else this.open();
  }

  /** A door or action closes the pause first, so the menu it opens is the only layer. */
  act(act: PauseAct) {
    this.close();
    this.host.act(act);
  }

  flip(aid: PauseAid) {
    this.host.toggle(aid);
    this.aids = this.host.aids();
  }

  /** Each frame: a peer joining or leaving flips whether the pause holds the sim. */
  update() {
    if (!this.shown) return;
    const solo = this.host.solo();
    if (solo !== this.solo) this.solo = solo;
  }
}

export function show_pause(host: PauseHost): PauseView {
  const view = new PauseView(host);
  const target = document.createElement("div");
  target.className = "pause-host";
  document.body.append(target);
  mount(Pause, { target, props: { view } });
  return view;
}
