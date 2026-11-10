import type { Car } from "../car/car";
import type { Remote } from "../net/net";
import type { RoadPoint, Route } from "../worldgen/types";

interface Dot {
  x: number;
  z: number;
}
import { brand, rgba } from "../theme/palette";
import { ROAD_HALF, SIZE } from "../world/world";

const MAP = 200;
const INK = {
  road: rgba(brand.foreground, 0.5),
  checkpoint: rgba(brand.accent),
  remote: rgba(brand.secondary),
  you: rgba(brand.cottontail),
  label: rgba(brand.foreground),
  halo: rgba(brand.background_darkest, 0.7),
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

const ISLAND: FullView = { cx: 0, cz: 0, scale: (MAP * 1.05) / SIZE };

interface Drawn extends FullView {
  id: string;
  points: readonly RoadPoint[];
  closed: boolean;
  road: Path2D;
  /** Per close-up piece: min x, min z, max x, max z. */
  bounds: Float64Array;
}

const full_x = (v: FullView, x: number) => MAP / 2 + (x - v.cx) * v.scale;
const full_y = (v: FullView, z: number) => MAP / 2 + (z - v.cz) * v.scale;

// A lap shows the whole island; an A to B run is a corner of it, so the full map fits that run's span instead.
function full_view(route: Route): FullView {
  if (route.closed) return ISLAND;
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

function drawn(route: Route): Drawn {
  const { points, closed } = route;
  const view = full_view(route);
  const road = new Path2D();
  points.forEach((p, i) => (i ? road.lineTo(full_x(view, p.x), full_y(view, p.z)) : road.moveTo(full_x(view, p.x), full_y(view, p.z))));
  if (closed) road.closePath();
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
  return { id: route.id, points, closed, road, bounds, ...view };
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

  constructor(
    private canvas: HTMLCanvasElement,
    private routes: readonly Route[],
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("minimap has no 2d context");
    this.ctx = ctx;
    this.font = `600 9px ${getComputedStyle(canvas).fontFamily}`;
  }

  /** The route both views draw: a lobby race's, else the circuit. Rebuilt only when it changes. */
  show_route(id: string) {
    if (id === this.wanted && this.drawn) return;
    this.wanted = id;
    const route = this.routes.find((r) => r.id === id) ?? this.routes[0];
    if (!route) return;
    let next = this.cache.get(route.id);
    if (!next) {
      next = drawn(route);
      this.cache.set(route.id, next);
    }
    if (next === this.drawn) return;
    this.drawn = next;
    this.ratio = 0;
  }

  // The road only changes with the race route and the theme is fixed per load, so the full map's road is stroked once per route and pixel ratio.
  private fit() {
    const ratio = devicePixelRatio;
    if (ratio === this.ratio || !this.drawn) return;
    this.ratio = ratio;
    const size = Math.round(MAP * ratio);
    this.canvas.width = size;
    this.canvas.height = size;
    this.road_layer = new OffscreenCanvas(size, size);
    const road = this.road_layer.getContext("2d");
    if (!road) throw new Error("minimap road layer has no 2d context");
    road.scale(ratio, ratio);
    road.lineWidth = 3;
    road.lineJoin = "round";
    road.strokeStyle = INK.road;
    road.stroke(this.drawn.road);
  }

  private dot(x: number, y: number, radius: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillStyle = INK.you;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(h) * 7, y + Math.cos(h) * 7);
    ctx.lineTo(x + Math.sin(h + 2.5) * 5, y + Math.cos(h + 2.5) * 5);
    ctx.lineTo(x + Math.sin(h - 2.5) * 5, y + Math.cos(h - 2.5) * 5);
    ctx.fill();
  }

  full(car: Car, gate: Dot | null, remotes: Iterable<Remote>) {
    this.fit();
    const { ctx } = this;
    const view = this.drawn ?? ISLAND;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, MAP, MAP);
    ctx.drawImage(this.road_layer, 0, 0, MAP, MAP);
    if (gate) {
      ctx.fillStyle = INK.checkpoint;
      this.dot(full_x(view, gate.x), full_y(view, gate.z), 4.5);
    }
    for (const remote of remotes) this.car(full_x(view, remote.latest.p[0]), full_y(view, remote.latest.p[2]), remote.latest.name);
    this.arrow(full_x(view, car.pos.x), full_y(view, car.pos.z), car.heading);
  }

  close(car: Car, gate: Dot | null, remotes: Iterable<Remote>, now: number) {
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
    ctx.strokeStyle = INK.road;
    this.trace(x, z);
    ctx.stroke();
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.fillStyle = INK.remote;
    // Out of reach, a car rides the rim like the gate, so you still see which way they are.
    for (const remote of remotes) {
      const dx = remote.latest.p[0] - x;
      const dz = remote.latest.p[2] - z;
      const px = cos * dx - sin * dz + cx - MAP / 2;
      const py = sin * dx + cos * dz + cy - MAP / 2;
      const edge = Math.min(1, EDGE / Math.hypot(px, py));
      this.car(MAP / 2 + px * edge, MAP / 2 + py * edge, remote.latest.name);
    }
    if (gate) {
      const gx = cos * (gate.x - x) - sin * (gate.z - z) + cx - MAP / 2;
      const gy = sin * (gate.x - x) + cos * (gate.z - z) + cy - MAP / 2;
      const edge = Math.min(1, EDGE / Math.hypot(gx, gy));
      ctx.fillStyle = INK.checkpoint;
      this.dot(MAP / 2 + gx * edge, MAP / 2 + gy * edge, 4.5);
    }
    this.arrow(cx, cy, Math.PI);
  }

  // One path for every piece in reach: stroked piece by piece, the half-transparent ink doubled up where they meet.
  private trace(x: number, z: number) {
    const { ctx, drawn } = this;
    ctx.beginPath();
    if (!drawn) return;
    const { bounds, points, closed } = drawn;
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
