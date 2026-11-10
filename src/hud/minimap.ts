import type { Car } from "../car/car";
import type { Remote } from "../net/net";
import type { Checkpoint, RoadPoint } from "../worldgen/types";
import { brand, rgba } from "../theme/palette";
import { ROAD_HALF, SIZE } from "../world/world";

const MAP = 200;
const INK = {
  road: rgba(brand.foreground, 0.5),
  checkpoint: rgba(brand.accent),
  remote: rgba(brand.secondary),
  you: rgba(brand.cottontail),
};
/** Close-up: about 200 m of road ahead of the car. */
const CLOSE_CAR_Y = 0.7;
const CLOSE_SCALE = 0.7;
/** Seconds for the heading-up map to follow the car's heading, so a slide doesn't spin it with every twitch. */
const CLOSE_TURN_LAG = 0.12;
const PIECE = 32;
const EDGE = MAP / 2 - 6;

export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private road = new Path2D();
  private road_layer = new OffscreenCanvas(1, 1);
  private ratio = 0;
  private bounds: Float64Array;
  private turn = Number.NaN;
  private last = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private points: readonly RoadPoint[],
  ) {
    const road = points;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("minimap has no 2d context");
    this.ctx = ctx;
    road.forEach((p, i) => (i ? this.road.lineTo(...this.to_full(p.x, p.z)) : this.road.moveTo(...this.to_full(p.x, p.z))));
    this.road.closePath();
    const count = Math.ceil(road.length / PIECE);
    this.bounds = new Float64Array(count * 4);
    for (let k = 0; k < count; k++) {
      let x0 = Infinity;
      let z0 = Infinity;
      let x1 = -Infinity;
      let z1 = -Infinity;
      for (let j = 0; j <= PIECE; j++) {
        const p = road[(k * PIECE + j) % road.length];
        x0 = Math.min(x0, p.x);
        z0 = Math.min(z0, p.z);
        x1 = Math.max(x1, p.x);
        z1 = Math.max(z1, p.z);
      }
      this.bounds.set([x0, z0, x1, z1], k * 4);
    }
  }

  private to_full(x: number, z: number): [number, number] {
    return [MAP / 2 + (x / SIZE) * MAP * 1.05, MAP / 2 + (z / SIZE) * MAP * 1.05];
  }

  // The road never changes for a world and the theme is fixed per load, so the full map's road is stroked once per pixel ratio.
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
    road.scale(ratio, ratio);
    road.lineWidth = 3;
    road.lineJoin = "round";
    road.strokeStyle = INK.road;
    road.stroke(this.road);
  }

  private dot(x: number, y: number, radius: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
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

  full(car: Car, gate: Checkpoint, remotes: Iterable<Remote>) {
    this.fit();
    const { ctx } = this;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, MAP, MAP);
    ctx.drawImage(this.road_layer, 0, 0, MAP, MAP);
    ctx.fillStyle = INK.checkpoint;
    this.dot(...this.to_full(gate.x, gate.z), 4.5);
    ctx.fillStyle = INK.remote;
    for (const remote of remotes) this.dot(...this.to_full(remote.latest.p[0], remote.latest.p[2]), 3.5);
    this.arrow(...this.to_full(car.pos.x, car.pos.z), car.heading);
  }

  close(car: Car, gate: Checkpoint, remotes: Iterable<Remote>, now: number) {
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
    for (const remote of remotes) {
      const dx = remote.latest.p[0] - x;
      const dz = remote.latest.p[2] - z;
      this.dot(cx + cos * dx - sin * dz, cy + sin * dx + cos * dz, 3.5);
    }
    const gx = cos * (gate.x - x) - sin * (gate.z - z) + cx - MAP / 2;
    const gy = sin * (gate.x - x) + cos * (gate.z - z) + cy - MAP / 2;
    const edge = Math.min(1, EDGE / Math.hypot(gx, gy));
    ctx.fillStyle = INK.checkpoint;
    this.dot(MAP / 2 + gx * edge, MAP / 2 + gy * edge, 4.5);
    this.arrow(cx, cy, Math.PI);
  }

  // One path for every piece in reach: stroked piece by piece, the half-transparent ink doubled up where they meet.
  private trace(x: number, z: number) {
    const { ctx, bounds, points } = this;
    const reach = MAP / CLOSE_SCALE;
    const count = bounds.length / 4;
    let joined = false;
    ctx.beginPath();
    for (let k = 0; k < count; k++) {
      const at = k * 4;
      if (bounds[at] > x + reach || bounds[at + 2] < x - reach || bounds[at + 1] > z + reach || bounds[at + 3] < z - reach) {
        joined = false;
        continue;
      }
      for (let j = joined ? 1 : 0; j <= PIECE; j++) {
        const p = points[(k * PIECE + j) % points.length];
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
