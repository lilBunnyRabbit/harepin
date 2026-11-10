import type { Car } from "../car/car";
import type { Lobby } from "../net/lobby";
import type { Net } from "../net/net";
import type { Race } from "../race";
import { brand, dark, rgba } from "../theme/palette";
import { tach } from "../car/tach";
import { SIZE, type World } from "../world/world";
import { world_query } from "../world/world-pick";
import "./hud.css";

export function $<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T;
export function $(id: string): HTMLElement;
export function $(id: string, type: { new (): HTMLElement; prototype: HTMLElement } = HTMLElement): HTMLElement {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`#${id} is missing or not a ${type.name}`);
  return el;
}

export const format = (ms: number | null) => {
  if (ms === null) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
};

function set_text(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

function set_data(el: HTMLElement, key: string, value: string) {
  if (el.dataset[key] !== value) el.dataset[key] = value;
}

function set_style(el: HTMLElement, prop: string, value: string) {
  if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
}

function set_hidden(el: HTMLElement, hidden: boolean) {
  if (el.hidden !== hidden) el.hidden = hidden;
}

// Rounded so a value that barely moves doesn't restyle every frame, and so the CSS serialisation reads back equal.
const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

interface PlayerRow {
  name: string;
  best: number | null;
  you: boolean;
}

const same_rows = (a: PlayerRow[], b: PlayerRow[]) => a.length === b.length && a.every((r, i) => r.name === b[i].name && r.best === b[i].best && r.you === b[i].you);

function row(name: string, time: string, you: boolean, note = ""): HTMLLIElement {
  const li = document.createElement("li");
  li.dataset.you = String(you);
  const left = document.createElement("span");
  left.textContent = name;
  const right = document.createElement("span");
  right.textContent = time;
  if (note) {
    const tag = document.createElement("i");
    tag.textContent = ` ${note}`;
    right.append(tag);
  }
  li.append(left, right);
  return li;
}

const MAP = 200;
const MAP_INK = {
  road: rgba(brand.foreground, 0.5),
  checkpoint: rgba(brand.accent),
  remote: rgba(brand.secondary),
  you: rgba(brand.cottontail),
};
const TOAST_MS = 1200;
/** Driving this long above CALM_KMH lets the touch HUD (and the Minimal layout) fade back; stopping brings it back. */
const CALM_MS = 3000;
const CALM_KMH = 12;
const STOP_KMH = 4;

export class Hud {
  private el = {
    speed: $("speed"),
    gear: $("gear"),
    rpm: $("rpm-fill"),
    shift: $("shift"),
    nitro: $("nitro"),
    nitro_fill: $("nitro-fill"),
    nitro_key: $("nitro-key"),
    lap: $("lap"),
    best: $("best"),
    last: $("last"),
    cp: $("cp"),
    toast: $("toast"),
    players: $("players"),
    net: $("net"),
    join_map: $("join-map", HTMLButtonElement),
    banner: $("banner"),
    delta: $("delta"),
    rewind: $("rewind"),
    countdown: $("countdown"),
    race_panel: $("race-panel"),
    race_status: $("race-status"),
    race_results: $("race-results"),
    strip: $("strip"),
    top_right: document.querySelector<HTMLElement>(".top-right"),
  };
  private map_canvas = $("minimap", HTMLCanvasElement);
  private map: CanvasRenderingContext2D;
  private road = new Path2D();
  private road_layer = new OffscreenCanvas(1, 1);
  private map_ratio = 0;
  private toast_timer = 0;
  private players: PlayerRow[] = [];
  private results_key = "";
  private moving_since = 0;

  constructor(
    private world: World,
    private race: Race,
    private net: Net,
    room: string,
    private lobby: Lobby,
  ) {
    $("room").textContent = room;
    $("room").title = room;
    this.el.join_map.addEventListener("click", () => {
      const map = this.net.foreign_seed();
      if (map) location.search = `?${new URLSearchParams(world_query(room, map.seed, map.kind))}`;
    });
    document.documentElement.dataset.scheme = dark ? "dark" : "light";
    const map = this.map_canvas.getContext("2d");
    if (!map) throw new Error("minimap has no 2d context");
    this.map = map;
    world.road.forEach((p, i) => (i ? this.road.lineTo(...this.to_map(p.x, p.z)) : this.road.moveTo(...this.to_map(p.x, p.z))));
    this.road.closePath();
  }

  private to_map(x: number, z: number): [number, number] {
    return [MAP / 2 + (x / SIZE) * MAP * 1.05, MAP / 2 + (z / SIZE) * MAP * 1.05];
  }

  /** A short note in the middle of the screen that fades on its own, for a setting changed by key. */
  toast(text: string) {
    const { toast } = this.el;
    toast.textContent = text;
    toast.dataset.shown = "";
    clearTimeout(this.toast_timer);
    this.toast_timer = window.setTimeout(() => delete toast.dataset.shown, TOAST_MS);
  }

  /** Brings the faded HUD back for another stretch, after a touch near the top of the screen. */
  wake() {
    this.moving_since = 0;
  }

  update(car: Car, now: number, rewinding: boolean) {
    const { el, race } = this;
    const kmh = Math.round(Math.abs(car.forward_speed) * 3.6);
    set_text(el.speed, String(kmh));
    if (kmh < STOP_KMH || document.activeElement?.closest(".dock-top, .assists, #modes")) this.moving_since = 0;
    else if (kmh > CALM_KMH && !this.moving_since) this.moving_since = now;
    document.documentElement.toggleAttribute("data-calm", this.moving_since > 0 && now - this.moving_since > CALM_MS);
    set_text(el.gear, car.gear === -1 ? "R" : car.gear === 0 ? "N" : String(car.gear));
    set_data(el.gear, "mode", car.auto ? "A" : "M");
    const rev = tach(car.rpm, car.spec);
    set_style(el.rpm, "width", percent(rev.fill));
    set_data(el.rpm, "hot", String(rev.hot));
    set_data(el.shift, "on", String(!car.auto && rev.shift));
    set_hidden(el.nitro, !car.nitro.fitted);
    set_style(el.nitro_fill, "width", percent(car.nitro.level));
    el.nitro.toggleAttribute("data-boost", car.nitro.boosting);
    el.nitro.toggleAttribute("data-idle", car.gear < 2);
    set_style(el.nitro_key, "--tank", String(Math.round(car.nitro.level * 100) / 100));
    el.nitro_key.toggleAttribute("data-boost", car.nitro.boosting);
    set_text(el.lap, format(race.started ? now - race.started : null));
    set_text(el.best, format(race.best));
    set_text(el.last, format(race.last));
    set_text(el.cp, race.started ? `${race.next === 0 ? race.gates : race.next} / ${race.gates}` : "drive through the lit gate");
    el.strip.toggleAttribute("data-idle", !race.started);

    const rows: PlayerRow[] = [
      { name: `${this.net.name} (you)`, best: race.best, you: true },
      ...[...this.net.remotes.values()].map((r) => ({ name: this.net.display_name(r), best: r.latest.best, you: false })),
    ];
    rows.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
    if (!same_rows(rows, this.players)) {
      this.players = rows;
      el.players.replaceChildren(...rows.map((r) => row(r.name, format(r.best), r.you)));
    }
    const foreign = this.net.foreign.size;
    const { older_peers: older, newer_peers: newer } = this.net;
    set_text(el.net, `${this.net.status} · ${this.net.remotes.size} other${this.net.remotes.size === 1 ? "" : "s"}${foreign ? ` · ${foreign} peer${foreign === 1 ? "" : "s"} on a different map` : ""}${older ? ` · ${older} on an older version` : ""}${newer ? ` · ${newer} on a newer version, reload to update` : ""}`);
    set_hidden(el.join_map, this.net.foreign_seed() === null);
    el.top_right?.toggleAttribute("data-alone", this.net.remotes.size === 0 && foreign === 0 && older === 0 && newer === 0);

    const lap_flashing = race.lap_flash && now - race.lap_flash < 2600;
    set_style(el.banner, "opacity", lap_flashing ? "1" : "0");
    if (lap_flashing) set_text(el.banner, `LAP ${format(race.last)}${race.last === race.best ? " · BEST" : ""}`);
    const delta_on = race.delta !== null && now - race.delta_flash < 2200;
    set_style(el.delta, "opacity", delta_on ? "1" : "0");
    if (delta_on && race.delta !== null) {
      set_text(el.delta, `${race.delta < 0 ? "−" : "+"}${(Math.abs(race.delta) / 1000).toFixed(2)}`);
      set_data(el.delta, "ahead", String(race.delta < 0));
    }
    set_style(el.rewind, "opacity", rewinding ? "1" : "0");
    this.draw_lobby(now);
    this.draw_map(car);
  }

  private draw_lobby(now: number) {
    const { el } = this;
    const { state, finishers } = this.lobby;
    const count = state.kind === "countdown" ? String(Math.ceil((state.go - now) / 1000)) : state.kind === "racing" && now - state.go < 1000 ? "GO" : "";
    set_text(el.countdown, count);
    set_style(el.countdown, "opacity", count ? "1" : "0");
    set_hidden(el.race_panel, state.kind === "idle");
    if (state.kind === "idle") return;
    const laps = `${state.laps} lap${state.laps === 1 ? "" : "s"}`;
    set_text(
      el.race_status,
      state.kind === "countdown"
        ? `Race · ${laps} · get ready`
        : state.kind === "racing"
          ? `Race · lap ${state.lap + 1}/${state.laps} · ${format(now - state.go)}`
          : `Finished P${state.place} · ${format(state.time)}${state.improved ? " · new best" : ` · best ${format(this.lobby.record.best[state.laps] ?? null)}`}`,
    );
    const results_key = JSON.stringify(finishers);
    if (results_key === this.results_key) return;
    this.results_key = results_key;
    el.race_results.replaceChildren(...finishers.map((f, i) => row(`${i + 1}. ${f.name}${f.you ? " (you)" : ""}`, format(f.time), f.you, f.you ? "" : "claimed")));
  }

  // The road never changes for a world and the theme is fixed per load, so it is stroked once per pixel ratio.
  private fit_map() {
    const ratio = devicePixelRatio;
    if (ratio === this.map_ratio) return;
    this.map_ratio = ratio;
    const size = Math.round(MAP * ratio);
    this.map_canvas.width = size;
    this.map_canvas.height = size;
    this.map.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.road_layer = new OffscreenCanvas(size, size);
    const road = this.road_layer.getContext("2d");
    if (!road) throw new Error("minimap road layer has no 2d context");
    road.scale(ratio, ratio);
    road.lineWidth = 3;
    road.lineJoin = "round";
    road.strokeStyle = MAP_INK.road;
    road.stroke(this.road);
  }

  private draw_map(car: Car) {
    this.fit_map();
    const { map } = this;
    map.clearRect(0, 0, MAP, MAP);
    map.drawImage(this.road_layer, 0, 0, MAP, MAP);
    const cp = this.world.checkpoints[this.race.next];
    map.fillStyle = MAP_INK.checkpoint;
    map.beginPath();
    map.arc(...this.to_map(cp.x, cp.z), 4.5, 0, Math.PI * 2);
    map.fill();
    map.fillStyle = MAP_INK.remote;
    for (const remote of this.net.remotes.values()) {
      map.beginPath();
      map.arc(...this.to_map(remote.latest.p[0], remote.latest.p[2]), 3.5, 0, Math.PI * 2);
      map.fill();
    }
    const [x, y] = this.to_map(car.pos.x, car.pos.z);
    const h = car.heading;
    map.fillStyle = MAP_INK.you;
    map.beginPath();
    map.moveTo(x + Math.sin(h) * 7, y + Math.cos(h) * 7);
    map.lineTo(x + Math.sin(h + 2.5) * 5, y + Math.cos(h + 2.5) * 5);
    map.lineTo(x + Math.sin(h - 2.5) * 5, y + Math.cos(h - 2.5) * 5);
    map.fill();
  }
}
