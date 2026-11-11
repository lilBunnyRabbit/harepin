import type { Car } from "../car/car";
import type { Lobby } from "../net/lobby";
import type { Net } from "../net/net";
import type { Race } from "../race";
import { dark } from "../theme/palette";
import { HudLayout, MapView } from "../menu/prefs";
import { tach } from "../car/tach";
import type { World } from "../world/world";
import type { RouteRun } from "../modes/mode";
import { Minimap } from "./minimap";
import { PaceCard } from "./pace-card";
import "./hud.css";
import "./top-bar.css";
import "./corner.css";
import "./dash.css";
import "./aids.css";
import "./overlays.css";

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

function svg(id: string): SVGElement {
  const el = document.getElementById(id);
  if (!(el instanceof SVGElement)) throw new Error(`#${id} is missing or not an SVG element`);
  return el;
}

function set_text(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

function set_data(el: HTMLElement | SVGElement, key: string, value: string) {
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

const TOAST_MS = 1200;
// Display names add an id suffix when two cars share a name, which allocates, so the map's labels refresh at this rate.
const NAMES_MS = 1000;
/** The lobby's route id when no race is on; lap gates belong to it. */
const CIRCUIT = "circuit";
/** Driving this long above CALM_KMH lets the touch HUD (and the Minimal layout) fade back; stopping brings it back. */
const CALM_MS = 3000;
const CALM_KMH = 12;
const STOP_KMH = 4;
const SVG = "http://www.w3.org/2000/svg";
/** The dial arc: centre, radius and its 270° sweep starting bottom left, in the dial's 200 px view box. */
const DIAL_R = 75;
const DIAL_START = (135 * Math.PI) / 180;
const DIAL_SWEEP = (270 * Math.PI) / 180;

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
    gate: $("gate"),
    cp: $("cp"),
    toast: $("toast"),
    toast_text: $("toast-text"),
    toast_label: $("toast-label"),
    dial_fill: svg("dial-fill"),
    dial_ticks: svg("dial-ticks"),
    map_note: $("map-note"),
    event_name: $("event-name"),
    map_dist: $("map-dist"),
    players: $("players"),
    banner: $("banner"),
    delta: $("delta"),
    rewind: $("rewind"),
    countdown: $("countdown"),
    race_panel: $("race-panel"),
    race_status: $("race-status"),
    race_results: $("race-results"),
    strip: $("strip"),
  };
  private map: Minimap;
  private pace: PaceCard;
  private view: MapView = MapView.FULL;
  /** The route a mode run drives, if any; it wins over the lobby's. */
  run_route: () => RouteRun | null = () => null;
  private toast_timer = 0;
  private players: PlayerRow[] = [];
  private results_key = "";
  private moving_since = 0;
  private readonly names = new Map<string, string>();
  private names_at = -Infinity;
  private dial_at = -1;
  private redline = 0;
  private metres = -1;

  constructor(
    private world: World,
    private race: Race,
    private net: Net,
    room: string,
    private lobby: Lobby,
  ) {
    $("room").textContent = room;
    $("room").title = room;
    document.documentElement.dataset.scheme = dark ? "dark" : "light";
    const canvas = $("minimap", HTMLCanvasElement);
    const circuit = new Set(world.circuit);
    const network = world.tiles.streamed ? { roads: world.graph.edges.filter((e) => !circuit.has(e.id)).map((e) => e.points), towns: world.towns } : undefined;
    this.map = new Minimap(canvas, world.routes, world.tiles.ext.size, network);
    this.pace = new PaceCard(world.routes);
    canvas.after(this.pace.el);
  }

  set_layout(layout: HudLayout) {
    document.documentElement.dataset.hud = layout;
    this.map.set_disc(layout === HudLayout.CLASSIC);
  }

  set_map(view: MapView) {
    document.documentElement.dataset.map = view;
    if (view === MapView.CLOSE && this.view !== view) this.map.reset();
    this.view = view;
  }

  /** A short note that fades on its own, for a setting changed by key; `label` is an optional line above it. */
  toast(text: string, label = "") {
    const { toast } = this.el;
    this.el.toast_text.textContent = text;
    this.el.toast_label.textContent = label;
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
    const dial = Math.round(rev.fill * 200);
    if (dial !== this.dial_at) {
      this.dial_at = dial;
      el.dial_fill.style.strokeDashoffset = String(100 - dial / 2);
    }
    if (car.spec.redline !== this.redline) this.dial_ticks(car.spec.redline);
    const hot = String(rev.hot);
    const shift = String(!car.auto && rev.shift);
    set_data(el.rpm, "hot", hot);
    set_data(el.shift, "on", shift);
    set_data(el.dial_fill, "hot", hot);
    set_data(el.dial_fill, "shift", shift);
    set_data(el.gear, "shift", shift);
    set_hidden(el.nitro, !car.nitro.fitted);
    set_style(el.nitro_fill, "width", percent(car.nitro.level));
    el.nitro.toggleAttribute("data-boost", car.nitro.boosting);
    el.nitro.toggleAttribute("data-idle", car.gear < 2);
    set_style(el.nitro_key, "--tank", String(Math.round(car.nitro.level * 100) / 100));
    el.nitro_key.toggleAttribute("data-boost", car.nitro.boosting);
    set_text(el.lap, format(race.started ? now - race.started : null));
    set_text(el.best, format(race.best));
    set_text(el.last, format(race.last));
    set_hidden(el.gate, this.run_route() !== null);
    set_text(el.cp, race.started ? `${race.next === 0 ? race.gates : race.next} / ${race.gates}` : "drive through the lit gate");
    el.strip.toggleAttribute("data-idle", !race.started);
    set_text(el.event_name, race.started ? "Lap" : "Free roam");

    const rows: PlayerRow[] = [
      { name: `${this.net.name} (you)`, best: race.best, you: true },
      ...[...this.net.remotes.values()].map((r) => ({ name: this.net.display_name(r), best: r.latest.best, you: false })),
    ];
    rows.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
    if (!same_rows(rows, this.players)) {
      this.players = rows;
      el.players.replaceChildren(...rows.map((r) => row(r.name, format(r.best), r.you)));
    }

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
    this.draw_map(car, now);
  }

  // Rebuilt only when the car changes: one number per 1000 rpm round the arc.
  private dial_ticks(redline: number) {
    this.redline = redline;
    const group = this.el.dial_ticks;
    const count = Math.floor(redline / 1000);
    const nodes: SVGElement[] = [];
    for (let i = 0; i <= count; i++) {
      const a = DIAL_START + (DIAL_SWEEP * i * 1000) / redline;
      const tick = document.createElementNS(SVG, "line");
      tick.setAttribute("x1", String(100 + Math.cos(a) * (DIAL_R - 6)));
      tick.setAttribute("y1", String(100 + Math.sin(a) * (DIAL_R - 6)));
      tick.setAttribute("x2", String(100 + Math.cos(a) * (DIAL_R + 6)));
      tick.setAttribute("y2", String(100 + Math.sin(a) * (DIAL_R + 6)));
      const label = document.createElementNS(SVG, "text");
      label.setAttribute("x", String(100 + Math.cos(a) * (DIAL_R - 17)));
      label.setAttribute("y", String(100 + Math.sin(a) * (DIAL_R - 17)));
      label.textContent = String(i);
      nodes.push(tick, label);
    }
    group.replaceChildren(...nodes);
  }

  private draw_note(car: Car, gate: { x: number; z: number } | null) {
    const { el } = this;
    set_hidden(el.map_note, gate === null);
    if (!gate) return;
    const metres = Math.round(Math.hypot(gate.x - car.pos.x, gate.z - car.pos.z) / 10) * 10;
    if (metres === this.metres) return;
    this.metres = metres;
    set_text(el.map_dist, metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`);
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

  private draw_map(car: Car, now: number) {
    const run = this.run_route();
    const route = run ? run.id : this.lobby.route;
    // Lap gates are the circuit's; a run on any route brings its own.
    const gate = run ? run.gate : route === CIRCUIT ? this.world.checkpoints[this.race.next] : null;
    this.draw_note(car, gate);
    if (this.view === MapView.FULL || this.view === MapView.CLOSE) this.map.show_route(route);
    if ((this.view === MapView.FULL || this.view === MapView.CLOSE) && now - this.names_at >= NAMES_MS) {
      this.names_at = now;
      this.names.clear();
      for (const remote of this.net.remotes.values()) this.names.set(remote.id, this.net.display_name(remote));
    }
    if (this.view === MapView.FULL) this.map.full(car, gate, this.net.remotes.values(), this.names);
    else if (this.view === MapView.CLOSE) this.map.close(car, gate, this.net.remotes.values(), this.names, now);
    else if (this.view === MapView.PACE) this.pace.update(car, route);
  }
}
