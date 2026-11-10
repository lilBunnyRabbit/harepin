import { CELL, ORIGIN, SIZE } from "./types";

export const CHUNK = 256;
const CHUNK_CELLS = CHUNK / CELL;

// Every kind shares one vertex lattice anchored at ORIGIN, so a tile's vertices sit at the same metres whatever the
// world's size; `lattice` is the first chunk's place on it, in chunks (negative past the compact square).
export interface Extent {
  readonly size: number;
  readonly origin: number;
  readonly side: number;
  readonly n: number;
  readonly lattice: number;
}

export function extent(size: number): Extent {
  const origin = -size / 2;
  if (size % (2 * CHUNK) !== 0) throw new Error(`world size ${size} is not a whole number of chunk pairs`);
  return { size, origin, side: size / CHUNK, n: size / CELL, lattice: (origin - ORIGIN) / CHUNK };
}

export const COMPACT = extent(SIZE);
export const CHUNKS = COMPACT.side;

export function chunk_of(x: number, z: number, ext: Extent = COMPACT): number {
  const i = Math.max(0, Math.min(ext.side - 1, Math.floor((x - ext.origin) / CHUNK)));
  const j = Math.max(0, Math.min(ext.side - 1, Math.floor((z - ext.origin) / CHUNK)));
  return j * ext.side + i;
}

export function chunk_corner(index: number, ext: Extent): [number, number] {
  return [ext.origin + (index % ext.side) * CHUNK, ext.origin + Math.floor(index / ext.side) * CHUNK];
}

export function chunk_vertex(index: number, ext: Extent): [number, number] {
  return [(ext.lattice + (index % ext.side)) * CHUNK_CELLS, (ext.lattice + Math.floor(index / ext.side)) * CHUNK_CELLS];
}
