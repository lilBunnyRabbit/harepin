import { LIFT } from "../worldgen/lifts";
import type { Patch, RimPoint } from "../worldgen/junction";
import { EDGE_INSET, EDGE_WIDTH, GIVE_WAY_OUT, GIVE_WAY_WIDTH, on_paint, road_paint, type Junction, type Junctions, type Paint, type RoadData } from "../worldgen/road-layers";
import { GIVE_WAY_GAP, give_way_dash } from "../worldgen/roads";
import { lot_paving, type Paving } from "../worldgen/town-ground";
import type { Lot, ParkingLot, RoadPoint } from "../worldgen/types";

/** One drawn road: the lift its asphalt is laid at and the paint on it. */
export interface DrawnRoad {
  points: readonly RoadPoint[];
  closed: boolean;
  lift: number;
  paint: Paint;
}

/** Every drawn road by the world's lane number: the circuit at 0, then each other edge at its id + 1. */
export function drawn_roads(data: RoadData, junctions: Junctions): (DrawnRoad | undefined)[] {
  const { ring, edges } = road_paint(data, junctions);
  const roads: (DrawnRoad | undefined)[] = [{ points: data.road, closed: true, lift: LIFT.ring, paint: ring }];
  for (const { street, edge, paint } of edges) roads[edge.id + 1] = { points: edge.points, closed: false, lift: street ? LIFT.street : LIFT.spur, paint };
  return roads;
}

/** (`x`, `z`) is on the road's centre dash or an edge line, by its point `i` nearest there. */
export function on_road_paint(road: DrawnRoad, i: number, x: number, z: number): boolean {
  const p = road.points[i];
  const dx = x - p.x;
  const dz = z - p.z;
  const n = road.points.length;
  let s = dx * p.tx + dz * p.tz >= 0 ? i : i - 1;
  if (road.closed) s = (s + n) % n;
  return s >= 0 && s < road.paint.centre.length && on_paint(road.paint, s, dz * p.tx - dx * p.tz);
}

/** How far the road drawn at (`x`, `z`) stands over the terrain, by its point `i` nearest there: its asphalt, or the paint on it. */
export function road_lift(road: DrawnRoad, i: number, x: number, z: number): number {
  return on_road_paint(road, i, x, z) ? LIFT.mark : road.lift;
}

/** One give-way bar: dashes across a minor arm's mouth, `ahead` of (`x`, `z`) along (`tx`, `tz`). */
interface GiveWay {
  x: number;
  z: number;
  tx: number;
  tz: number;
  half: number;
  dash: number;
}

/** A patched junction as its mesh lays it: the asphalt fan, the edge lines round its corners and the give-way bars at its minor mouths. */
export interface DrawnJunction {
  x: number;
  z: number;
  /** Squared radius from (`x`, `z`) that holds the fan and every bar, for a quick miss. */
  reach2: number;
  patch: Patch;
  bars: GiveWay[];
}

export function drawn_junctions(patched: readonly Junction[]): DrawnJunction[] {
  return patched.map(({ x, z, arms, patch }) => {
    const bars = patch.minor.map((i): GiveWay => {
      const p = arms[i].points[patch.mouths[i]];
      const half = arms[i].half - EDGE_INSET;
      return { x: p.x, z: p.z, tx: p.tx, tz: p.tz, half, dash: give_way_dash(half) };
    });
    let reach = 0;
    for (const p of patch.outline) reach = Math.max(reach, Math.hypot(p.x - x, p.z - z));
    for (const bar of bars) reach = Math.max(reach, Math.hypot(bar.x - x, bar.z - z) + bar.half + GIVE_WAY_OUT + GIVE_WAY_WIDTH);
    return { x, z, reach2: reach * reach, patch, bars };
  });
}

function on_give_way(bar: GiveWay, x: number, z: number): boolean {
  const dx = x - bar.x;
  const dz = z - bar.z;
  const ahead = dx * bar.tx + dz * bar.tz;
  if (ahead < GIVE_WAY_OUT || ahead > GIVE_WAY_OUT + GIVE_WAY_WIDTH) return false;
  const side = dz * bar.tx - dx * bar.tz + bar.half;
  return side >= 0 && side <= bar.half * 2 && side % (bar.dash + GIVE_WAY_GAP) <= bar.dash;
}

// The band `rim_line` lays inward of a rim: between two rim points their `w` turns a few degrees, so it is eased along the chord.
function on_rim_line(line: readonly RimPoint[], x: number, z: number): boolean {
  for (let q = 0; q + 1 < line.length; q++) {
    const a = line[q];
    const b = line[q + 1];
    const bx = b.x - a.x;
    const bz = b.z - a.z;
    const t = ((x - a.x) * bx + (z - a.z) * bz) / (bx * bx + bz * bz || 1);
    if (t < 0 || t > 1) continue;
    const inward = (x - a.x - bx * t) * (a.wx + (b.wx - a.wx) * t) + (z - a.z - bz * t) * (a.wz + (b.wz - a.wz) * t);
    if (inward >= EDGE_INSET && inward <= EDGE_INSET + EDGE_WIDTH) return true;
  }
  return false;
}

/** How far the junction drawn at (`x`, `z`) stands over the terrain: its asphalt, eased between its arms' lifts as the fan lays it, or the paint on it; 0 off the junction. */
export function junction_lift(junction: DrawnJunction, x: number, z: number): number {
  const dx = x - junction.x;
  const dz = z - junction.z;
  if (dx * dx + dz * dz > junction.reach2) return 0;
  for (const bar of junction.bars) if (on_give_way(bar, x, z)) return LIFT.mark;
  const { centre, outline, lines } = junction.patch;
  const n = outline.length;
  for (let q = 0; q < n; q++) {
    const a = outline[q];
    const b = outline[q + 1 === n ? 0 : q + 1];
    const ax = a.x - centre.x;
    const az = a.z - centre.z;
    const bx = b.x - centre.x;
    const bz = b.z - centre.z;
    const det = ax * bz - az * bx;
    if (det === 0) continue;
    const u = (dx * bz - dz * bx) / det;
    const v = (ax * dz - az * dx) / det;
    if (u < 0 || v < 0 || u + v > 1) continue;
    for (const line of lines) if (on_rim_line(line, x, z)) return LIFT.mark;
    return centre.lift + (a.lift - centre.lift) * u + (b.lift - centre.lift) * v;
  }
  return 0;
}

/** Paving laid in one lot's frame, with the radius that holds all of it for a quick miss. */
export interface PavedLot {
  x: number;
  z: number;
  fx: number;
  fz: number;
  reach2: number;
  paving: Paving[];
}

export function paved_lots(lots: readonly Lot[], parking: readonly ParkingLot[]): PavedLot[] {
  const by_lot = new Map<number, Paving[]>();
  for (const lot of lots) {
    const paving = lot_paving(lot);
    if (paving.length) by_lot.set(lot.id, paving);
  }
  for (const park of parking) {
    const { w, d } = park.size;
    by_lot.set(park.lot, [...(by_lot.get(park.lot) ?? []), { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2, lift: LIFT.pad }]);
  }
  return [...by_lot].map(([id, paving]) => {
    const { x, z, fx, fz } = lots[id];
    const reach = Math.max(...paving.map((p) => Math.hypot(Math.max(-p.x0, p.x1), Math.max(-p.z0, p.z1))));
    return { x, z, fx, fz, reach2: reach * reach, paving };
  });
}

/** How far the paving at (`x`, `z`) stands over the terrain, 0 off every lot. */
export function paving_lift(lots: readonly PavedLot[], x: number, z: number): number {
  let lift = 0;
  for (const lot of lots) {
    const dx = x - lot.x;
    const dz = z - lot.z;
    if (dx * dx + dz * dz > lot.reach2) continue;
    // The inverse of `Builder.push`: world offset back into the lot's frame.
    const lx = dx * lot.fz - dz * lot.fx;
    const lz = dx * lot.fx + dz * lot.fz;
    for (const p of lot.paving) if (lx >= p.x0 && lx <= p.x1 && lz >= p.z0 && lz <= p.z1 && p.lift > lift) lift = p.lift;
  }
  return lift;
}

/** A pad a mode lays for a while: a rectangle `u0`-`u1` by `v0`-`v1` in its own frame turned by `heading` about (`x`, `z`), drawn `lift` over whatever is drawn under it. */
export interface LaidPad {
  x: number;
  z: number;
  cos: number;
  sin: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  lift: number;
}

export function laid_pad(x: number, z: number, heading: number, area: { u0: number; u1: number; v0: number; v1: number }, lift: number): LaidPad {
  return { x, z, cos: Math.cos(heading), sin: Math.sin(heading), ...area, lift };
}

/** How far the laid pads at (`x`, `z`) stand over the drawn ground under them, 0 off every pad. */
export function laid_lift(pads: readonly LaidPad[], x: number, z: number): number {
  let lift = 0;
  for (const pad of pads) {
    const dx = x - pad.x;
    const dz = z - pad.z;
    const u = dx * pad.cos - dz * pad.sin;
    const v = dx * pad.sin + dz * pad.cos;
    if (u >= pad.u0 && u <= pad.u1 && v >= pad.v0 && v <= pad.v1 && pad.lift > lift) lift = pad.lift;
  }
  return lift;
}
