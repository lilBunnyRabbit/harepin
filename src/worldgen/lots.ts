import { TreeKind } from "./biomes";
import { at, sample_on, span_i, span_j, WHOLE, type Grid } from "./field";
import { hash, length } from "./noise";
import type { TownRecipe } from "./recipe";
import { heading, prop_solids } from "./scatter";
import type { Stamp } from "./stamp";
import { on_core } from "./towns";
import { HEDGE_TOP, hedge_runs, high_street_plot, house_shape, row_shape, type Plot, type Shape } from "./town-style";
import {
  CELL,
  ORIGIN,
  PropKind,
  ROAD_HALF,
  Roof,
  SHOULDER,
  SIDEWALK,
  STREET_HALF,
  type Bay,
  type Building,
  type Detail,
  type Lot,
  type LotKind,
  type Obstacle,
  type ParkingLot,
  type Prop,
  type RoadEdge,
  type Solid,
  type Terrain,
  type Town,
  type Tree,
} from "./types";

const FRONT_GAP = SIDEWALK + 1;
/** road_dist every vertex under a lot keeps: half a metre behind the sidewalk of any street. */
const STREET_CLEAR = ROAD_HALF + SIDEWALK + 0.5;
const CORNER_CLEAR = STREET_HALF + SIDEWALK + 1;
const LOT_MIN_W = 10;
const LOT_MIN_D = 10;
const LOT_GAP = 1;
const LOT_SLIDE = 3;
// Inside a block, parcels from all four streets share the space: each reaches about a third of the way in, leaving
// the corners and a back yard to whichever street claims them first.
const BLOCK_SHARE = 0.3;
/** Share of yardless outpost lots whose first prop is a wind pump instead of a water tank. */
const PUMP_ODDS = 0.12;
const FLOOR = 3.2;
const SHOP_FLOOR = 3.6;
const TREE_HEIGHT = 6;
const TREE_RADIUS = 0.35;
const BAY_W = 2.6;
const BAY_L = 5.2;
const AISLE_MIN = 6.5;
const PARKING_MIN_D = 14;
const ENTRY_W = 6;
const PARKED = { w: 1.9, l: 4.5, h: 1.4 };
const LIGHT_EVERY = 30;
const LIGHT_HEIGHT = 6;
const STREET_TREE_EVERY = 12;
const CLOCK = { half: 2.6, height: 15 };
/** A spire climbs this many times its half width. */
const SPIRE_PITCH = 2.7;
const SQUARE_MIN = 16;
export const ROOF_PITCH = 0.6;
/** Mountain village gables, shedding snow. */
const STEEP_PITCH = 1.15;

export interface TownLots {
  lots: Lot[];
  buildings: Building[];
  parking: ParkingLot[];
  props: Prop[];
  trees: Tree[];
  solids: Solid[];
}

export function roof_rise(b: { hw: number; hd: number; roof: Roof }): number {
  if (b.roof === Roof.GABLE) return b.hd * ROOF_PITCH;
  if (b.roof === Roof.STEEP) return b.hd * STEEP_PITCH;
  if (b.roof === Roof.CROSS) return b.hw * ROOF_PITCH;
  if (b.roof === Roof.HIP) return Math.min(b.hw, b.hd) * ROOF_PITCH;
  if (b.roof === Roof.SPIRE) return b.hw * SPIRE_PITCH;
  return 0;
}

function lot_kind(reach: number, roll: number, d: number): LotKind {
  let kind: LotKind;
  if (reach < 0.4) kind = roll < 0.62 ? "shop" : roll < 0.8 ? "house" : roll < 0.92 ? "parking" : "garden";
  else if (reach < 0.75) kind = roll < 0.6 ? "house" : roll < 0.72 ? "shop" : roll < 0.82 ? "parking" : "garden";
  else kind = roll < 0.5 ? "house" : roll < 0.56 ? "parking" : roll < 0.84 ? "garden" : "empty";
  return kind === "parking" && d < PARKING_MIN_D ? "house" : kind;
}

function plain_plot(r1: number, r2: number, wide: number): Plot {
  return { form: null, wide: (12 + r1 * 8) * wide, deep: 14 + r2 * 12, min_w: LOT_MIN_W, gap: LOT_GAP, share: BLOCK_SHARE };
}

function high_kind(plot: Plot, d: number, roll: number): LotKind {
  if (plot.form === null) return d >= PARKING_MIN_D ? "parking" : "garden";
  if (plot.form === "row") return "shop";
  return roll < 0.12 ? "garden" : "house";
}

const off_axis = (town: Town, p: { x: number; z: number }) => Math.abs((p.x - town.x) * town.uz - (p.z - town.z) * town.ux);

function local_to_world(lot: { x: number; z: number; fx: number; fz: number }, lx: number, lz: number): [number, number] {
  return [lot.x + lot.fz * lx + lot.fx * lz, lot.z - lot.fx * lx + lot.fz * lz];
}

interface Character {
  wide: number;
  floors: number;
  taller: number;
  tone: number | null;
}

const PLAIN: Character = { wide: 1, floors: 0, taller: 0, tone: null };

function character(seed: number, town: Town): Character {
  const r = (k: number) => hash(town.id, k, seed + 91);
  return { wide: 0.8 + r(0) * 0.5, floors: Math.floor(r(1) * 3), taller: r(2) * 0.5, tone: Math.floor(r(3) * 3) };
}

interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
  fx: number;
  fz: number;
}

function reach(r: Rect, ax: number, az: number): number {
  return (Math.abs(r.fz * ax - r.fx * az) * r.w + Math.abs(r.fx * ax + r.fz * az) * r.d) / 2;
}

function parted(a: Rect, b: Rect, ax: number, az: number): boolean {
  return Math.abs((b.x - a.x) * ax + (b.z - a.z) * az) >= reach(a, ax, az) + reach(b, ax, az);
}

// Runs for every placed lot against every candidate, so it allocates nothing.
function apart(a: Rect, b: Rect): boolean {
  return parted(a, b, a.fz, -a.fx) || parted(a, b, a.fx, a.fz) || parted(a, b, b.fz, -b.fx) || parted(a, b, b.fx, b.fz);
}

export function empty_lots(): TownLots {
  return { lots: [], buildings: [], parking: [], props: [], trees: [], solids: [] };
}

export class Lots {
  readonly occupied: Uint8Array;
  private readonly placed: Rect[] = [];

  // A shared `out` keeps lot ids running on across several town windows. `ring` holds circuit edge ids: the circuit is
  // drawn ROAD_HALF wide even along a narrower street, so lots and lights keep off that width there.
  constructor(
    private readonly seed: number,
    private readonly terrain: Terrain,
    private readonly stamp: Stamp,
    private readonly shape: TownRecipe,
    private readonly grid: Grid = WHOLE,
    readonly out: TownLots = empty_lots(),
    private readonly ring: ReadonlySet<number> = new Set(),
  ) {
    this.occupied = new Uint8Array(terrain.heights.length);
  }

  private sample(field: Float32Array, x: number, z: number): number {
    return sample_on(this.grid, field, x, z);
  }

  private vertex_at(x: number, z: number): number {
    return at(this.grid, Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL));
  }

  // Lot corners stay on the town core, which the plateau holds exactly on the town plane. A highway's shoulder
  // blends terrain toward that highway's height, so lots keep off any vertex a highway owns, one cell beyond too.
  private fits(x: number, z: number, w: number, d: number, fx: number, fz: number, town: Town): boolean {
    const { heights, road_dist } = this.terrain;
    const { owner_dist, street } = this.stamp;
    for (const [lx, lz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
    ]) {
      const [px, pz] = local_to_world({ x, z, fx, fz }, lx, lz);
      if (!on_core(town, px, pz)) return false;
      if (this.sample(heights, px, pz) < 3) return false;
      if (this.shape.exact && this.sample(road_dist, px, pz) <= STREET_CLEAR) return false;
    }
    const rect = { x, z, w, d, fx, fz };
    if (this.shape.exact && !this.placed.every((o) => apart(o, rect))) return false;
    const level = (k: number) => street[k] === 1 || owner_dist[k] > ROAD_HALF + SHOULDER;
    if (!this.scan(x, z, w + CELL * 2, d + CELL * 2, fx, fz, level)) return false;
    return this.scan(x, z, w, d, fx, fz, (k) => !this.occupied[k] && road_dist[k] > STREET_CLEAR);
  }

  private scan(x: number, z: number, w: number, d: number, fx: number, fz: number, visit: (k: number) => boolean): boolean {
    const reach = (w + d) / 2;
    const [i0, i1] = span_i(this.grid, x - reach, x + reach);
    const [j0, j1] = span_j(this.grid, z - reach, z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = ORIGIN + i * CELL - x;
        const dz = ORIGIN + j * CELL - z;
        if (Math.abs(dx * fz - dz * fx) > w / 2 || Math.abs(dx * fx + dz * fz) > d / 2) continue;
        if (!visit(at(this.grid, i, j))) return false;
      }
    return true;
  }

  // A parcel that runs into the far side of the block or another parcel is retried shallower before the cursor slides.
  street(edge: RoadEdge, town: Town) {
    const { heights } = this.terrain;
    const a = edge.points[0];
    const b = edge.points[edge.points.length - 1];
    const len = length(b.x - a.x, b.z - a.z);
    const { tx, tz } = a;
    const half = this.ring.has(edge.id) ? Math.max(edge.half, ROAD_HALF) : edge.half;
    const look = this.shape.variety ? character(this.seed, town) : PLAIN;
    const high = this.shape.style === "high_street";
    const main = high && off_axis(town, a) < 1 && off_axis(town, b) < 1;
    for (const side of [-1, 1] as const) {
      const ox = -tz * side;
      const oz = tx * side;
      const mx = (a.x + b.x) / 2 + ox * town.block;
      const mz = (a.z + b.z) / 2 + oz * town.block;
      const inner = this.sample(this.terrain.road_dist, mx, mz) < ROAD_HALF + 1;
      let u = CORNER_CLEAR;
      for (let n = 0; ; n++) {
        const r = (k: number) => hash(edge.id * 8 + (side + 1) * 2, n, this.seed + k);
        const back = half + FRONT_GAP + LOT_MIN_D / 2;
        const near = length(a.x + tx * (u + LOT_MIN_D / 2) + ox * back - town.x, a.z + tz * (u + LOT_MIN_D / 2) + oz * back - town.z) / town.radius;
        const plot = high ? high_street_plot(near, main, r(1), r(2), r(3)) : plain_plot(r(1), r(2), look.wide);
        if (u + plot.min_w > len - CORNER_CLEAR) break;
        const room = inner ? (town.block - 2 * (half + FRONT_GAP)) * plot.share : Infinity;
        const wide = Math.min(plot.wide, len - CORNER_CLEAR - u);
        const deep = Math.max(LOT_MIN_D, Math.min(room, plot.deep));
        let placed: { x: number; z: number; w: number; d: number; along: number } | null = null;
        for (const w of wide > plot.min_w ? [wide, plot.min_w] : [wide])
          for (const d of [deep, deep * 0.75, LOT_MIN_D]) {
            if (placed || d < LOT_MIN_D) continue;
            const along = u + w / 2;
            const x = a.x + tx * along + ox * (half + FRONT_GAP + d / 2);
            const z = a.z + tz * along + oz * (half + FRONT_GAP + d / 2);
            if (this.fits(x, z, w, d, -ox, -oz, town)) placed = { x, z, w, d, along };
          }
        if (!placed) {
          u += LOT_SLIDE;
          continue;
        }
        const { x, z, w, d, along } = placed;
        u += w + plot.gap;
        this.placed.push({ x, z, w, d, fx: -ox, fz: -oz });
        this.scan(x, z, w, d, -ox, -oz, (k) => {
          this.occupied[k] = 1;
          return true;
        });
        const reach = length(x - town.x, z - town.z) / town.radius;
        const kind = high ? high_kind(plot, d, r(7)) : lot_kind(reach, r(3), d);
        const lot: Lot = { id: this.out.lots.length, town: town.id, edge: edge.id, side, x, y: this.sample(heights, x, z), z, w, d, fx: -ox, fz: -oz, angle: Math.atan2(-ox, -oz), kind };
        this.out.lots.push(lot);
        const index = Math.max(0, Math.min(edge.points.length - 1, Math.round((along / len) * (edge.points.length - 1))));
        if (kind === "shop" && high) this.shop(lot, r(4));
        else if (kind === "house" && high) this.home(lot, r(4), r(5), r(6));
        else if (kind === "house" || kind === "shop") this.building(lot, reach, look, r(4), r(5), r(6));
        else if (kind === "parking") this.parking(lot, index);
        else if (kind === "garden") this.garden(lot, 1 + Math.floor(r(7) * 3));
      }
    }
    this.lights(edge, half);
    if (high && !main) this.street_trees(edge, half);
  }

  private tree(x: number, z: number, roll: number) {
    const y = this.sample(this.terrain.heights, x, z);
    const scale = 0.7 + roll * 0.6;
    this.out.trees.push({ x, y, z, scale, kind: roll < 1 - this.shape.pines ? TreeKind.BROADLEAF : TreeKind.PINE });
    this.out.solids.push({ kind: "circle", x, y, z, radius: TREE_RADIUS * scale, height: TREE_HEIGHT * scale });
  }

  // A dry yard: the first spot holds a water tank or a wind pump, the rest boulders.
  private yard(x: number, z: number, roll: number, first: boolean) {
    const { k, angle } = heading(roll);
    const prop: Prop = { x, y: this.sample(this.terrain.heights, x, z), z, angle, kind: first ? (roll < PUMP_ODDS ? PropKind.WIND_PUMP : PropKind.TANK) : PropKind.BOULDER, scale: first ? 1 : 0.5 + roll * 0.4 };
    this.out.props.push(prop);
    this.out.solids.push(...prop_solids(prop, k, this.terrain.heights));
  }

  private garden(lot: Lot, count: number) {
    for (let i = 0; i < count; i++) {
      const lx = (hash(lot.id, i, this.seed + 71) - 0.5) * (lot.w - 5);
      const lz = (hash(lot.id, i, this.seed + 72) - 0.5) * (lot.d - 5);
      const [x, z] = local_to_world(lot, lx, lz);
      if (this.shape.trees) this.tree(x, z, hash(lot.id, i, this.seed + 73));
      else this.yard(x, z, hash(lot.id, i, this.seed + 73), i === 0);
    }
  }

  private style(lot: Lot, look: Character, r3: number): number {
    if (look.tone === null || hash(lot.id, 5, this.seed + 74) >= 2 / 3) return Math.floor(r3 * 3);
    return look.tone;
  }

  private building(lot: Lot, reach: number, look: Character, r1: number, r2: number, r3: number) {
    const { heights } = this.terrain;
    const shop = lot.kind === "shop";
    const hw = shop ? lot.w / 2 - 1 : lot.w / 2 - 2 - r1 * 1.5;
    const hd = shop ? Math.max(3, lot.d / 2 - 2.5) : Math.max(3, Math.min(6.5, lot.d / 2 - 3.5 - r2 * 2));
    const floors = shop ? 1 + Math.floor(r2 * (reach < 0.4 ? 4 : 2)) + look.floors : r1 < 0.4 + look.taller ? 2 : 1;
    const height = shop ? floors * SHOP_FLOOR + 0.6 : floors * FLOOR + 0.3;
    let roof: Roof;
    if (this.shape.roofs === "flat") roof = Roof.FLAT;
    else if (this.shape.roofs === "steep") roof = shop && floors > 2 ? Roof.FLAT : Roof.STEEP;
    else if (shop) roof = floors <= 2 && r3 < 0.3 ? Roof.GABLE : Roof.FLAT;
    else roof = r3 < 0.1 ? Roof.FLAT : r3 < 0.5 ? Roof.GABLE : r3 < 0.75 ? Roof.CROSS : Roof.HIP;
    const front = shop ? -1 : lot.d / 2 - 2 - hd;
    const [x, z] = local_to_world(lot, 0, front);
    // Walls reach below the ground, so the base sits at the lowest corner and no corner floats on a tilted plateau.
    let y = Infinity;
    for (const [lx, lz] of [
      [-hw, -hd],
      [hw, -hd],
      [-hw, hd],
      [hw, hd],
    ]) {
      const [px, pz] = local_to_world({ x, z, fx: lot.fx, fz: lot.fz }, lx, lz);
      y = Math.min(y, this.sample(heights, px, pz));
    }
    const building: Building = { lot: lot.id, x, y, z, hw, hd, fx: lot.fx, fz: lot.fz, angle: lot.angle, height, style: this.style(lot, look, r3), roof };
    this.out.buildings.push(building);
    this.out.solids.push({ kind: "box", x, y, z, hw, hd, cos: lot.fz, sin: lot.fx, height: height + roof_rise(building) });
    const yard = front - hd + lot.d / 2;
    if (!shop && yard > 5 && hash(lot.id, 1, this.seed + 74) < 0.6) {
      const [tx, tz] = local_to_world(lot, (hash(lot.id, 2, this.seed + 74) - 0.5) * (lot.w - 4), -lot.d / 2 + yard / 2);
      if (this.shape.trees) this.tree(tx, tz, hash(lot.id, 3, this.seed + 74));
      else this.yard(tx, tz, hash(lot.id, 3, this.seed + 74), false);
    }
  }

  private raise(lot: Lot, shape: Shape, detail: Detail): Building {
    const { hw, hd, height, roof } = shape;
    const [x, z] = local_to_world(lot, 0, shape.front);
    let y = Infinity;
    for (const [lx, lz] of [
      [-hw, -hd],
      [hw, -hd],
      [-hw, hd],
      [hw, hd],
    ]) {
      const [px, pz] = local_to_world({ x, z, fx: lot.fx, fz: lot.fz }, lx, lz);
      y = Math.min(y, this.sample(this.terrain.heights, px, pz));
    }
    const building: Building = { lot: lot.id, x, y, z, hw, hd, fx: lot.fx, fz: lot.fz, angle: lot.angle, height, style: 0, roof, detail };
    this.out.buildings.push(building);
    this.out.solids.push({ kind: "box", x, y, z, hw, hd, cos: lot.fz, sin: lot.fx, height: height + roof_rise(building) });
    return building;
  }

  private shop(lot: Lot, r1: number) {
    const shape = row_shape(lot, r1);
    lot.ground = "paved";
    this.raise(lot, shape, { form: "row", floors: shape.floors, tint: hash(lot.id, 9, this.seed + 74) });
  }

  private home(lot: Lot, r1: number, r2: number, r3: number) {
    const shape = house_shape(lot, r1, r2, r3);
    lot.ground = "yard";
    this.raise(lot, shape, { form: "house", floors: shape.floors, tint: hash(lot.id, 9, this.seed + 74) });
    for (const run of hedge_runs(lot)) {
      const [x, z] = local_to_world(lot, run.x, run.z);
      this.out.solids.push({ kind: "box", x, y: this.sample(this.terrain.heights, x, z), z, hw: run.hw, hd: run.hd, cos: lot.fz, sin: lot.fx, height: HEDGE_TOP });
    }
    const back = shape.front - shape.hd + lot.d / 2;
    const trees = back > 4 ? 1 + Math.floor(hash(lot.id, 1, this.seed + 74) * 2) : 0;
    for (let i = 0; i < trees; i++) {
      const [x, z] = local_to_world(lot, (hash(lot.id, 2 + i, this.seed + 74) - 0.5) * (lot.w - 4), -lot.d / 2 + 1.5 + hash(lot.id, 4 + i, this.seed + 74) * (back - 3));
      this.tree(x, z, hash(lot.id, 6 + i, this.seed + 74));
    }
  }

  private street_tree(x: number, z: number, roll: number) {
    const y = this.sample(this.terrain.heights, x, z);
    const scale = 0.5 + roll * 0.25;
    this.out.trees.push({ x, y, z, scale, kind: TreeKind.BROADLEAF });
    this.out.solids.push({ kind: "circle", x, y, z, radius: TREE_RADIUS * scale, height: TREE_HEIGHT * scale });
  }

  private street_trees(edge: RoadEdge, half: number) {
    const a = edge.points[0];
    const b = edge.points[edge.points.length - 1];
    const len = length(b.x - a.x, b.z - a.z);
    const { tx, tz } = a;
    for (let u = CORNER_CLEAR + STREET_TREE_EVERY / 2, n = 0; u < len - CORNER_CLEAR - 4; u += STREET_TREE_EVERY, n++)
      for (const side of [-1, 1]) {
        const x = a.x + tx * u - tz * side * (half + 1.1);
        const z = a.z + tz * u + tx * side * (half + 1.1);
        if (this.occupied[this.vertex_at(x, z)] || this.sample(this.terrain.road_dist, x, z) < ROAD_HALF + 0.5) continue;
        this.street_tree(x, z, hash(edge.id, n * 2 + side, this.seed + 77));
      }
  }

  /** A paved square on a block beside the town's centre crossing, a clock tower in its middle; a town with no room for one goes without. */
  square(town: Town) {
    const vx = -town.uz;
    const vz = town.ux;
    const full = town.block - 2 * (STREET_HALF + SIDEWALK + 1.5);
    for (const [si, sj] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ])
      for (const s of [full, full - 6, full - 12]) {
        const x = town.x + ((town.ux * si + vx * sj) * town.block) / 2;
        const z = town.z + ((town.uz * si + vz * sj) * town.block) / 2;
        const fx = -vx * sj;
        const fz = -vz * sj;
        if (s < SQUARE_MIN || !this.fits(x, z, s, s, fx, fz, town)) continue;
        this.placed.push({ x, z, w: s, d: s, fx, fz });
        this.scan(x, z, s, s, fx, fz, (k) => {
          this.occupied[k] = 1;
          return true;
        });
        const lot: Lot = { id: this.out.lots.length, town: town.id, edge: -1, side: 1, x, y: this.sample(this.terrain.heights, x, z), z, w: s, d: s, fx, fz, angle: town.angle + (sj * Math.PI) / 2, kind: "plaza", ground: "plaza" };
        this.out.lots.push(lot);
        this.raise(lot, { hw: CLOCK.half, hd: CLOCK.half, floors: 0, height: CLOCK.height, front: 0, roof: Roof.SPIRE }, { form: "clock", floors: 0, tint: 0 });
        for (const [cx, cz] of [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          const [px, pz] = local_to_world(lot, cx * (s / 2 - 4), cz * (s / 2 - 4));
          this.street_tree(px, pz, 1);
        }
        return;
      }
  }

  private parking(lot: Lot, index: number) {
    const count = Math.floor((lot.w - 1) / BAY_W);
    const two_rows = lot.d >= BAY_L * 2 + AISLE_MIN + 1;
    const bays: Bay[] = [];
    const rows: [number, number][] = [[-lot.d / 2 + 0.5 + BAY_L / 2, Math.PI]];
    if (two_rows) rows.push([lot.d / 2 - 0.5 - BAY_L / 2, 0]);
    for (const [bz, heading] of rows)
      for (let i = 0; i < count; i++) {
        const bx = (i - (count - 1) / 2) * BAY_W;
        if (heading === 0 && Math.abs(bx) < ENTRY_W / 2 + BAY_W / 2) continue;
        bays.push({ x: bx, z: bz, heading, w: BAY_W, l: BAY_L, either: heading !== 0, target: false });
      }
    const parked = bays.map((_, i) => hash(lot.id, i, this.seed + 61) < 0.55);
    const empty = bays.map((_, i) => i).filter((i) => !parked[i]);
    const target = empty.length ? empty[Math.floor(hash(lot.id, 0, this.seed + 62) * empty.length)] : Math.floor(bays.length / 2);
    parked[target] = false;
    if (bays[target]) bays[target].target = true;
    const obstacles: Obstacle[] = [];
    bays.forEach((bay, i) => {
      if (!parked[i]) return;
      obstacles.push({ kind: "car", x: bay.x, z: bay.z, heading: bay.heading, w: PARKED.w, l: PARKED.l, h: PARKED.h });
      const [x, z] = local_to_world(lot, bay.x, bay.z);
      this.out.solids.push({ kind: "box", x, y: this.sample(this.terrain.heights, x, z), z, hw: PARKED.w / 2, hd: PARKED.l / 2, cos: lot.fz, sin: lot.fx, height: PARKED.h });
    });
    const difficulty = bays.length ? obstacles.length / bays.length : 0;
    this.out.parking.push({
      id: `${this.seed}:${lot.id}`,
      lot: lot.id,
      kind: "open",
      seed: this.seed,
      difficulty,
      par: 2 + Math.round(difficulty * 4),
      origin: { x: lot.x, z: lot.z, y: lot.y },
      heading: lot.angle,
      size: { w: lot.w, d: lot.d },
      entry: { edge: lot.edge, index, side: lot.side, width: ENTRY_W },
      start: { x: 0, z: lot.d / 2 - 2, heading: Math.PI },
      bays,
      obstacles,
    });
  }

  // An exact town's light also skips any spot inside a crossing road's asphalt.
  private lights(edge: RoadEdge, half: number) {
    const a = edge.points[0];
    const b = edge.points[edge.points.length - 1];
    const len = length(b.x - a.x, b.z - a.z);
    const { tx, tz } = a;
    for (let u = CORNER_CLEAR, n = 0; u < len - CORNER_CLEAR; u += LIGHT_EVERY, n++) {
      const side = n % 2 ? 1 : -1;
      const off = side * (half + 1);
      const x = a.x + tx * u - tz * off;
      const z = a.z + tz * u + tx * off;
      if (this.occupied[this.vertex_at(x, z)] || (this.shape.exact && this.sample(this.terrain.road_dist, x, z) < ROAD_HALF + 0.5)) continue;
      const y = this.sample(this.terrain.heights, x, z);
      this.out.props.push({ x, y, z, angle: Math.atan2(tz * side, -tx * side), kind: PropKind.STREET_LIGHT, scale: 1 });
      this.out.solids.push({ kind: "circle", x, y, z, radius: 0.18, height: LIGHT_HEIGHT });
    }
  }
}
