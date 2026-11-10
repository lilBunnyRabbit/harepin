import { CHUNK, COMPACT, type Extent } from "./chunk-grid";
import { face_nx, face_nz, tri } from "./field";
import { CELL, N, type Terrain } from "./types";

const TILE_CELLS = CHUNK / CELL;
const MISS_ROAD_DIST = 1e4;
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

export function slice_tile(terrain: Terrain, index: number): Tile {
  const ci = index % COMPACT.side;
  const cj = Math.floor(index / COMPACT.side);
  return {
    heights: slice(terrain.heights, new Float32Array(TILE_SIDE * TILE_SIDE), ci, cj),
    road_dist: slice(terrain.road_dist, new Float32Array(TILE_SIDE * TILE_SIDE), ci, cj),
    surface: slice(terrain.surface, new Uint8Array(TILE_SIDE * TILE_SIDE), ci, cj),
  };
}

export function slice_tiles(terrain: Terrain): Tile[] {
  return Array.from({ length: COMPACT.side * COMPACT.side }, (_, index) => slice_tile(terrain, index));
}

export function tile_transfers(tile: Tile): ArrayBuffer[] {
  return [tile.heights.buffer, tile.road_dist.buffer, tile.surface.buffer] as ArrayBuffer[];
}

// The cell and its fractions come from global coordinates, so a tile answers bit-identically to the grid it was cut
// from. `locate` leaves its answer in fields: physics calls it at 360 Hz.
export class TileStore {
  /** Answers NaN to a NaN coordinate, as the whole-grid `sample` did, so a bad position never throws in the sim. */
  private static readonly NONE: Tile = { heights: new Float32Array(0), road_dist: new Float32Array(0), surface: new Uint8Array(0) };
  /**
   * A chunk that has not arrived reads as flat ground at sea level, far from any road. Spawns and teleports wait for
   * their chunks, so only far things (remote cars, ghosts, a camera ray) read it.
   */
  static readonly FLAT: Tile = { heights: new Float32Array(TILE_SIDE * TILE_SIDE), road_dist: new Float32Array(TILE_SIDE * TILE_SIDE).fill(MISS_ROAD_DIST), surface: new Uint8Array(TILE_SIDE * TILE_SIDE) };
  private readonly tiles: (Tile | undefined)[] = [];
  private count = 0;
  private waits: { need: number[]; done: () => void; fail: (error: Error) => void }[] = [];
  private failed: Error | null = null;
  /** Told the missing chunks someone waits on, and the middle of their area if any, so a streaming source can send them first. */
  on_need: ((missing: readonly number[], focus: { x: number; z: number } | null) => void) | null = null;
  private k = 0;
  private fx = 0;
  private fz = 0;

  constructor(
    readonly ext: Extent = COMPACT,
    tiles: readonly Tile[] = [],
  ) {
    tiles.forEach((tile, index) => this.add(index, tile));
  }

  add(index: number, tile: Tile) {
    if (!this.tiles[index]) this.count++;
    this.tiles[index] = tile;
    if (this.waits.length) this.settle();
  }

  drop(index: number) {
    if (this.tiles[index]) this.count--;
    this.tiles[index] = undefined;
  }

  get complete(): boolean {
    return this.count === this.ext.side * this.ext.side;
  }

  /** Resolves once the 3x3 chunks around (x, z) are in. */
  ensure(x: number, z: number): Promise<void> {
    const { origin, side } = this.ext;
    const ci = Math.floor((x - origin) / CHUNK);
    const cj = Math.floor((z - origin) / CHUNK);
    const need: number[] = [];
    for (let j = Math.max(0, cj - 1); j <= Math.min(side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(side - 1, ci + 1); i++) need.push(j * side + i);
    return this.wait(need, { x, z });
  }

  /** Resolves once every chunk is in. */
  whole(): Promise<void> {
    return this.wait(Array.from({ length: this.ext.side * this.ext.side }, (_, index) => index), null);
  }

  private wait(need: number[], focus: { x: number; z: number } | null): Promise<void> {
    if (need.every((index) => this.tiles[index])) return Promise.resolve();
    if (this.failed) return Promise.reject(this.failed);
    this.on_need?.(need.filter((index) => !this.tiles[index]), focus);
    return new Promise((done, fail) => this.waits.push({ need, done, fail }));
  }

  /** The source broke: every wait, now and later, rejects with `error` instead of hanging. */
  fail(error: Error) {
    this.failed = error;
    for (const w of this.waits.splice(0)) w.fail(error);
  }

  private settle() {
    const waits = this.waits;
    this.waits = waits.filter((w) => !w.need.every((index) => this.tiles[index]));
    for (const w of waits) if (!this.waits.includes(w)) w.done();
  }

  private tile(ci: number, cj: number): Tile {
    return this.tiles[cj * this.ext.side + ci] ?? (Number.isNaN(ci + cj) ? TileStore.NONE : TileStore.FLAT);
  }

  private locate(x: number, z: number): Tile {
    const { n, origin } = this.ext;
    const gx = Math.max(0, Math.min(n - 1e-4, (x - origin) / CELL));
    const gz = Math.max(0, Math.min(n - 1e-4, (z - origin) / CELL));
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
    const ci = Math.min(this.ext.side - 1, Math.floor(i / TILE_CELLS));
    const cj = Math.min(this.ext.side - 1, Math.floor(j / TILE_CELLS));
    return this.tile(ci, cj).surface[(j - cj * TILE_CELLS) * TILE_SIDE + (i - ci * TILE_CELLS)];
  }
}
