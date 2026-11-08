import { cell_range, sample, vertex } from "./field";
import { hash, length } from "./noise";
import type { Stamp } from "./stamp";
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
export const ROOF_PITCH = 0.6;

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
  if (b.roof === Roof.CROSS) return b.hw * ROOF_PITCH;
  if (b.roof === Roof.HIP) return Math.min(b.hw, b.hd) * ROOF_PITCH;
  return 0;
}

function lot_kind(reach: number, roll: number, d: number): LotKind {
  let kind: LotKind;
  if (reach < 0.4) kind = roll < 0.62 ? "shop" : roll < 0.8 ? "house" : roll < 0.92 ? "parking" : "garden";
  else if (reach < 0.75) kind = roll < 0.6 ? "house" : roll < 0.72 ? "shop" : roll < 0.82 ? "parking" : "garden";
  else kind = roll < 0.5 ? "house" : roll < 0.56 ? "parking" : roll < 0.84 ? "garden" : "empty";
  return kind === "parking" && d < PARKING_MIN_D ? "house" : kind;
}

function local_to_world(lot: { x: number; z: number; fx: number; fz: number }, lx: number, lz: number): [number, number] {
  return [lot.x + lot.fz * lx + lot.fx * lz, lot.z - lot.fx * lx + lot.fz * lz];
}

export class Lots {
  readonly occupied: Uint8Array;
  readonly out: TownLots = { lots: [], buildings: [], parking: [], props: [], trees: [], solids: [] };

  constructor(
    private readonly seed: number,
    private readonly terrain: Terrain,
    private readonly stamp: Stamp,
  ) {
    this.occupied = new Uint8Array(terrain.heights.length);
  }

  // Lot corners stay inside the town core, which the plateau holds exactly on the town plane. A highway's shoulder
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
      if (length(px - town.x, pz - town.z) > town.core) return false;
      if (sample(heights, px, pz) < 3) return false;
    }
    const level = (k: number) => street[k] === 1 || owner_dist[k] > ROAD_HALF + SHOULDER;
    if (!this.scan(x, z, w + CELL * 2, d + CELL * 2, fx, fz, level)) return false;
    return this.scan(x, z, w, d, fx, fz, (k) => !this.occupied[k] && road_dist[k] > STREET_CLEAR);
  }

  private scan(x: number, z: number, w: number, d: number, fx: number, fz: number, visit: (k: number) => boolean): boolean {
    const reach = (w + d) / 2;
    const [i0, i1] = cell_range(x - reach, x + reach);
    const [j0, j1] = cell_range(z - reach, z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = ORIGIN + i * CELL - x;
        const dz = ORIGIN + j * CELL - z;
        if (Math.abs(dx * fz - dz * fx) > w / 2 || Math.abs(dx * fx + dz * fz) > d / 2) continue;
        if (!visit(vertex(i, j))) return false;
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
    for (const side of [-1, 1] as const) {
      const ox = -tz * side;
      const oz = tx * side;
      const mx = (a.x + b.x) / 2 + ox * town.block;
      const mz = (a.z + b.z) / 2 + oz * town.block;
      const inner = sample(this.terrain.road_dist, mx, mz) < ROAD_HALF + 1;
      const room = inner ? (town.block - 2 * (edge.half + FRONT_GAP)) * BLOCK_SHARE : Infinity;
      let u = CORNER_CLEAR;
      for (let n = 0; u + LOT_MIN_W <= len - CORNER_CLEAR; n++) {
        const r = (k: number) => hash(edge.id * 8 + (side + 1) * 2, n, this.seed + k);
        const wide = Math.min(12 + r(1) * 8, len - CORNER_CLEAR - u);
        const deep = Math.max(LOT_MIN_D, Math.min(room, 14 + r(2) * 12));
        let placed: { x: number; z: number; w: number; d: number; along: number } | null = null;
        for (const w of wide > LOT_MIN_W ? [wide, LOT_MIN_W] : [wide])
          for (const d of [deep, deep * 0.75, LOT_MIN_D]) {
            if (placed || d < LOT_MIN_D) continue;
            const along = u + w / 2;
            const x = a.x + tx * along + ox * (edge.half + FRONT_GAP + d / 2);
            const z = a.z + tz * along + oz * (edge.half + FRONT_GAP + d / 2);
            if (this.fits(x, z, w, d, -ox, -oz, town)) placed = { x, z, w, d, along };
          }
        if (!placed) {
          u += LOT_SLIDE;
          continue;
        }
        const { x, z, w, d, along } = placed;
        u += w + LOT_GAP;
        this.scan(x, z, w, d, -ox, -oz, (k) => {
          this.occupied[k] = 1;
          return true;
        });
        const reach = length(x - town.x, z - town.z) / town.radius;
        const kind = lot_kind(reach, r(3), d);
        const lot: Lot = { id: this.out.lots.length, town: town.id, edge: edge.id, side, x, y: sample(heights, x, z), z, w, d, fx: -ox, fz: -oz, angle: Math.atan2(-ox, -oz), kind };
        this.out.lots.push(lot);
        const index = Math.max(0, Math.min(edge.points.length - 1, Math.round((along / len) * (edge.points.length - 1))));
        if (kind === "house" || kind === "shop") this.building(lot, reach, r(4), r(5), r(6));
        else if (kind === "parking") this.parking(lot, index);
        else if (kind === "garden") this.garden(lot, 1 + Math.floor(r(7) * 3));
      }
    }
    this.lights(edge);
  }

  private tree(x: number, z: number, roll: number) {
    const y = sample(this.terrain.heights, x, z);
    const scale = 0.7 + roll * 0.6;
    this.out.trees.push({ x, y, z, scale, kind: roll < 0.5 ? 1 : 0 });
    this.out.solids.push({ kind: "circle", x, y, z, radius: TREE_RADIUS * scale, height: TREE_HEIGHT * scale });
  }

  private garden(lot: Lot, count: number) {
    for (let i = 0; i < count; i++) {
      const lx = (hash(lot.id, i, this.seed + 71) - 0.5) * (lot.w - 5);
      const lz = (hash(lot.id, i, this.seed + 72) - 0.5) * (lot.d - 5);
      const [x, z] = local_to_world(lot, lx, lz);
      this.tree(x, z, hash(lot.id, i, this.seed + 73));
    }
  }

  private building(lot: Lot, reach: number, r1: number, r2: number, r3: number) {
    const { heights } = this.terrain;
    const shop = lot.kind === "shop";
    const hw = shop ? lot.w / 2 - 1 : lot.w / 2 - 2 - r1 * 1.5;
    const hd = shop ? Math.max(3, lot.d / 2 - 2.5) : Math.max(3, Math.min(6.5, lot.d / 2 - 3.5 - r2 * 2));
    const floors = shop ? 1 + Math.floor(r2 * (reach < 0.4 ? 4 : 2)) : r1 < 0.4 ? 2 : 1;
    const height = shop ? floors * SHOP_FLOOR + 0.6 : floors * FLOOR + 0.3;
    let roof: Roof;
    if (shop) roof = floors <= 2 && r3 < 0.3 ? Roof.GABLE : Roof.FLAT;
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
      y = Math.min(y, sample(heights, px, pz));
    }
    const building: Building = { lot: lot.id, x, y, z, hw, hd, fx: lot.fx, fz: lot.fz, angle: lot.angle, height, style: Math.floor(r3 * 3), roof };
    this.out.buildings.push(building);
    this.out.solids.push({ kind: "box", x, y, z, hw, hd, cos: lot.fz, sin: lot.fx, height: height + roof_rise(building) });
    const yard = front - hd + lot.d / 2;
    if (!shop && yard > 5 && hash(lot.id, 1, this.seed + 74) < 0.6) {
      const [tx, tz] = local_to_world(lot, (hash(lot.id, 2, this.seed + 74) - 0.5) * (lot.w - 4), -lot.d / 2 + yard / 2);
      this.tree(tx, tz, hash(lot.id, 3, this.seed + 74));
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
      this.out.solids.push({ kind: "box", x, y: sample(this.terrain.heights, x, z), z, hw: PARKED.w / 2, hd: PARKED.l / 2, cos: lot.fz, sin: lot.fx, height: PARKED.h });
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

  private lights(edge: RoadEdge) {
    const a = edge.points[0];
    const b = edge.points[edge.points.length - 1];
    const len = length(b.x - a.x, b.z - a.z);
    const { tx, tz } = a;
    for (let u = CORNER_CLEAR, n = 0; u < len - CORNER_CLEAR; u += LIGHT_EVERY, n++) {
      const side = n % 2 ? 1 : -1;
      const off = side * (edge.half + 1);
      const x = a.x + tx * u - tz * off;
      const z = a.z + tz * u + tx * off;
      if (this.occupied[vertex(Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL))]) continue;
      const y = sample(this.terrain.heights, x, z);
      this.out.props.push({ x, y, z, angle: Math.atan2(tz * side, -tx * side), kind: PropKind.STREET_LIGHT, scale: 1 });
      this.out.solids.push({ kind: "circle", x, y, z, radius: 0.18, height: LIGHT_HEIGHT });
    }
  }
}
