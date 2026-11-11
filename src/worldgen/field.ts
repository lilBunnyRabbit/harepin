import { CELL, N, ORIGIN } from "./types";

function corner(x: number, z: number) {
  const gx = Math.max(0, Math.min(N - 1e-4, (x - ORIGIN) / CELL));
  const gz = Math.max(0, Math.min(N - 1e-4, (z - ORIGIN) / CELL));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  return { i, j, fx: gx - i, fz: gz - j };
}

/** The triangle under (fx, fz) of the cell whose low corner is `field[k]`, in a grid `row` vertices wide. */
export function tri(field: Float32Array, k: number, row: number, fx: number, fz: number): number {
  const h00 = field[k];
  const h10 = field[k + 1];
  const h01 = field[k + row];
  const h11 = field[k + row + 1];
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

/** x of the unnormalised face normal (x, CELL, z) of that triangle. */
export function face_nx(h: Float32Array, k: number, row: number, fx: number, fz: number): number {
  return fx + fz <= 1 ? h[k] - h[k + 1] : h[k + row] - h[k + row + 1];
}

/** z of the unnormalised face normal (x, CELL, z) of that triangle. */
export function face_nz(h: Float32Array, k: number, row: number, fx: number, fz: number): number {
  return fx + fz <= 1 ? h[k] - h[k + row] : h[k + 1] - h[k + row + 1];
}

export function sample(field: Float32Array, x: number, z: number): number {
  const { i, j, fx, fz } = corner(x, z);
  return tri(field, j * (N + 1) + i, N + 1, fx, fz);
}

/** Unnormalised face normal (x, CELL, z) of the triangle under (x, z); y component of the unit normal is CELL / length. */
export function slope_normal(heights: Float32Array, x: number, z: number): [number, number, number] {
  const { i, j, fx, fz } = corner(x, z);
  const k = j * (N + 1) + i;
  return [face_nx(heights, k, N + 1, fx, fz), CELL, face_nz(heights, k, N + 1, fx, fz)];
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

/** Vertices i0..i1 by j0..j1 of the grid, inclusive, stored `row` wide from (i0, j0): the whole grid, or one tile. */
export interface Grid {
  readonly i0: number;
  readonly j0: number;
  readonly i1: number;
  readonly j1: number;
  readonly row: number;
}

export const WHOLE: Grid = { i0: 0, j0: 0, i1: N, j1: N, row: N + 1 };

/** Index of global vertex (i, j) in a field stored over `grid`. */
export function at(grid: Grid, i: number, j: number): number {
  return (j - grid.j0) * grid.row + i - grid.i0;
}

export function cells(grid: Grid): number {
  return (grid.i1 - grid.i0 + 1) * (grid.j1 - grid.j0 + 1);
}

/** `cell_range` along x, clipped to the grid's columns; empty (lo > hi) when they miss. */
export function span_i(grid: Grid, min: number, max: number): [number, number] {
  return [Math.max(grid.i0, Math.floor((min - ORIGIN) / CELL)), Math.min(grid.i1, Math.ceil((max - ORIGIN) / CELL))];
}

export function span_j(grid: Grid, min: number, max: number): [number, number] {
  return [Math.max(grid.j0, Math.floor((min - ORIGIN) / CELL)), Math.min(grid.j1, Math.ceil((max - ORIGIN) / CELL))];
}

/** `sample` of a field stored over `grid`, clamped to its cells: on WHOLE it answers exactly as `sample` does. */
export function sample_on(grid: Grid, field: Float32Array, x: number, z: number): number {
  const gx = Math.max(grid.i0, Math.min(grid.i1 - 1e-4, (x - ORIGIN) / CELL));
  const gz = Math.max(grid.j0, Math.min(grid.j1 - 1e-4, (z - ORIGIN) / CELL));
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  return tri(field, at(grid, i, j), grid.row, gx - i, gz - j);
}
