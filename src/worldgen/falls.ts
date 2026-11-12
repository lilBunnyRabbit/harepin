import { gap_jump, type GapJump } from "./gap";
import { length } from "./noise";
import type { RoadPoint } from "./types";

export interface FallsRecipe {
  count: number;
  drop: number;
}

export interface Falls {
  points: RoadPoint[];
  jumps: GapJump[];
  /** Run-up, kicker, deck and run-out of each fall, laid as packed snow so no jump launches off ice or lands on it. */
  pads: RoadPoint[][];
}

/** Fastest toe speed a fall's deck is built for, m/s: the bed's ice keeps cars well under the road's GAP_V_MAX. */
export const FALL_V_MAX = 30;
const RUNUP = 30;
const RUNOUT = 15;
/** Most a bed point may stand off a fall's axis, metres: the deck is a plane along it. */
const STRAIGHT = 3.5;
const BETWEEN = 40;
const ENDS = 40;

interface Window {
  from: number;
  toe: number;
  to: number;
  fx: number;
  fz: number;
}

function along(points: readonly RoadPoint[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + length(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  return out;
}

function axis(points: readonly RoadPoint[], from: number, to: number): [number, number] | null {
  const a = points[from];
  const b = points[to];
  const len = length(b.x - a.x, b.z - a.z);
  if (len === 0) return null;
  const fx = (b.x - a.x) / len;
  const fz = (b.z - a.z) / len;
  for (let i = from; i <= to; i++) if (Math.abs((points[i].x - a.x) * fz - (points[i].z - a.z) * fx) > STRAIGHT) return null;
  return [fx, fz];
}

/**
 * Up to `recipe.count` frozen falls on the bed's straight stretches, first come first served from the head. Each is a
 * road kicker level to its lip, a face down `drop` under the gap, then the deck's plane. The falls take their drop out
 * of the bed's grade, so the bed keeps both ends and runs flatter between them; one that would leave no grade is dropped.
 */
export function plan_falls(bed: readonly RoadPoint[], recipe: FallsRecipe): Falls {
  const run = along(bed);
  const total = run[run.length - 1];
  const shape = gap_jump(0, 0, 0, 0, 0, 1, recipe.drop, FALL_V_MAX);
  const lip = shape.takeoff.length;
  const deck = lip + shape.gap;
  const end = deck + shape.deck.length;
  const step = recipe.drop - shape.deck.grade * shape.deck.length;
  const index_at = (d: number, from: number) => {
    let i = from;
    while (i < bed.length - 1 && run[i] < d) i++;
    return i;
  };
  const windows: Window[] = [];
  for (let i = index_at(ENDS, 0); windows.length < recipe.count && run[i] + RUNUP + end + RUNOUT < total - ENDS; ) {
    const toe = index_at(run[i] + RUNUP, i);
    const to = index_at(run[i] + RUNUP + end + RUNOUT, toe);
    const dir = axis(bed, i, to);
    if (!dir) {
      i++;
      continue;
    }
    windows.push({ from: i, toe, to, fx: dir[0], fz: dir[1] });
    i = index_at(run[to] + BETWEEN, to);
  }
  const on_fall = (k: number) => windows.find((w) => run[k] >= run[w.toe] && run[k] < run[w.toe] + end);
  const graded = () => {
    let sum = 0;
    for (let k = 0; k < bed.length - 1; k++) if (!on_fall(k)) sum += bed[k].y - bed[k + 1].y;
    return sum;
  };
  const fall = bed[0].y - bed[bed.length - 1].y;
  while (windows.length && (graded() <= 0 || fall - windows.length * step < 0)) windows.pop();
  if (!windows.length) return { points: [...bed], jumps: [], pads: [] };

  const scale = (fall - windows.length * step) / graded();
  const ys = [bed[0].y];
  for (let k = 1; k < bed.length; k++) {
    const w = on_fall(k - 1);
    if (!w) {
      ys.push(ys[k - 1] - (bed[k - 1].y - bed[k].y) * scale);
      continue;
    }
    const top = ys[w.toe];
    const d = (bed[k].x - bed[w.toe].x) * w.fx + (bed[k].z - bed[w.toe].z) * w.fz;
    ys.push(d <= lip ? top : d < deck ? top - (recipe.drop * (d - lip)) / shape.gap : top - recipe.drop + shape.deck.grade * Math.min(d - deck, shape.deck.length));
  }
  const points = bed.map((p, k) => ({ ...p, y: ys[k] }));
  const jumps = windows.map((w) => {
    const t = points[w.toe];
    return gap_jump(0, t.x, t.y, t.z, w.fx, w.fz, recipe.drop, FALL_V_MAX);
  });
  return { points, jumps, pads: windows.map((w) => points.slice(w.from, w.to + 1)) };
}
