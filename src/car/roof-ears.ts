import type { RoofLip } from "./design-parts";
import type { Cabin, Slab } from "./designs";
import type { Point } from "./geometry";

const FOOT_SINK = 0.02;
const PLATE_LEAD = 0.1;
const PLATE_PAST = 0.03;

export interface RoofWing {
  lip: Slab;
  ear: Slab;
  /** Slab distance of the ears' inner faces, where a plane between them ends. */
  inner: number;
}

// Each end keeps the lip's own top and runs from the tip down to a foot on the screen pillar, so nothing hangs beside
// the glass; with `rise` it also stands that far over the tip as an endplate, swept up from the lip's root.
export function roof_wing(cabin: Cabin, shoulder: number, edge: number, spoiler: RoofLip, drop: number, wide: number, rise = 0): RoofWing {
  const [rz, ry] = spoiler.edge;
  const [sz, sy] = cabin.points[edge + 2];
  const [root, tip, under] = spoiler.lip.points;
  const share = Math.min(1, drop / (ry - sy));
  const foot: Point = [rz + (sz - rz) * share + FOOT_SINK, ry - (ry - sy) * share];
  const plate: Point[] = rise > 0 ? [[rz - PLATE_LEAD, ry + rise * 0.8], [tip[0] - PLATE_PAST, tip[1] + rise], [tip[0] - PLATE_PAST, under[1]]] : [tip, under];
  const inner = spoiler.half - wide / (1 - shoulder);
  return { lip: { ...spoiler.lip, to: inner }, ear: { points: [root, ...plate, foot], from: inner, to: spoiler.half }, inner };
}
