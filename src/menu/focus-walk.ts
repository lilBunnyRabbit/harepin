export type Direction = "up" | "down" | "left" | "right";

/** One focusable control, as the arrow walk sees it: its box on screen and where it sits. */
export interface Spot {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** The nav or section around it; null outside one. */
  group: unknown;
  /** In the station bar: Q / E and LB / RB step it, so no arrow lands there. */
  bar: boolean;
}

// Borders and focus outlines make neighbours overlap by a few px; they still count as the next row or column.
const OVERLAP_PX = 4;
const SIDE_WEIGHT = 2;

const gap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1);

export function first_spot(spots: readonly Spot[]): number {
  return spots.findIndex((spot) => !spot.bar);
}

/** The spot one arrow press away from `from`, -1 at an edge. */
export function walk_step(from: number, spots: readonly Spot[], dir: Direction): number {
  const f = spots[from];
  const vertical = dir === "up" || dir === "down";
  let best = -1;
  let best_out = Infinity;
  let best_far = Infinity;
  for (let i = 0; i < spots.length; i++) {
    const r = spots[i];
    if (i === from || r.bar) continue;
    const ahead = dir === "down" ? r.top - f.bottom : dir === "up" ? f.top - r.bottom : dir === "right" ? r.left - f.right : f.left - r.right;
    const beyond = dir === "down" ? r.top + r.bottom > f.top + f.bottom : dir === "up" ? r.top + r.bottom < f.top + f.bottom : dir === "right" ? r.left + r.right > f.left + f.right : r.left + r.right < f.left + f.right;
    if (!beyond || ahead < -OVERLAP_PX) continue;
    const side = vertical ? gap(f.left, f.right, r.left, r.right) : gap(f.top, f.bottom, r.top, r.bottom);
    // Staying in the same nav or section beats leaving it, however close: a tall control (the world map) would
    // otherwise hand down-presses to whatever sits beside it.
    const out = f.group && r.group !== f.group ? 1 : 0;
    const far = Math.max(0, ahead) + side * SIDE_WEIGHT;
    if (out < best_out || (out === best_out && far < best_far)) {
      best = i;
      best_out = out;
      best_far = far;
    }
  }
  return best;
}
