import { CHUNK, CHUNKS } from "./chunk-grid";
import { face_nx, face_nz, tri } from "./field";
import { CELL, N, ORIGIN, type Terrain } from "./types";

const TILE_CELLS = CHUNK / CELL;
/** Vertices per tile row: a tile shares its border row and column with the next one. */
export const TILE_SIDE = TILE_CELLS + 1;

export interface Tile {
  readonly heights: Float32Array;
  readonly road_dist: Float32Array;
  readonly surface: Uint8Array;
}

export interface VectorOut<T> {
  set(x: number, y: number, z: number): T;
}

function slice<T extends Float32Array | Uint8Array>(grid: T, out: T, ci: number, cj: number): T {
  for (let j = 0; j < TILE_SIDE; j++) {
    const from = (cj * TILE_CELLS + j) * (N + 1) + ci * TILE_CELLS;
    out.set(grid.subarray(from, from + TILE_SIDE), j * TILE_SIDE);
  }
  return out;
}

export function slice_tiles(terrain: Terrain): Tile[] {
  const tiles: Tile[] = [];
  for (let cj = 0; cj < CHUNKS; cj++)
    for (let ci = 0; ci < CHUNKS; ci++)
      tiles.push({
        heights: slice(terrain.heights, new Float32Array(TILE_SIDE * TILE_SIDE), ci, cj),
        road_dist: slice(terrain.road_dist, new Float32Array(TILE_SIDE * TILE_SIDE), ci, cj),
        surface: slice(terrain.surface, new Uint8Array(TILE_SIDE * TILE_SIDE), ci, cj),
      });
  return tiles;
}

// The cell and its fractions come from global coordinates, so a tile answers bit-identically to the grid it was cut
// from. `locate` leaves its answer in fields: physics calls it at 360 Hz.
export class TileStore {
  /** Answers NaN to a NaN coordinate, as the whole-grid `sample` did, so a bad position never throws in the sim. */
  private static readonly NONE: Tile = { heights: new Float32Array(0), road_dist: new Float32Array(0), surface: new Uint8Array(0) };
  private readonly tiles: (Tile | undefined)[] = [];
  private k = 0;
  private fx = 0;
  private fz = 0;

  constructor(tiles: readonly Tile[]) {
    tiles.forEach((tile, index) => this.add(index, tile));
  }

  add(index: number, tile: Tile) {
    this.tiles[index] = tile;
  }

  drop(index: number) {
    this.tiles[index] = undefined;
  }

  private tile(ci: number, cj: number): Tile {
    return this.tiles[cj * CHUNKS + ci] ?? (Number.isNaN(ci + cj) ? TileStore.NONE : this.miss(ci, cj));
  }

  private miss(ci: number, cj: number): never {
    throw new Error(`terrain tile ${ci},${cj} not loaded`);
  }

  private locate(x: number, z: number): Tile {
    const gx = Math.max(0, Math.min(N - 1e-4, (x - ORIGIN) / CELL));
    const gz = Math.max(0, Math.min(N - 1e-4, (z - ORIGIN) / CELL));
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    this.fx = gx - i;
    this.fz = gz - j;
    const ci = Math.floor(i / TILE_CELLS);
    const cj = Math.floor(j / TILE_CELLS);
    this.k = (j - cj * TILE_CELLS) * TILE_SIDE + (i - ci * TILE_CELLS);
    return this.tile(ci, cj);
  }

  height(x: number, z: number): number {
    return tri(this.locate(x, z).heights, this.k, TILE_SIDE, this.fx, this.fz);
  }

  road_dist(x: number, z: number): number {
    return tri(this.locate(x, z).road_dist, this.k, TILE_SIDE, this.fx, this.fz);
  }

  slope<T>(x: number, z: number, out: VectorOut<T>): T {
    const h = this.locate(x, z).heights;
    return out.set(face_nx(h, this.k, TILE_SIDE, this.fx, this.fz), CELL, face_nz(h, this.k, TILE_SIDE, this.fx, this.fz));
  }

  surface(i: number, j: number): number {
    const ci = Math.min(CHUNKS - 1, Math.floor(i / TILE_CELLS));
    const cj = Math.min(CHUNKS - 1, Math.floor(j / TILE_CELLS));
    return this.tile(ci, cj).surface[(j - cj * TILE_CELLS) * TILE_SIDE + (i - ci * TILE_CELLS)];
  }
}
