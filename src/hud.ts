import type { Car } from "./car";
import type { Lobby } from "./lobby";
import type { Net } from "./net";
import type { Race } from "./race";
import { brand, dark, rgba } from "./palette";
import { SIZE, type World } from "./world";

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
const TOAST_MS = 1200;

export const HudLayout = {
  STRIP: "a",
  CLUSTER: "b",
  CORNERS: "c",
} as const;
export type HudLayout = (typeof HudLayout)[keyof typeof HudLayout];

export class Hud {
  private el = {
    speed: $("speed"),
    gear: $("gear"),
    rpm: $("rpm-fill"),
    shift: $("shift"),
    lap: $("lap"),
    best: $("best"),
    last: $("last"),
    cp: $("cp"),
    toast: $("toast"),
    players: $("players"),
    net: $("net"),
    banner: $("banner"),
    delta: $("delta"),
    rewind: $("rewind"),
    countdown: $("countdown"),
    race_panel: $("race-panel"),
    race_status: $("race-status"),
    race_results: $("race-results"),
    race_call: $("race-call", HTMLButtonElement),
  };
  private map: CanvasRenderingContext2D;
  private road = new Path2D();
  private toast_timer = 0;
  private players_key = "";
  private results_key = "";

  constructor(
    private world: World,
    private race: Race,
    private net: Net,
    room: string,
    private lobby: Lobby,
    layout: HudLayout,
  ) {
    $("room").textContent = room;
    document.body.dataset.hud = layout;
    document.documentElement.dataset.scheme = dark ? "dark" : "light";
    const canvas = $("minimap", HTMLCanvasElement);
    canvas.width = MAP * devicePixelRatio;
    canvas.height = MAP * devicePixelRatio;
    const map = canvas.getContext("2d");
    if (!map) throw new Error("minimap has no 2d context");
    this.map = map;
    this.map.scale(devicePixelRatio, devicePixelRatio);
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

  update(car: Car, now: number, rewinding: boolean) {
    const { el, race } = this;
    el.speed.textContent = String(Math.round(Math.abs(car.forward_speed) * 3.6));
    el.gear.textContent = car.gear === -1 ? "R" : car.gear === 0 ? "N" : String(car.gear);
    el.gear.dataset.mode = car.auto ? "A" : "M";
    el.rpm.style.width = `${Math.min(100, (car.rpm / 7300) * 100)}%`;
    el.rpm.dataset.hot = String(car.rpm > 6600);
    el.shift.dataset.on = String(!car.auto && car.rpm > 6700);
    el.lap.textContent = format(race.started ? now - race.started : null);
    el.best.textContent = format(race.best);
    el.last.textContent = format(race.last);
    el.cp.textContent = race.started ? `${race.next === 0 ? race.gates : race.next} / ${race.gates}` : "drive through the lit gate";

    const rows = [
      { name: `${this.net.name} (you)`, best: race.best, you: true },
      ...[...this.net.remotes.values()].map((r) => ({ name: this.net.display_name(r), best: r.latest.best, you: false })),
    ];
    rows.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
    const players_key = JSON.stringify(rows);
    if (players_key !== this.players_key) {
      this.players_key = players_key;
      el.players.replaceChildren(...rows.map((r) => row(r.name, format(r.best), r.you)));
    }
    const foreign = this.net.foreign.size;
    el.net.textContent = `${this.net.status} · ${this.net.remotes.size} other${this.net.remotes.size === 1 ? "" : "s"}${foreign ? ` · ${foreign} peer${foreign === 1 ? "" : "s"} on a different map` : ""}`;

    const lap_flashing = race.lap_flash && now - race.lap_flash < 2600;
    el.banner.style.opacity = lap_flashing ? "1" : "0";
    if (lap_flashing) el.banner.textContent = `LAP ${format(race.last)}${race.last === race.best ? " · BEST" : ""}`;
    const delta_on = race.delta !== null && now - race.delta_flash < 2200;
    el.delta.style.opacity = delta_on ? "1" : "0";
    if (delta_on && race.delta !== null) {
      el.delta.textContent = `${race.delta < 0 ? "−" : "+"}${(Math.abs(race.delta) / 1000).toFixed(2)}`;
      el.delta.dataset.ahead = String(race.delta < 0);
    }
    el.rewind.style.opacity = rewinding ? "1" : "0";
    this.draw_lobby(now);
    this.draw_map(car);
  }

  private draw_lobby(now: number) {
    const { el } = this;
    const { state, finishers } = this.lobby;
    const count = state.kind === "countdown" ? String(Math.ceil((state.go - now) / 1000)) : state.kind === "racing" && now - state.go < 1000 ? "GO" : "";
    el.countdown.textContent = count;
    el.countdown.style.opacity = count ? "1" : "0";
    el.race_call.textContent = this.lobby.busy ? "Leave race" : "Start race";
    el.race_panel.hidden = state.kind === "idle";
    if (state.kind === "idle") return;
    const laps = `${state.laps} lap${state.laps === 1 ? "" : "s"}`;
    el.race_status.textContent =
      state.kind === "countdown"
        ? `Race · ${laps} · get ready`
        : state.kind === "racing"
          ? `Race · lap ${state.lap + 1}/${state.laps} · ${format(now - state.go)}`
          : `Finished P${state.place} · ${format(state.time)}${state.improved ? " · new best" : ` · best ${format(this.lobby.record.best[state.laps] ?? null)}`}`;
    const results_key = JSON.stringify(finishers);
    if (results_key === this.results_key) return;
    this.results_key = results_key;
    el.race_results.replaceChildren(...finishers.map((f, i) => row(`${i + 1}. ${f.name}${f.you ? " (you)" : ""}`, format(f.time), f.you, f.you ? "" : "claimed")));
  }

  private draw_map(car: Car) {
    const { map } = this;
    map.clearRect(0, 0, MAP, MAP);
    map.lineWidth = 3;
    map.lineJoin = "round";
    map.strokeStyle = rgba(brand.foreground, 0.5);
    map.stroke(this.road);
    const cp = this.world.checkpoints[this.race.next];
    map.fillStyle = rgba(brand.accent);
    map.beginPath();
    map.arc(...this.to_map(cp.x, cp.z), 4.5, 0, Math.PI * 2);
    map.fill();
    for (const remote of this.net.remotes.values()) {
      map.fillStyle = rgba(brand.secondary);
      map.beginPath();
      map.arc(...this.to_map(remote.latest.p[0], remote.latest.p[2]), 3.5, 0, Math.PI * 2);
      map.fill();
    }
    const [x, y] = this.to_map(car.pos.x, car.pos.z);
    const h = car.heading;
    map.fillStyle = rgba(brand.cottontail);
    map.beginPath();
    map.moveTo(x + Math.sin(h) * 7, y + Math.cos(h) * 7);
    map.lineTo(x + Math.sin(h + 2.5) * 5, y + Math.cos(h + 2.5) * 5);
    map.lineTo(x + Math.sin(h - 2.5) * 5, y + Math.cos(h - 2.5) * 5);
    map.fill();
  }
}
