import { LIFT } from "../worldgen/lifts";
import { on_paint, road_junctions, road_paint, type Paint, type RoadData } from "../worldgen/road-layers";
import { lot_paving, type Paving } from "../worldgen/town-mesh";
import type { Lot, ParkingLot, RoadPoint } from "../worldgen/types";

/** One drawn road: the lift its asphalt is laid at and the paint on it. */
export interface DrawnRoad {
  points: readonly RoadPoint[];
  closed: boolean;
  lift: number;
  paint: Paint;
}

/** Every drawn road by the world's lane number: the circuit at 0, then each other edge at its id + 1. */
export function drawn_roads(data: RoadData): (DrawnRoad | undefined)[] {
  const { ring, edges } = road_paint(data, road_junctions(data));
  const roads: (DrawnRoad | undefined)[] = [{ points: data.road, closed: true, lift: LIFT.ring, paint: ring }];
  for (const { street, edge, paint } of edges) roads[edge.id + 1] = { points: edge.points, closed: false, lift: street ? LIFT.street : LIFT.spur, paint };
  return roads;
}

/** How far the road drawn at (`x`, `z`) stands over the terrain, by its point `i` nearest there: its asphalt, or the paint on it. */
export function road_lift(road: DrawnRoad, i: number, x: number, z: number): number {
  const p = road.points[i];
  const dx = x - p.x;
  const dz = z - p.z;
  const n = road.points.length;
  let s = dx * p.tx + dz * p.tz >= 0 ? i : i - 1;
  if (road.closed) s = (s + n) % n;
  return s >= 0 && s < road.paint.centre.length && on_paint(road.paint, s, dz * p.tx - dx * p.tz) ? LIFT.mark : road.lift;
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
