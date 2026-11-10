import { CELL, N, ORIGIN } from "./types";

function corner(x: number, z: number) {
  const gx = Math.max(0, Math.min(N - 1e-4, (x - ORIGIN) / CELL));
  const gz = Math.max(0, Math.min(N - 1e-4, (z - ORIGIN) / CELL));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  return { i, j, fx: gx - i, fz: gz - j };
}

export function sample(field: Float32Array, x: number, z: number): number {
  const { i, j, fx, fz } = corner(x, z);
  const k = j * (N + 1) + i;
  const h00 = field[k];
  const h10 = field[k + 1];
  const h01 = field[k + N + 1];
  const h11 = field[k + N + 2];
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

/** Unnormalised face normal (x, CELL, z) of the triangle under (x, z); y component of the unit normal is CELL / length. */
export function slope_normal(heights: Float32Array, x: number, z: number): [number, number, number] {
  const { i, j, fx, fz } = corner(x, z);
  const h = heights;
  const k = j * (N + 1) + i;
  if (fx + fz <= 1) return [h[k] - h[k + 1], CELL, h[k] - h[k + N + 1]];
  return [h[k + N + 1] - h[k + N + 2], CELL, h[k + 1] - h[k + N + 2]];
}

export function up(heights: Float32Array, x: number, z: number): number {
  const [nx, ny, nz] = slope_normal(heights, x, z);
  return ny / Math.sqrt(nx * nx + ny * ny + nz * nz);
}

/** `up` at grid vertex (i, j), without the allocations; `corner` clamps i = N and j = N into the last cell's far side. */
export function vertex_up(h: Float32Array, i: number, j: number): number {
  const k = Math.min(j, N - 1) * (N + 1) + Math.min(i, N - 1);
  const far = i === N && j === N;
  const nx = far ? h[k + N + 1] - h[k + N + 2] : h[k] - h[k + 1];
  const nz = far ? h[k + 1] - h[k + N + 2] : h[k] - h[k + N + 1];
  return CELL / Math.sqrt(nx * nx + CELL * CELL + nz * nz);
}

export function vertex(i: number, j: number): number {
  return j * (N + 1) + i;
}

export function cell_range(min: number, max: number): [number, number] {
  return [Math.max(0, Math.floor((min - ORIGIN) / CELL)), Math.min(N, Math.ceil((max - ORIGIN) / CELL))];
}
