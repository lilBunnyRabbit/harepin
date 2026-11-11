import { KERB_OUT, roadside_clear, type RoadData } from "../worldgen/road-layers";
import { ROAD_HALF, type RoadPoint } from "../worldgen/types";

/** Inner edge of a circuit kerb, metres off the centre line: it tucks just under the road's edge. */
export const KERB_IN = ROAD_HALF - 0.1;
/** Turn (rad) across 12 circuit samples past which a bend gets a kerb on its inside. */
const KERB_BEND = 0.09;
const BEND_REACH = 6;

export interface KerbMarks {
  /** Circuit samples a road leaves the loop across: no kerb, so it does not wall off the side road. */
  clear: Set<number>;
  /** Circuit sample to the side (+1 or -1 across it) of the kerb on the inside of its bend. */
  inside: Map<number, number>;
}

function curvature(road: readonly RoadPoint[], s: number): number {
  const a = road[(s - BEND_REACH + road.length) % road.length];
  const b = road[(s + BEND_REACH) % road.length];
  return Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
}

/** Where the circuit's kerbs go: the mesh draws them from these, and a tyre feels them from the same. */
export function kerb_marks(data: RoadData): KerbMarks {
  const inside = new Map<number, number>();
  for (let s = 0; s < data.road.length; s++) {
    const k = curvature(data.road, s);
    if (Math.abs(k) > KERB_BEND) inside.set(s, Math.sign(k));
  }
  return { clear: roadside_clear(data), inside };
}

/** (x, z) lies on the kerb drawn along circuit segment `s` to `s + 1`, if that segment has one. */
export function on_kerb_segment(marks: KerbMarks, road: readonly RoadPoint[], s: number, x: number, z: number): boolean {
  const side = marks.inside.get(s);
  if (side === undefined || marks.clear.has(s)) return false;
  const p = road[s];
  const q = road[(s + 1) % road.length];
  const dx = x - p.x;
  const dz = z - p.z;
  const along = dx * p.tx + dz * p.tz;
  if (along < 0 || along > Math.hypot(q.x - p.x, q.z - p.z)) return false;
  // The mesh offsets a sample by `side` along (-tz, tx).
  const across = (-dx * p.tz + dz * p.tx) * side;
  return across >= KERB_IN && across <= KERB_OUT;
}
