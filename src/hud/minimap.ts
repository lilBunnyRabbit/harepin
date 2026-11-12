import type { Car } from "../car/car";
import type { MapMarker } from "../career/markers";
import type { Remote } from "../net/net";
import type { RoadPoint, Route } from "../worldgen/types";

interface Dot {
  x: number;
  z: number;
}
import { brand, dark, rgba } from "../theme/palette";
import { ROAD_HALF } from "../world/world";

const MAP = 200;
// The disc's own fill (--surface's base): the rings that keep marks off the route and the N off the roads match the plate
// rather than drawing a halo around them.
const plate = dark ? brand.background_darkest : brand.background_lighter;
const INK = {
  road: rgba(brand.foreground, 0.5),
  checkpoint: rgba(brand.accent),
  later: rgba(brand.accent, 0.45),
  remote: rgba(brand.secondary),
  // A derived light theme's cottontail is a pale tint of primary that vanished on the light disc; the speed has the same
  // swap to foreground.
  you: rgba(dark ? brand.cottontail : brand.foreground),
  label: rgba(brand.foreground),
  halo: rgba(plate),
  route: rgba(brand.primary),
  faint: rgba(brand.foreground, 0.6),
  north: rgba(brand.foreground, 0.9),
  gap: rgba(plate),
  casing: rgba(plate),
};
/** Close-up: about 200 m of road ahead of the car. */
const CLOSE_CAR_Y = 0.7;
const CLOSE_SCALE = 0.7;
/** Seconds for the heading-up map to follow the car's heading, so a slide doesn't spin it with every twitch. */
const CLOSE_TURN_LAG = 0.12;
const PIECE = 32;
const EDGE = MAP / 2 - 6;

/** Full map: the world x/z at its centre and px per metre. */
interface FullView {
  cx: number;
  cz: number;
  scale: number;
}

/** A polyline cut into close-up pieces of `PIECE` points, each with its bounds, so the close-up skips what is out of reach. */
interface Line {
  points: readonly RoadPoint[];
  closed: boolean;
  /** Per close-up piece: min x, min z, max x, max z. */
  bounds: Float64Array;
}

interface Drawn extends FullView, Line {
  id: string;
  road: Path2D;
}

/** Roads past the routes a streamed world's maps draw too: every plan edge off the circuit, and its towns. */
export interface MapNetwork {
  roads: readonly (readonly RoadPoint[])[];
  towns: readonly Dot[];
}

const full_x = (v: FullView, x: number) => MAP / 2 + (x - v.cx) * v.scale;
const full_y = (v: FullView, z: number) => MAP / 2 + (z - v.cz) * v.scale;

// A lap shows the whole world; an A to B run is a corner of it, so the full map fits that run's span instead.
function full_view(route: Route, size: number): FullView {
  if (route.closed) return { cx: 0, cz: 0, scale: (MAP * 1.05) / size };
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of route.points) {
    x0 = Math.min(x0, p.x);
    z0 = Math.min(z0, p.z);
    x1 = Math.max(x1, p.x);
    z1 = Math.max(z1, p.z);
  }
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: EDGE / Math.max(1, Math.hypot(x1 - x0, z1 - z0) / 2) };
}

function line(points: readonly RoadPoint[], closed: boolean): Line {
  const count = Math.ceil(points.length / PIECE);
  const bounds = new Float64Array(count * 4);
  for (let k = 0; k < count; k++) {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let j = 0; j <= PIECE; j++) {
      const i = k * PIECE + j;
      if (!closed && i >= points.length) break;
      const p = points[i % points.length];
      x0 = Math.min(x0, p.x);
      z0 = Math.min(z0, p.z);
      x1 = Math.max(x1, p.x);
      z1 = Math.max(z1, p.z);
    }
    bounds[k * 4] = x0;
    bounds[k * 4 + 1] = z0;
    bounds[k * 4 + 2] = x1;
    bounds[k * 4 + 3] = z1;
  }
  return { points, closed, bounds };
}

function path(view: FullView, points: readonly RoadPoint[], closed: boolean, into = new Path2D()): Path2D {
  points.forEach((p, i) => (i ? into.lineTo(full_x(view, p.x), full_y(view, p.z)) : into.moveTo(full_x(view, p.x), full_y(view, p.z))));
  if (closed) into.closePath();
  return into;
}

function drawn(route: Route, size: number): Drawn {
  const view = full_view(route, size);
  return { id: route.id, road: path(view, route.points, route.closed), ...line(route.points, route.closed), ...view };
}

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private road_layer = new OffscreenCanvas(1, 1);
  private ratio = 0;
  private drawn: Drawn | null = null;
  private wanted = "";
  private cache = new Map<string, Drawn>();
  private turn = Number.NaN;
  private last = 0;
  private readonly font: string;
  private readonly bold: string;

  private readonly network: Line[];
  private markers: readonly MapMarker[] = [];
  /** The floating HUD's disc look: the route bright over faint roads, and an N on the rim. */
  private disc = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private routes: readonly Route[],
    /** World side in metres: a lap's full map shows all of it. */
    private readonly size: number,
    private readonly roads: MapNetwork = { roads: [], towns: [] },
  ) {
    this.network = roads.roads.map((points) => line(points, false));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("minimap has no 2d context");
    this.ctx = ctx;
    this.font = `600 9px ${getComputedStyle(canvas).fontFamily}`;
    this.bold = `800 13px ${getComputedStyle(canvas).fontFamily}`;
  }

  /** The route both views draw: a lobby race's, else the circuit. Rebuilt only when it changes. */
  show_route(id: string) {
    if (id === this.wanted && this.drawn) return;
    this.wanted = id;
    const route = this.routes.find((r) => r.id === id) ?? this.routes[0];
    if (!route) return;
    let next = this.cache.get(route.id);
    if (!next) {
      next = drawn(route, this.size);
      this.cache.set(route.id, next);
    }
    if (next === this.drawn) return;
    this.drawn = next;
    this.ratio = 0;
  }

  // The road only changes with the race route and the theme is fixed per load, so the full map's road is stroked once per route and pixel ratio.
  private fit() {
    const ratio = devicePixelRatio;
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    const size = Math.round(MAP * ratio);
    this.canvas.width = size;
    this.canvas.height = size;
    this.road_layer = new OffscreenCanvas(size, size);
    const road = this.road_layer.getContext("2d");
    if (!road) throw new Error("minimap road layer has no 2d context");
    // A world with no routes (the dune sea) still sizes the canvas: its map is the cars alone.
    if (!this.drawn) return;
    road.scale(ratio, ratio);
    road.lineJoin = "round";
    road.strokeStyle = this.disc ? INK.faint : INK.road;
    const view = this.drawn;
    if (this.network.length) {
      road.lineWidth = this.disc ? 2.25 : 1.5;
      road.stroke(this.roads.roads.reduce((into, points) => path(view, points, false, into), new Path2D()));
      road.fillStyle = INK.road;
      for (const town of this.roads.towns) {
        road.beginPath();
        road.arc(full_x(view, town.x), full_y(view, town.z), 3, 0, Math.PI * 2);
        road.fill();
      }
    }
    road.lineWidth = 3;
    if (this.disc) {
      // A casing of the plate's shade under the ribbon keeps the route clear of the faint roads it crosses.
      road.lineCap = "round";
      road.lineWidth = 7;
      road.strokeStyle = INK.casing;
      road.stroke(this.drawn.road);
      road.lineWidth = 4;
      road.strokeStyle = INK.route;
    }
    road.stroke(this.drawn.road);
  }

  // `turn`: how far north sits clockwise from the top of the map.
  private north(turn: number) {
    if (!this.disc) return;
    const { ctx } = this;
    const r = MAP / 2 - 13;
    const x = MAP / 2 + Math.sin(turn) * r;
    const y = MAP / 2 - Math.cos(turn) * r;
    ctx.font = this.bold;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK.halo;
    ctx.fillStyle = INK.north;
    ctx.strokeText("N", x, y);
    ctx.fillText("N", x, y);
  }

  set_markers(markers: readonly MapMarker[]) {
    this.markers = markers;
  }

  // A diamond, unlike every round mark, so an event start never reads as a gate or a car.
  private marker(x: number, y: number, ink: string) {
    const { ctx } = this;
    const r = this.disc ? 6 : 4.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK.gap;
    ctx.stroke();
    ctx.fill();
  }

  set_disc(on: boolean) {
    if (on === this.disc) return;
    this.disc = on;
    this.ratio = 0;
  }

  // On the disc every mark sits on the bright route; a ring of the page shade keeps two brand colours from touching.
  private dot(x: number, y: number, radius: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (this.disc) this.gap();
    ctx.fill();
  }

  private gap() {
    const { ctx } = this;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK.gap;
    ctx.stroke();
  }

  // Every car dot carries its name, so it never reads as a map mark.
  private car(x: number, y: number, name: string) {
    const { ctx } = this;
    ctx.fillStyle = INK.remote;
    this.dot(x, y, 3.5);
    ctx.font = this.font;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK.halo;
    // Names point inward, so one near the rim stays on the map.
    const left = x > MAP / 2;
    ctx.textAlign = left ? "right" : "left";
    ctx.fillStyle = INK.label;
    ctx.strokeText(name, left ? x - 6 : x + 6, y);
    ctx.fillText(name, left ? x - 6 : x + 6, y);
  }

  private arrow(x: number, y: number, h: number) {
    const { ctx } = this;
    const at = (turn: number, r: number): [number, number] => [x + Math.sin(h + turn) * r, y + Math.cos(h + turn) * r];
    ctx.beginPath();
    if (this.disc) {
      // A long notched chevron: which way you face reads at a glance, even on the phone's small disc.
      ctx.moveTo(...at(0, 19));
      ctx.lineTo(...at(2.6, 14));
      ctx.lineTo(...at(Math.PI, 5));
      ctx.lineTo(...at(-2.6, 14));
      ctx.closePath();
      ctx.fillStyle = INK.you;
      this.gap();
      ctx.fill();
      return;
    }
    ctx.fillStyle = INK.you;
    ctx.moveTo(...at(0, 7));
    ctx.lineTo(...at(2.5, 5));
    ctx.lineTo(...at(-2.5, 5));
    ctx.closePath();
    ctx.fill();
  }

  /** `names`: each car's display name by id; a car missing from it shows the name it sent. */
  full(car: Car, gate: Dot | null, later: readonly Dot[], remotes: Iterable<Remote>, names: ReadonlyMap<string, string>) {
    this.fit();
    const { ctx } = this;
    const view = this.drawn ?? { cx: 0, cz: 0, scale: (MAP * 1.05) / this.size };
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, MAP, MAP);
    ctx.drawImage(this.road_layer, 0, 0, MAP, MAP);
    for (const mark of this.markers) this.marker(full_x(view, mark.x), full_y(view, mark.z), mark.ink);
    ctx.fillStyle = INK.later;
    for (const mark of later) this.dot(full_x(view, mark.x), full_y(view, mark.z), this.disc ? 4 : 3);
    if (gate) {
      ctx.fillStyle = INK.checkpoint;
      this.dot(full_x(view, gate.x), full_y(view, gate.z), this.disc ? 6 : 4.5);
    }
    for (const remote of remotes) this.car(full_x(view, remote.latest.p[0]), full_y(view, remote.latest.p[2]), names.get(remote.id) ?? remote.latest.name);
    this.arrow(full_x(view, car.pos.x), full_y(view, car.pos.z), car.heading);
    this.north(0);
  }

  close(car: Car, gate: Dot | null, later: readonly Dot[], remotes: Iterable<Remote>, names: ReadonlyMap<string, string>, now: number) {
    this.fit();
    const { ctx } = this;
    const heading = car.heading;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (Number.isNaN(this.turn) || dt <= 0) this.turn = heading;
    else {
      const off = heading - this.turn;
      this.turn += (off - 2 * Math.PI * Math.round(off / (2 * Math.PI))) * (1 - Math.exp(-dt / CLOSE_TURN_LAG));
    }
    // Rotating by heading - π turns the car's (sin h, cos h) to straight up.
    const cos = Math.cos(this.turn - Math.PI) * CLOSE_SCALE;
    const sin = Math.sin(this.turn - Math.PI) * CLOSE_SCALE;
    const cx = MAP / 2;
    const cy = MAP * CLOSE_CAR_Y;
    const { x, z } = car.pos;
    const r = this.ratio;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, MAP, MAP);
    ctx.setTransform(r * cos, r * sin, -r * sin, r * cos, r * (cx - cos * x + sin * z), r * (cy - sin * x - cos * z));
    ctx.lineWidth = ROAD_HALF * 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (this.disc) {
      ctx.strokeStyle = INK.faint;
      ctx.beginPath();
      for (const road of this.network) this.trace_line(road, x, z);
      ctx.stroke();
      ctx.beginPath();
      if (this.drawn) this.trace_line(this.drawn, x, z);
      ctx.strokeStyle = INK.casing;
      ctx.lineWidth = ROAD_HALF * 2.6;
      ctx.stroke();
      ctx.strokeStyle = INK.route;
      ctx.lineWidth = ROAD_HALF * 1.6;
      ctx.stroke();
    } else {
      ctx.strokeStyle = INK.road;
      this.trace(x, z);
      ctx.stroke();
    }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    for (const mark of this.markers) {
      const mx = cos * (mark.x - x) - sin * (mark.z - z) + cx - MAP / 2;
      const my = sin * (mark.x - x) + cos * (mark.z - z) + cy - MAP / 2;
      if (Math.hypot(mx, my) <= EDGE) this.marker(MAP / 2 + mx, MAP / 2 + my, mark.ink);
    }
    ctx.fillStyle = INK.remote;
    // Out of reach, a car rides the rim like the gate, so you still see which way they are.
    for (const remote of remotes) {
      const dx = remote.latest.p[0] - x;
      const dz = remote.latest.p[2] - z;
      const px = cos * dx - sin * dz + cx - MAP / 2;
      const py = sin * dx + cos * dz + cy - MAP / 2;
      const edge = Math.min(1, EDGE / Math.hypot(px, py));
      this.car(MAP / 2 + px * edge, MAP / 2 + py * edge, names.get(remote.id) ?? remote.latest.name);
    }
    // Only the gate aimed at rides the rim: the later ones show once they are in reach.
    ctx.fillStyle = INK.later;
    for (const mark of later) {
      const mx = cos * (mark.x - x) - sin * (mark.z - z) + cx - MAP / 2;
      const my = sin * (mark.x - x) + cos * (mark.z - z) + cy - MAP / 2;
      if (Math.hypot(mx, my) <= EDGE) this.dot(MAP / 2 + mx, MAP / 2 + my, this.disc ? 4 : 3);
    }
    if (gate) {
      const gx = cos * (gate.x - x) - sin * (gate.z - z) + cx - MAP / 2;
      const gy = sin * (gate.x - x) + cos * (gate.z - z) + cy - MAP / 2;
      const edge = Math.min(1, EDGE / Math.hypot(gx, gy));
      ctx.fillStyle = INK.checkpoint;
      this.dot(MAP / 2 + gx * edge, MAP / 2 + gy * edge, this.disc ? 6 : 4.5);
    }
    this.arrow(cx, cy, Math.PI);
    this.north(this.turn - Math.PI);
  }

  // One path for every piece in reach: stroked piece by piece, the half-transparent ink doubled up where they meet.
  private trace(x: number, z: number) {
    this.ctx.beginPath();
    if (this.drawn) this.trace_line(this.drawn, x, z);
    for (const road of this.network) this.trace_line(road, x, z);
  }

  private trace_line({ bounds, points, closed }: Line, x: number, z: number) {
    const { ctx } = this;
    const reach = MAP / CLOSE_SCALE;
    const count = bounds.length / 4;
    let joined = false;
    for (let k = 0; k < count; k++) {
      const at = k * 4;
      if (bounds[at] > x + reach || bounds[at + 2] < x - reach || bounds[at + 1] > z + reach || bounds[at + 3] < z - reach) {
        joined = false;
        continue;
      }
      for (let j = joined ? 1 : 0; j <= PIECE; j++) {
        const i = k * PIECE + j;
        if (!closed && i >= points.length) break;
        const p = points[i % points.length];
        if (j) ctx.lineTo(p.x, p.z);
        else ctx.moveTo(p.x, p.z);
      }
      joined = true;
    }
  }

  reset() {
    this.turn = Number.NaN;
  }
}
