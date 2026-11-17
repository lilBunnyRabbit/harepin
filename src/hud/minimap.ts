import type { Car } from "../car/car";
import type { MapMarker } from "../career/markers";
import type { Remote } from "../net/net";
import { brand, dark, lighten, rgba } from "../theme/palette";
import type { RoadPoint, Route } from "../worldgen/types";

interface Dot {
  x: number;
  z: number;
}

const W = 252;
const H = 136;
/** Realistic shows the world this many times larger than a map of all of it would, so the card is a window that follows the car. */
const REAL_ZOOM = 2.3;
/** CSS px side of the whole world in the Realistic map; the map's picture is painted at this size. */
export const PICTURE_SIDE = Math.round(W * REAL_ZOOM);
const LINE_PAD = 14;
/** Px per metre. */
const CLOSE_SCALE = 0.6;
const CLOSE_CAR_Y = 0.76;
/** Seconds for the heading-up map to follow the car's heading, so a slide doesn't spin it with every twitch. */
const CLOSE_TURN_LAG = 0.12;
/** Close-up roads are drawn wider than they are, in px, so the one driven reads as a band and not a hairline. */
const CLOSE_ROAD = 16;
const CLOSE_SIDE = 9;
const PIECE = 32;
const EDGE_X = W / 2 - 9;
const EDGE_Y = H / 2 - 9;

// The card's own shade (--deep): the ring round every mark matches it, so two brand colours never touch.
const deep = dark ? lighten(brand.background_darkest, -0.06) : brand.background_lighter;
const INK = {
  ring: rgba(deep),
  track: rgba(brand.foreground),
  road: rgba(brand.foreground, 0.5),
  band: rgba(brand.background_lightest),
  side: rgba(brand.background_light),
  ahead: rgba(brand.cottontail),
  gate: rgba(brand.cottontail),
  later: rgba(brand.cottontail, 0.55),
  rival: rgba(brand.accent),
  you: rgba(brand.info),
};

/** A polyline cut into close-up pieces of `PIECE` points, each with its bounds, so the close-up skips what is out of reach. */
interface Line {
  points: readonly RoadPoint[];
  closed: boolean;
  /** Per close-up piece: min x, min z, max x, max z. */
  bounds: Float64Array;
}

interface Drawn extends Line {
  id: string;
  road: Path2D;
  cx: number;
  cz: number;
  scale: number;
  finish: Dot;
  finish_dx: number;
  finish_dz: number;
}

/** Roads past the routes a streamed world's maps draw too: every plan edge off the circuit, and its towns. */
export interface MapNetwork {
  roads: readonly (readonly RoadPoint[])[];
  towns: readonly Dot[];
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

function path(points: readonly RoadPoint[], closed: boolean, into = new Path2D()): Path2D {
  points.forEach((p, i) => (i ? into.lineTo(p.x, p.z) : into.moveTo(p.x, p.z)));
  if (closed) into.closePath();
  return into;
}

function drawn(route: Route): Drawn {
  const { points, closed } = route;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    z0 = Math.min(z0, p.z);
    x1 = Math.max(x1, p.x);
    z1 = Math.max(z1, p.z);
  }
  // A lap finishes where it starts; an A to B run at its last point.
  const at = closed ? 0 : points.length - 1;
  const finish = points[at];
  const next = points[closed ? 1 : at - 1] ?? finish;
  const length = Math.hypot(next.x - finish.x, next.z - finish.z) || 1;
  return {
    id: route.id,
    road: path(points, closed),
    ...line(points, closed),
    cx: (x0 + x1) / 2,
    cz: (z0 + z1) / 2,
    scale: Math.min((W - 2 * LINE_PAD) / Math.max(1, x1 - x0), (H - 2 * LINE_PAD) / Math.max(1, z1 - z0)),
    finish,
    finish_dx: (next.x - finish.x) / length,
    finish_dz: (next.z - finish.z) / length,
  };
}

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private real_layer = new OffscreenCanvas(1, 1);
  private line_layer = new OffscreenCanvas(1, 1);
  private real_ok = false;
  private line_ok = false;
  private ratio = 0;
  private drawn: Drawn | null = null;
  private wanted = "";
  private cache = new Map<string, Drawn>();
  private turn = Number.NaN;
  private last = 0;
  private picture: CanvasImageSource | null = null;
  private readonly network: Line[];
  private readonly network_path: Path2D;
  private markers: readonly MapMarker[] = [];
  private bar_x = Number.NaN;
  private bar_z = Number.NaN;
  private bar_dx = 0;
  private bar_dz = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private routes: readonly Route[],
    /** World side in metres. */
    private readonly size: number,
    private readonly roads: MapNetwork = { roads: [], towns: [] },
  ) {
    this.network = roads.roads.map((points) => line(points, false));
    this.network_path = roads.roads.reduce((into, points) => path(points, false, into), new Path2D());
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("minimap has no 2d context");
    this.ctx = ctx;
  }

  /** The route every view draws: a run's, a lobby race's, else the circuit. Rebuilt only when it changes. */
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
    this.real_ok = false;
    this.line_ok = false;
    this.bar_x = Number.NaN;
  }

  /** The map's own picture, the whole world on a square: Realistic draws it under the route. Without one it draws the roads it knows. */
  set_picture(picture: CanvasImageSource) {
    this.picture = picture;
    this.real_ok = false;
  }

  set_markers(markers: readonly MapMarker[]) {
    this.markers = markers;
  }

  reset() {
    this.turn = Number.NaN;
  }

  private fit() {
    const ratio = devicePixelRatio;
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.canvas.width = Math.round(W * ratio);
    this.canvas.height = Math.round(H * ratio);
    this.real_ok = false;
    this.line_ok = false;
  }

  // Each layer changes only with the route, the picture and the pixel ratio, so the frame loop blits it.
  private paint_real() {
    this.real_ok = true;
    const side = Math.round(PICTURE_SIDE * this.ratio);
    this.real_layer = new OffscreenCanvas(side, side);
    const ctx = this.real_layer.getContext("2d");
    if (!ctx) throw new Error("minimap layer has no 2d context");
    if (this.picture) ctx.drawImage(this.picture, 0, 0, side, side);
    const k = side / this.size;
    ctx.setTransform(k, 0, 0, k, side / 2, side / 2);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (!this.picture) {
      ctx.strokeStyle = INK.road;
      ctx.lineWidth = (1.5 * this.ratio) / k;
      ctx.stroke(this.network_path);
      ctx.fillStyle = INK.road;
      for (const town of this.roads.towns) {
        ctx.beginPath();
        ctx.arc(town.x, town.z, (3 * this.ratio) / k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (this.drawn) this.ribbon(ctx, this.drawn.road, (this.ratio * 3) / k);
  }

  private paint_line(route: Drawn) {
    this.line_ok = true;
    const { ratio } = this;
    this.line_layer = new OffscreenCanvas(Math.round(W * ratio), Math.round(H * ratio));
    const ctx = this.line_layer.getContext("2d");
    if (!ctx) throw new Error("minimap layer has no 2d context");
    const k = route.scale * ratio;
    ctx.setTransform(k, 0, 0, k, (W / 2) * ratio - route.cx * k, (H / 2) * ratio - route.cz * k);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.ribbon(ctx, route.road, 4.5 / route.scale);
    const half = 6 / route.scale;
    ctx.beginPath();
    ctx.moveTo(route.finish.x - route.finish_dz * half, route.finish.z + route.finish_dx * half);
    ctx.lineTo(route.finish.x + route.finish_dz * half, route.finish.z - route.finish_dx * half);
    ctx.lineWidth = 6.5 / route.scale;
    ctx.strokeStyle = INK.ring;
    ctx.stroke();
    ctx.lineWidth = 3.5 / route.scale;
    ctx.strokeStyle = INK.track;
    ctx.stroke();
  }

  private ribbon(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, road: Path2D, width: number) {
    ctx.lineWidth = width * 2;
    ctx.strokeStyle = INK.ring;
    ctx.stroke(road);
    ctx.lineWidth = width;
    ctx.strokeStyle = INK.track;
    ctx.stroke(road);
  }

  private ringed(ink: string) {
    const { ctx } = this;
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK.ring;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fill();
  }

  private dot(x: number, y: number, radius: number, ink: string) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ringed(ink);
  }

  private diamond(x: number, y: number, r: number, ink: string) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    this.ringed(ink);
  }

  // The gate aimed at is a ring, hollow to the card's shade, so it never reads as a car.
  private gate(x: number, y: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK.ring;
    ctx.stroke();
    ctx.fillStyle = INK.ring;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK.gate;
    ctx.stroke();
  }

  // A mark past the card's edge rides the edge, so the way to it still shows.
  private edge(dx: number, dy: number): number {
    return Math.min(1, EDGE_X / Math.max(1e-6, Math.abs(dx)), EDGE_Y / Math.max(1e-6, Math.abs(dy)));
  }

  private clear() {
    const { ctx, ratio } = this;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
  }

  real(car: Car, gate: Dot | null, later: readonly Dot[], remotes: Iterable<Remote>, field: readonly Car[]) {
    this.fit();
    if (!this.real_ok) this.paint_real();
    this.clear();
    const { ctx } = this;
    const k = PICTURE_SIDE / this.size;
    const { x, z } = car.pos;
    ctx.drawImage(this.real_layer, W / 2 - (x + this.size / 2) * k, H / 2 - (z + this.size / 2) * k, PICTURE_SIDE, PICTURE_SIDE);
    for (const mark of this.markers) {
      const mx = (mark.x - x) * k;
      const my = (mark.z - z) * k;
      if (Math.abs(mx) <= EDGE_X && Math.abs(my) <= EDGE_Y) this.diamond(W / 2 + mx, H / 2 + my, 4, mark.ink);
    }
    for (const mark of later) {
      const mx = (mark.x - x) * k;
      const my = (mark.z - z) * k;
      if (Math.abs(mx) <= EDGE_X && Math.abs(my) <= EDGE_Y) this.dot(W / 2 + mx, H / 2 + my, 2.5, INK.later);
    }
    if (gate) {
      const gx = (gate.x - x) * k;
      const gy = (gate.z - z) * k;
      const edge = this.edge(gx, gy);
      this.gate(W / 2 + gx * edge, H / 2 + gy * edge);
    }
    for (const remote of remotes) {
      const rx = (remote.latest.p[0] - x) * k;
      const ry = (remote.latest.p[2] - z) * k;
      const edge = this.edge(rx, ry);
      this.dot(W / 2 + rx * edge, H / 2 + ry * edge, 4, INK.rival);
    }
    for (const rival of field) {
      if (!Number.isFinite(rival.pos.x)) continue;
      const rx = (rival.pos.x - x) * k;
      const ry = (rival.pos.z - z) * k;
      const edge = this.edge(rx, ry);
      this.dot(W / 2 + rx * edge, H / 2 + ry * edge, 4, INK.rival);
    }
    this.diamond(W / 2, H / 2, 6.5, INK.you);
  }

  /** The route alone, all of it. False when there is no route to draw, so the caller can show another view. */
  line(car: Car, gate: Dot | null, remotes: Iterable<Remote>, field: readonly Car[]): boolean {
    const route = this.drawn;
    if (!route) return false;
    this.fit();
    if (!this.line_ok) this.paint_line(route);
    this.clear();
    const { ctx } = this;
    const k = route.scale;
    const ox = W / 2 - route.cx * k;
    const oy = H / 2 - route.cz * k;
    ctx.drawImage(this.line_layer, 0, 0, W, H);
    if (gate) this.gate(ox + gate.x * k, oy + gate.z * k);
    for (const remote of remotes) this.dot(ox + remote.latest.p[0] * k, oy + remote.latest.p[2] * k, 4, INK.rival);
    for (const rival of field) if (Number.isFinite(rival.pos.x)) this.dot(ox + rival.pos.x * k, oy + rival.pos.z * k, 4, INK.rival);
    this.diamond(ox + car.pos.x * k, oy + car.pos.z * k, 6.5, INK.you);
    return true;
  }

  /** `from`: the route point the run has reached; the route is lit only from there on. */
  close(car: Car, gate: Dot | null, later: readonly Dot[], remotes: Iterable<Remote>, field: readonly Car[], from: number, now: number) {
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
    const cx = W / 2;
    const cy = H * CLOSE_CAR_Y;
    const { x, z } = car.pos;
    const r = this.ratio;
    this.clear();
    ctx.setTransform(r * cos, r * sin, -r * sin, r * cos, r * (cx - cos * x + sin * z), r * (cy - sin * x - cos * z));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const road of this.network) this.trace_line(road, x, z);
    ctx.lineWidth = CLOSE_SIDE / CLOSE_SCALE;
    ctx.strokeStyle = INK.side;
    ctx.stroke();
    if (this.drawn) {
      ctx.beginPath();
      this.trace_line(this.drawn, x, z);
      ctx.lineWidth = CLOSE_ROAD / CLOSE_SCALE;
      ctx.strokeStyle = INK.band;
      ctx.stroke();
      if (from > 0) {
        ctx.beginPath();
        this.trace_line(this.drawn, x, z, from);
      }
      ctx.lineWidth = 2.5 / CLOSE_SCALE;
      ctx.strokeStyle = INK.ahead;
      ctx.stroke();
    }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    const ox = cx - W / 2;
    const oy = cy - H / 2;
    for (const mark of this.markers) {
      const mx = cos * (mark.x - x) - sin * (mark.z - z) + ox;
      const my = sin * (mark.x - x) + cos * (mark.z - z) + oy;
      if (Math.abs(mx) <= EDGE_X && Math.abs(my) <= EDGE_Y) this.diamond(W / 2 + mx, H / 2 + my, 4, mark.ink);
    }
    for (const mark of later) {
      const mx = cos * (mark.x - x) - sin * (mark.z - z) + ox;
      const my = sin * (mark.x - x) + cos * (mark.z - z) + oy;
      if (Math.abs(mx) <= EDGE_X && Math.abs(my) <= EDGE_Y) this.dot(W / 2 + mx, H / 2 + my, 2.5, INK.later);
    }
    if (gate) {
      const gx = cos * (gate.x - x) - sin * (gate.z - z) + ox;
      const gy = sin * (gate.x - x) + cos * (gate.z - z) + oy;
      const edge = this.edge(gx, gy);
      if (edge < 1 || !this.aim_bar(gate)) this.gate(W / 2 + gx * edge, H / 2 + gy * edge);
      else {
        // Across the route: the route's direction turned a quarter, then by the map's own turn.
        const bx = (cos * -this.bar_dz - sin * this.bar_dx) / CLOSE_SCALE;
        const by = (sin * -this.bar_dz + cos * this.bar_dx) / CLOSE_SCALE;
        const half = CLOSE_ROAD / 2 + 3;
        ctx.beginPath();
        ctx.moveTo(W / 2 + gx - bx * half, H / 2 + gy - by * half);
        ctx.lineTo(W / 2 + gx + bx * half, H / 2 + gy + by * half);
        ctx.lineWidth = 7;
        ctx.strokeStyle = INK.ring;
        ctx.stroke();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = INK.gate;
        ctx.stroke();
      }
    }
    for (const remote of remotes) {
      const dx = remote.latest.p[0] - x;
      const dz = remote.latest.p[2] - z;
      const px = cos * dx - sin * dz + ox;
      const py = sin * dx + cos * dz + oy;
      const edge = this.edge(px, py);
      this.dot(W / 2 + px * edge, H / 2 + py * edge, 4, INK.rival);
    }
    for (const rival of field) {
      if (!Number.isFinite(rival.pos.x)) continue;
      const dx = rival.pos.x - x;
      const dz = rival.pos.z - z;
      const px = cos * dx - sin * dz + ox;
      const py = sin * dx + cos * dz + oy;
      const edge = this.edge(px, py);
      this.dot(W / 2 + px * edge, H / 2 + py * edge, 4, INK.rival);
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 7.5, cy + 8);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx - 7.5, cy + 8);
    ctx.closePath();
    this.ringed(INK.you);
  }

  // The route's direction at the gate, found once per gate: the nearest route point and the one after it.
  private aim_bar(gate: Dot): boolean {
    const route = this.drawn;
    if (!route) return false;
    if (gate.x === this.bar_x && gate.z === this.bar_z) return true;
    const { points, closed } = route;
    let best = 0;
    let least = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = (points[i].x - gate.x) ** 2 + (points[i].z - gate.z) ** 2;
      if (d < least) {
        least = d;
        best = i;
      }
    }
    const a = points[best];
    const b = points[best + 1] ?? (closed ? points[0] : points[best - 1]);
    if (!b) return false;
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    this.bar_x = gate.x;
    this.bar_z = gate.z;
    this.bar_dx = (b.x - a.x) / length;
    this.bar_dz = (b.z - a.z) / length;
    return true;
  }

  private trace_line({ bounds, points, closed }: Line, x: number, z: number, from = 0) {
    const { ctx } = this;
    const reach = W / CLOSE_SCALE;
    const count = bounds.length / 4;
    let joined = false;
    for (let k = 0; k < count; k++) {
      const at = k * 4;
      if ((k + 1) * PIECE < from || bounds[at] > x + reach || bounds[at + 2] < x - reach || bounds[at + 1] > z + reach || bounds[at + 3] < z - reach) {
        joined = false;
        continue;
      }
      let pen = joined;
      for (let j = Math.max(joined ? 1 : 0, from - k * PIECE); j <= PIECE; j++) {
        const i = k * PIECE + j;
        if (!closed && i >= points.length) break;
        const p = points[i % points.length];
        if (pen) ctx.lineTo(p.x, p.z);
        else ctx.moveTo(p.x, p.z);
        pen = true;
      }
      joined = true;
    }
  }
}
