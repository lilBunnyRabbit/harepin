import { Vector3 } from "three";
import type { Ground } from "./car";
import { COUPE, type CarSpec } from "./cars";
import { sample, slope_normal } from "./worldgen/field";
import { generate } from "./worldgen/index";
import { ROAD_HALF } from "./worldgen/types";
import type {
  Building,
  Checkpoint,
  Lot,
  ParkingLot,
  Prop,
  RoadGraph,
  RoadPoint,
  Solid,
  Town,
  Tree,
} from "./worldgen/types";

export { fbm } from "./worldgen/noise";
export { min_radius } from "./worldgen/path";
export { CELL, N, ROAD_HALF, SIZE } from "./worldgen/types";
export type { Building, Checkpoint, Lot, ParkingLot, Prop, RoadPoint, Solid, Town, Tree } from "./worldgen/types";

const SOLID_CELL = 16;
const ROAD_CELL = 32;
const RESTITUTION = 1.25;

export interface Collider {
  pos: Vector3;
  vel: Vector3;
  ang: Vector3;
  readonly heading: number;
  readonly spec: Pick<CarSpec, "mass" | "inertia" | "circles" | "radius">;
}

interface Contact {
  nx: number;
  nz: number;
  depth: number;
}

function grid_key(cx: number, cz: number) {
  return (cx + 1000) * 4096 + (cz + 1000);
}

function circle_contact(solid: Solid, px: number, pz: number, radius: number): Contact | null {
  const ox = px - solid.x;
  const oz = pz - solid.z;
  if (solid.kind === "circle") {
    const d = Math.sqrt(ox * ox + oz * oz);
    const min = radius + solid.radius;
    if (d >= min || d < 1e-3) return null;
    return { nx: ox / d, nz: oz / d, depth: min - d };
  }
  const { cos, sin, hw, hd } = solid;
  const lx = ox * cos - oz * sin;
  const lz = ox * sin + oz * cos;
  const cx = Math.max(-hw, Math.min(hw, lx));
  const cz = Math.max(-hd, Math.min(hd, lz));
  let nlx: number;
  let nlz: number;
  let depth: number;
  if (cx !== lx || cz !== lz) {
    const dx = lx - cx;
    const dz = lz - cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= radius) return null;
    nlx = dx / d;
    nlz = dz / d;
    depth = radius - d;
  } else if (hw - Math.abs(lx) < hd - Math.abs(lz)) {
    nlx = Math.sign(lx) || 1;
    nlz = 0;
    depth = hw - Math.abs(lx) + radius;
  } else {
    nlx = 0;
    nlz = Math.sign(lz) || 1;
    depth = hd - Math.abs(lz) + radius;
  }
  return { nx: nlx * cos + nlz * sin, nz: -nlx * sin + nlz * cos, depth };
}

export class World implements Ground {
  readonly heights: Float32Array;
  readonly road_dist: Float32Array;
  /** The race circuit, in driving order; gates and the ghost follow it. */
  readonly road: RoadPoint[];
  readonly graph: RoadGraph;
  readonly towns: Town[];
  readonly lots: Lot[];
  readonly buildings: Building[];
  readonly parking: ParkingLot[];
  readonly props: Prop[];
  readonly trees: Tree[];
  readonly checkpoints: Checkpoint[];
  readonly solids: Solid[];
  readonly circuit: number[];
  readonly timings: [string, number][];
  private readonly solid_grid = new Map<number, number[]>();
  private readonly road_grid = new Map<number, number[]>();
  private readonly seen: Uint32Array;
  private query = 0;

  constructor(readonly seed = 0) {
    const data = generate(seed);
    this.heights = data.terrain.heights;
    this.road_dist = data.terrain.road_dist;
    this.road = data.road;
    this.graph = data.graph;
    this.towns = data.towns;
    this.lots = data.lots;
    this.buildings = data.buildings;
    this.parking = data.parking;
    this.props = data.props;
    this.trees = data.trees;
    this.checkpoints = data.checkpoints;
    this.solids = data.solids;
    this.circuit = data.circuit;
    this.timings = data.timings;
    this.seen = new Uint32Array(this.solids.length);
    this.solids.forEach((solid, index) => this.index_solid(solid, index));
    this.road.forEach((p, index) => {
      const key = grid_key(Math.floor(p.x / ROAD_CELL), Math.floor(p.z / ROAD_CELL));
      const list = this.road_grid.get(key);
      if (list) list.push(index);
      else this.road_grid.set(key, [index]);
    });
  }

  private index_solid(solid: Solid, index: number) {
    const reach = solid.kind === "circle" ? solid.radius : Math.abs(solid.hw * solid.cos) + Math.abs(solid.hd * solid.sin) + Math.abs(solid.hw * solid.sin) + Math.abs(solid.hd * solid.cos);
    const x0 = Math.floor((solid.x - reach) / SOLID_CELL);
    const x1 = Math.floor((solid.x + reach) / SOLID_CELL);
    const z0 = Math.floor((solid.z - reach) / SOLID_CELL);
    const z1 = Math.floor((solid.z + reach) / SOLID_CELL);
    for (let cz = z0; cz <= z1; cz++)
      for (let cx = x0; cx <= x1; cx++) {
        const key = grid_key(cx, cz);
        const list = this.solid_grid.get(key);
        if (list) list.push(index);
        else this.solid_grid.set(key, [index]);
      }
  }

  height(x: number, z: number): number {
    return sample(this.heights, x, z);
  }

  normal(x: number, z: number, out: Vector3): Vector3 {
    const [nx, ny, nz] = slope_normal(this.heights, x, z);
    return out.set(nx, ny, nz).normalize();
  }

  distance_to_road(x: number, z: number): number {
    return sample(this.road_dist, x, z);
  }

  grip(x: number, z: number): number {
    const d = this.distance_to_road(x, z);
    return d < ROAD_HALF + 0.5 ? 1 : d < ROAD_HALF + 3 ? 0.85 : 0.72;
  }

  roll(x: number, z: number): number {
    return this.distance_to_road(x, z) < ROAD_HALF + 3 ? 1 : 12;
  }

  nearest_road(x: number, z: number): RoadPoint {
    const cx = Math.floor(x / ROAD_CELL);
    const cz = Math.floor(z / ROAD_CELL);
    let best = -1;
    let dist = Infinity;
    for (let ring = 0; ring < 64; ring++) {
      for (let dz = -ring; dz <= ring; dz++)
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const list = this.road_grid.get(grid_key(cx + dx, cz + dz));
          if (!list) continue;
          for (const index of list) {
            const p = this.road[index];
            const d = (p.x - x) ** 2 + (p.z - z) ** 2;
            if (d < dist) {
              dist = d;
              best = index;
            }
          }
        }
      if (best >= 0 && Math.sqrt(dist) <= ring * ROAD_CELL) break;
    }
    return this.road[Math.max(0, best)];
  }

  collide(car: Collider): number;
  /** Positional form for callers not yet passing the car; collides as a COUPE. */
  collide(pos: Vector3, vel: Vector3, ang: Vector3, heading: number): number;
  collide(first: Collider | Vector3, vel?: Vector3, ang?: Vector3, heading?: number): number {
    if (!(first instanceof Vector3)) return this.collide_car(first);
    if (!vel || !ang || heading === undefined) throw new Error("collide: positional form needs pos, vel, ang, heading");
    return this.collide_car({ pos: first, vel, ang, heading, spec: COUPE });
  }

  // The car is circles along its heading (nose and tail) so a corner clip spins it instead of stopping it dead; the
  // push and the yaw kick come from the same impulse applied at that circle's offset from the centre of mass.
  private collide_car(car: Collider): number {
    const { pos, spec } = car;
    let impact = 0;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const offset of spec.circles) {
      const px = pos.x + fx * offset;
      const pz = pos.z + fz * offset;
      const cx = Math.floor(px / SOLID_CELL);
      const cz = Math.floor(pz / SOLID_CELL);
      const stamp = ++this.query;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const list = this.solid_grid.get(grid_key(cx + dx, cz + dz));
          if (!list) continue;
          for (const index of list) {
            if (this.seen[index] === stamp) continue;
            this.seen[index] = stamp;
            const solid = this.solids[index];
            if (pos.y > solid.y + solid.height) continue;
            const contact = circle_contact(solid, pos.x + fx * offset, pos.z + fz * offset, spec.radius);
            if (contact) impact = Math.max(impact, this.resolve(car, contact, fx * offset, fz * offset));
          }
        }
    }
    return impact;
  }

  private resolve(car: Collider, { nx, nz, depth }: Contact, rx: number, rz: number): number {
    const { pos, vel, ang, spec } = car;
    const mass = spec.mass;
    const yaw_inertia = spec.inertia[1];
    pos.x += nx * depth;
    pos.z += nz * depth;
    const arm = rz * nx - rx * nz;
    const into = vel.x * nx + vel.z * nz + ang.y * arm;
    if (into >= 0) return 0;
    const impulse = (-into * RESTITUTION) / (1 / mass + (arm * arm) / yaw_inertia);
    vel.x += (nx * impulse) / mass;
    vel.z += (nz * impulse) / mass;
    ang.y += (arm * impulse) / yaw_inertia;
    vel.multiplyScalar(0.9);
    ang.x *= 0.7;
    ang.z *= 0.7;
    return -into;
  }
}
