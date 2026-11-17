export const SIDE_CALLOUTS = 4;
export const PAGE_CALLOUTS = 2 * SIDE_CALLOUTS;

export interface CalloutSpot {
  id: string;
  x: number;
  z: number;
}

/** The ids of the callouts down each side of the map, top to bottom. */
export interface CalloutSides {
  left: readonly string[];
  right: readonly string[];
}

export type CalloutStep = "up" | "down" | "left" | "right";

/**
 * A page of flags split between the map's two sides: the western half to the left, each side in north to south order,
 * so a callout's line to its pin rarely crosses another.
 */
export function callout_sides(spots: readonly CalloutSpot[]): CalloutSides {
  const west_first = [...spots].sort((a, b) => a.x - b.x);
  const half = Math.ceil(west_first.length / 2);
  const down = (side: CalloutSpot[]) => side.sort((a, b) => a.z - b.z).map((spot) => spot.id);
  return { left: down(west_first.slice(0, half)), right: down(west_first.slice(half)) };
}

/** Where a side's `row`th of `count` callouts meets the map's edge, as a share of the edge from its top. */
export const callout_anchor = (row: number, count: number) => (row + 0.5) / count;

/** The callout an arrow key moves to: along its side, wrapping, or across to the nearest row of the other side. */
export function callout_step(sides: CalloutSides, picked: string | null, step: CalloutStep): string | null {
  const on_left = picked !== null && sides.left.includes(picked);
  const own = on_left ? sides.left : sides.right;
  const other = on_left ? sides.right : sides.left;
  const row = picked === null ? -1 : own.indexOf(picked);
  if (row < 0) return sides.left[0] ?? sides.right[0] ?? null;
  if (step === "up" || step === "down") return own[(row + (step === "down" ? 1 : -1) + own.length) % own.length];
  if ((step === "left") === on_left || !other.length) return picked;
  return other[Math.min(other.length - 1, Math.round(callout_anchor(row, own.length) * other.length - 0.5))];
}
