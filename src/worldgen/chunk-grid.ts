import { ORIGIN, SIZE } from "./types";

export const CHUNK = 256;
export const CHUNKS = SIZE / CHUNK;

export function chunk_of(x: number, z: number): number {
  const i = Math.max(0, Math.min(CHUNKS - 1, Math.floor((x - ORIGIN) / CHUNK)));
  const j = Math.max(0, Math.min(CHUNKS - 1, Math.floor((z - ORIGIN) / CHUNK)));
  return j * CHUNKS + i;
}
