const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function seed_of(text: string): number {
  let h = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) h = Math.imul(h ^ byte, FNV_PRIME);
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sub(seed: number, stage: string): number {
  return seed_of(`${seed >>> 0}:${stage}`);
}
