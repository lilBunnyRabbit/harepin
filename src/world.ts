import { Vector3 } from "three";
import type { Ground } from "./car";
import { COUPE, type CarSpec } from "./cars";
import { DeckIndex } from "./worldgen/deck";
import { sample, slope_normal } from "./worldgen/field";
import { generate } from "./worldgen/index";
import { ramp_surface, spawn_blocks, type Surface } from "./worldgen/jumps";
import { FALL_DEPTH } from "./worldgen/sky";
import { ROAD_HALF, type WorldKind } from "./worldgen/types";
import type {
  Building,
  Challenge,
  Checkpoint,
  Item,
  Lot,
  ParkingLot,
  Prop,
  Ramp,
  RoadGraph,
  RoadPoint,
  Route,
  Solid,
  Town,
  Tree,
  WorldData,
} from "./worldgen/types";

export { fbm } from "./worldgen/noise";
export { min_radius } from "./worldgen/path";
export { CELL, N, ROAD_HALF, SIDEWALK, SIZE, SPAWN_INDEX } from "./worldgen/types";
export type { Building, Checkpoint, Lot, ParkingLot, Prop, RoadPoint, Route, Solid, Town, Tree } from "./worldgen/types";

const SOLID_CELL = 16;
const ROAD_CELL = 32;
const RESTITUTION = 1.25;
const LANE_PACK = 1 << 16;

export interface Collider {
  pos: Vector3;
  vel: Vector3;
  ang: Vector3;
  readonly heading: number;
  readonly spec: Pick<CarSpec, "mass" | "inertia" | "circles" | "radius" | "band">;
}

export interface Spawn {
  x: number;
  y: number;
  z: number;
  heading: number;
}

interface Contact {
  nx: number;
  nz: number;
  depth: number;
}

function grid_key(cx: number, cz: number) {
  return (cx + 1000) * 4096 + (cz + 1000);
}

/** (bx, bz) is the way back out when the circle centre sits on the solid's own centre and has no direction to offer. */
function circle_contact(solid: Solid, px: number, pz: number, radius: number, bx: number, bz: number): Contact | null {
  const ox = px - solid.x;
  const oz = pz - solid.z;
  if (solid.kind === "circle") {
    const d = Math.sqrt(ox * ox + oz * oz);
    const min = radius + solid.radius;
    if (d >= min) return null;
    if (d < 1e-3) return { nx: bx, nz: bz, depth: min - d };
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

function nearest(grid: Map<number, number[]>, x: number, z: number, at: (item: number) => { x: number; z: number }): number {
  const cx = Math.floor(x / ROAD_CELL);
  const cz = Math.floor(z / ROAD_CELL);
  let best = -1;
  let dist = Infinity;
  for (let ring = 0; ring < 64; ring++) {
    for (let dz = -ring; dz <= ring; dz++)
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const list = grid.get(grid_key(cx + dx, cz + dz));
        if (!list) continue;
        for (const item of list) {
          const p = at(item);
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < dist) {
            dist = d;
            best = item;
          }
        }
      }
    if (best >= 0 && Math.sqrt(dist) <= ring * ROAD_CELL) break;
  }
  return best;
}

export class World implements Ground {
  readonly kind: WorldKind;
  readonly deck: DeckIndex | null;
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
  readonly ramps: Ramp[];
  readonly items: Item[];
  readonly challenges: Challenge[];
  readonly circuit: number[];
  readonly routes: Route[];
  readonly timings: [string, number][];
  private readonly solid_grid = new Map<number, number[]>();
  private readonly nearby: Solid[] = [];
  private readonly road_grid = new Map<number, number[]>();
  /** Every edge's points, packed as edge * LANE_PACK + point index. */
  private readonly lane_grid = new Map<number, number[]>();
  /** Solids a mode puts down for a while; few enough to check every one, so they stay out of the grid. */
  private placed: readonly Solid[] = [];
  private readonly seen: Uint32Array;
  /** Circuit points no car is put down on; see spawn_blocks. */
  private readonly no_spawn: Uint8Array;
  private query = 0;

  /** `data` is `generate(seed)`, passed in when a worker already ran it. */
  constructor(
    readonly seed = 0,
    data: WorldData = generate(seed),
  ) {
    this.kind = data.kind;
    this.deck = data.deck && new DeckIndex(data.deck);
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
    this.ramps = data.ramps;
    this.items = data.items;
    this.challenges = data.challenges;
    this.circuit = data.circuit;
    this.routes = data.routes;
    this.timings = data.timings;
    this.seen = new Uint32Array(this.solids.length);
    this.no_spawn = spawn_blocks(this.road, this.ramps, this.challenges);
    this.solids.forEach((solid, index) => this.index_solid(solid, index));
    this.road.forEach((p, index) => {
      const key = grid_key(Math.floor(p.x / ROAD_CELL), Math.floor(p.z / ROAD_CELL));
      const list = this.road_grid.get(key);
      if (list) list.push(index);
      else this.road_grid.set(key, [index]);
    });
    for (const edge of this.graph.edges)
      edge.points.forEach((p, index) => {
        const key = grid_key(Math.floor(p.x / ROAD_CELL), Math.floor(p.z / ROAD_CELL));
        const list = this.lane_grid.get(key);
        const packed = edge.id * LANE_PACK + index;
        if (list) list.push(packed);
        else this.lane_grid.set(key, [packed]);
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

  /** `y` is the height the query comes from: a deck only counts from above its underside. */
  height(x: number, z: number, y?: number): number {
    const ground = sample(this.heights, x, z);
    const ramp = this.ramp_at(x, z);
    const top = ramp && ramp.y > ground ? ramp.y : ground;
    const deck = this.deck?.surface(x, z, y);
    return deck && deck.y > top ? deck.y : top;
  }

  normal(x: number, z: number, out: Vector3, y?: number): Vector3 {
    const deck = this.deck?.surface(x, z, y);
    if (deck && deck.y > sample(this.heights, x, z)) return out.set(-deck.gx, 1, -deck.gz).normalize();
    const ramp = this.ramp_at(x, z);
    if (ramp && ramp.y > sample(this.heights, x, z)) return out.set(-ramp.gx, 1, -ramp.gz).normalize();
    const [nx, ny, nz] = slope_normal(this.heights, x, z);
    return out.set(nx, ny, nz).normalize();
  }

  private ramp_at(x: number, z: number): Surface | null {
    let top: Surface | null = null;
    for (const r of this.ramps) {
      if (r.deck) continue;
      const s = ramp_surface(r, x, z);
      if (s && (!top || s.y > top.y)) top = s;
    }
    return top;
  }

  /** Sky only: further under every deck near the car than FALL_DEPTH. */
  fallen(pos: Vector3): boolean {
    return this.deck !== null && pos.y < this.deck.floor(pos.x, pos.z) - FALL_DEPTH;
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

  /** Nearest point of the race circuit; its index in `road` places gates and the ghost. */
  nearest_road(x: number, z: number): RoadPoint {
    return this.road[Math.max(0, nearest(this.road_grid, x, z, (index) => this.road[index]))];
  }

  /** The circuit point a car is put down on for `index`: that one, or the first clear one behind it; `step` -1 when the car faces back along the circuit. */
  clear_spawn(index: number, step = 1): number {
    const n = this.road.length;
    let i = ((index % n) + n) % n;
    for (let k = 0; k < n && this.no_spawn[i]; k++) i = (i - step + n) % n;
    return i;
  }

  /** Where a reset puts the car: the nearest point of any road (circuit, spur or street), facing along it the way `fx, fz` points. */
  spawn_near(x: number, z: number, fx: number, fz: number): Spawn {
    const point = (packed: number) => this.graph.edges[Math.floor(packed / LANE_PACK)].points[packed % LANE_PACK];
    const packed = nearest(this.lane_grid, x, z, point);
    let p = packed < 0 ? this.road[0] : point(packed);
    const back = fx * p.tx + fz * p.tz < 0;
    if (packed >= 0 && this.circuit.includes(Math.floor(packed / LANE_PACK))) p = this.road[this.clear_spawn(packed % LANE_PACK, back ? -1 : 1)];
    const heading = Math.atan2(p.tx, p.tz) + (back ? Math.PI : 0);
    return { x: p.x, y: this.height(p.x, p.z), z: p.z, heading };
  }

  /** Returns the function that takes them away again. */
  place(solids: readonly Solid[]): () => void {
    this.placed = [...this.placed, ...solids];
    return () => {
      this.placed = this.placed.filter((solid) => !solids.includes(solid));
    };
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
    for (const offset of spec.circles) for (const solid of this.near(pos.x + fx * offset, pos.z + fz * offset)) impact = Math.max(impact, this.hit(car, solid, offset, fx, fz));
    return impact;
  }

  /** A solid the car could hit within `gap` metres of its body, without pushing it; null when none is. */
  grazes(car: Collider, gap: number): Solid | null {
    const { pos, spec } = car;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const offset of spec.circles) {
      const px = pos.x + fx * offset;
      const pz = pos.z + fz * offset;
      for (const solid of this.near(px, pz)) if (pos.y <= solid.y + solid.height && circle_contact(solid, px, pz, spec.radius + gap, fx, fz)) return solid;
    }
    return null;
  }

  // Runs per collision circle every sim step, so it refills one array instead of allocating a list or a callback.
  private near(px: number, pz: number): readonly Solid[] {
    const found = this.nearby;
    found.length = 0;
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
          found.push(this.solids[index]);
        }
      }
    for (const solid of this.placed) found.push(solid);
    return found;
  }

  private hit(car: Collider, solid: Solid, offset: number, fx: number, fz: number): number {
    const { pos, spec } = car;
    if (solid.kind === "box" && solid.bottom !== undefined) {
      if (pos.y - spec.band[0] > solid.y + solid.height || pos.y + spec.band[1] < solid.y + solid.bottom) return 0;
    } else if (pos.y > solid.y + solid.height) return 0;
    const contact = circle_contact(solid, pos.x + fx * offset, pos.z + fz * offset, spec.radius, -fx * Math.sign(offset || 1), -fz * Math.sign(offset || 1));
    return contact ? this.resolve(car, contact, fx * offset, fz * offset) : 0;
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
