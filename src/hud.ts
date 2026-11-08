import type { Car } from "./car";
import type { Net } from "./net";
import type { Race } from "./race";
import { brand, rgba } from "./palette";
import { SIZE, type World } from "./world";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const format = (ms: number | null) => {
  if (ms === null) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
};

const escape_html = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const MAP = 200;

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
    assists: $("assists"),
    players: $("players"),
    net: $("net"),
    banner: $("banner"),
    delta: $("delta"),
    rewind: $("rewind"),
  };
  private map: CanvasRenderingContext2D;
  private road = new Path2D();
  private assist_key = "";
  private players_key = "";

  constructor(
    private world: World,
    private race: Race,
    private net: Net,
    private name: string,
    room: string,
  ) {
    $("room").textContent = room;
    const canvas = $<HTMLCanvasElement>("minimap");
    canvas.width = MAP * devicePixelRatio;
    canvas.height = MAP * devicePixelRatio;
    this.map = canvas.getContext("2d")!;
    this.map.scale(devicePixelRatio, devicePixelRatio);
    world.road.forEach((p, i) => (i ? this.road.lineTo(...this.to_map(p.x, p.z)) : this.road.moveTo(...this.to_map(p.x, p.z))));
    this.road.closePath();
  }

  private to_map(x: number, z: number): [number, number] {
    return [MAP / 2 + (x / SIZE) * MAP * 1.05, MAP / 2 + (z / SIZE) * MAP * 1.05];
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

    const assist_key = `${car.tcs}${car.abs}${car.assist}${car.auto}${car.tcs_factor < 0.95}${car.wheels.some((w) => w.abs)}`;
    if (assist_key !== this.assist_key) {
      this.assist_key = assist_key;
      el.assists.innerHTML = (
        [
          ["TCS", car.tcs, car.tcs_factor < 0.95],
          ["ABS", car.abs, car.wheels.some((w) => w.abs)],
          ["ASSIST", car.assist, false],
          [car.auto ? "AUTO" : "MANUAL", true, false],
        ] as const
      )
        .map(([label, on, active]) => `<span class="chip" data-on="${on}" data-active="${active}">${label}</span>`)
        .join("");
    }

    const rows = [{ name: `${this.name} (you)`, best: race.best }, ...[...this.net.remotes.values()].map((r) => ({ name: r.latest.name, best: r.latest.best }))];
    rows.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity));
    const players_key = JSON.stringify(rows);
    if (players_key !== this.players_key) {
      this.players_key = players_key;
      el.players.innerHTML = rows.map((r) => `<li><span>${escape_html(r.name)}</span><span>${format(r.best)}</span></li>`).join("");
    }
    el.net.textContent = `${this.net.status} · ${this.net.remotes.size} other${this.net.remotes.size === 1 ? "" : "s"}`;

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
    this.draw_map(car);
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
