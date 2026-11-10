import type { Extent } from "./chunk-grid";
import { tri } from "./field";

/** A coarse vertex grid over a whole world, which a streamed kind's plan stages read in place of fine tiles. */
export interface PlanGrid {
  readonly ext: Extent;
  readonly cell: number;
  readonly n: number;
  readonly heights: Float32Array;
}

export function plan_grid(ext: Extent, cell: number, height: (x: number, z: number) => number): PlanGrid {
  const n = ext.size / cell;
  const heights = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) heights[j * (n + 1) + i] = height(ext.origin + i * cell, ext.origin + j * cell);
  return { ext, cell, n, heights };
}

export function plan_sample(grid: PlanGrid, x: number, z: number): number {
  const { n, cell, ext } = grid;
  const gx = Math.max(0, Math.min(n - 1e-4, (x - ext.origin) / cell));
  const gz = Math.max(0, Math.min(n - 1e-4, (z - ext.origin) / cell));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  return tri(grid.heights, j * (n + 1) + i, n + 1, gx - i, gz - j);
}
