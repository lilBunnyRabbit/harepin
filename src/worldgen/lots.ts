import { cell_range, sample, vertex } from "./field";
import { hash, length } from "./noise";
import type { Stamp } from "./stamp";
import {
  CELL,
  ORIGIN,
  PropKind,
  ROAD_HALF,
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
} from "./types";

const FRONT_GAP = 3;
const OTHER_ROAD_CLEAR = ROAD_HALF + 8;
const CORNER_CLEAR = 7;
const LOT_RELIEF = 5;
const BAY_W = 2.6;
const BAY_L = 5.2;
const AISLE_MIN = 6.5;
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
  solids: Solid[];
}

function local_to_world(lot: { x: number; z: number; fx: number; fz: number }, lx: number, lz: number): [number, number] {
  return [lot.x + lot.fz * lx + lot.fx * lz, lot.z - lot.fx * lx + lot.fz * lz];
}

export class Lots {
  readonly occupied: Uint8Array;
  readonly out: TownLots = { lots: [], buildings: [], parking: [], props: [], solids: [] };

  constructor(
    private readonly seed: number,
    private readonly terrain: Terrain,
    private readonly stamp: Stamp,
  ) {
    this.occupied = new Uint8Array(terrain.heights.length);
  }

  private fits(x: number, z: number, w: number, d: number, fx: number, fz: number, town: Town, own: number): boolean {
    const { heights, road_dist } = this.terrain;
    let low = Infinity;
    let high = -Infinity;
    for (const [lx, lz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
    ]) {
      const [px, pz] = local_to_world({ x, z, fx, fz }, lx, lz);
      if (length(px - town.x, pz - town.z) > town.radius * 1.15) return false;
      const y = sample(heights, px, pz);
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    if (low < 3 || high - low > LOT_RELIEF) return false;
    return this.scan(x, z, w, d, fx, fz, (k) => !this.occupied[k] && road_dist[k] > (this.stamp.edge_of[k] === own ? ROAD_HALF + 1 : OTHER_ROAD_CLEAR));
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

  street(edge: RoadEdge, town: Town) {
    const a = edge.points[0];
    const b = edge.points[edge.points.length - 1];
    const len = length(b.x - a.x, b.z - a.z);
    const { tx, tz } = a;
    for (const side of [-1, 1] as const) {
      const ox = -tz * side;
      const oz = tx * side;
      let u = CORNER_CLEAR;
      for (let n = 0; ; n++) {
        const r = (k: number) => hash(edge.id * 8 + (side + 1) * 2, n, this.seed + k);
        const w = 14 + r(1) * 8;
        if (u + w > len - CORNER_CLEAR) break;
        const d = 16 + r(2) * 10;
        const along = u + w / 2;
        u += w + 1;
        const x = a.x + tx * along + ox * (edge.half + FRONT_GAP + d / 2);
        const z = a.z + tz * along + oz * (edge.half + FRONT_GAP + d / 2);
        if (!this.fits(x, z, w, d, -ox, -oz, town, edge.id)) continue;
        this.scan(x, z, w, d, -ox, -oz, (k) => {
          this.occupied[k] = 1;
          return true;
        });
        const y = a.y + (b.y - a.y) * (along / len);
        this.stamp.pad(x, z, w, d, -ox, -oz, y, edge.id);
        const reach = length(x - town.x, z - town.z) / town.radius;
        const roll = r(3);
        const kind: LotKind = reach < 0.45 ? (roll < 0.55 ? "shop" : roll < 0.8 ? "parking" : "empty") : roll < 0.7 ? "house" : roll < 0.82 ? "parking" : "empty";
        const lot: Lot = { id: this.out.lots.length, town: town.id, edge: edge.id, side, x, y, z, w, d, fx: -ox, fz: -oz, angle: Math.atan2(-ox, -oz), kind };
        this.out.lots.push(lot);
        const index = Math.max(0, Math.min(edge.points.length - 1, Math.round((along / len) * (edge.points.length - 1))));
        if (kind === "house" || kind === "shop") this.building(lot, r(4), r(5), r(6));
        else if (kind === "parking") this.parking(lot, index);
      }
    }
    this.lights(edge);
  }

  private building(lot: Lot, r1: number, r2: number, r3: number) {
    const shop = lot.kind === "shop";
    const hw = shop ? lot.w / 2 - 1 : lot.w / 2 - 2 - r1 * 1.5;
    const hd = Math.max(3, shop ? lot.d / 2 - 2.5 : lot.d / 2 - 3.5 - r2 * 2);
    const height = shop ? 4.5 + r2 * 6 : 3.2 + r1 * 2.5;
    const roof = shop || r3 < 0.2 ? 0 : 1;
    const [x, z] = local_to_world(lot, 0, -1);
    const building: Building = { lot: lot.id, x, y: lot.y, z, hw, hd, fx: lot.fx, fz: lot.fz, angle: lot.angle, height, style: Math.floor(r3 * 3), roof };
    this.out.buildings.push(building);
    this.out.solids.push({ kind: "box", x, y: lot.y, z, hw, hd, cos: lot.fz, sin: lot.fx, height: height + (roof ? hd * ROOF_PITCH : 0) });
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
      this.out.solids.push({ kind: "box", x, y: lot.y, z, hw: PARKED.w / 2, hd: PARKED.l / 2, cos: lot.fz, sin: lot.fx, height: PARKED.h });
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
      const y = a.y + (b.y - a.y) * (u / len);
      this.out.props.push({ x, y, z, angle: Math.atan2(tz * side, -tx * side), kind: PropKind.STREET_LIGHT, scale: 1 });
      this.out.solids.push({ kind: "circle", x, y, z, radius: 0.18, height: LIGHT_HEIGHT });
    }
  }
}
