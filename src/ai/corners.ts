import type { RaceLine } from "./line";

/** A bend tighter than this radius (m) is a corner; bends closer than MERGE road points are one corner. */
const CORNER_RADIUS = 120;
const MERGE = 15;
const MIN_LEN = 5;

export interface Corner {
  /** Road points where the bend starts and ends, and its tightest radius (m). */
  from: number;
  to: number;
  radius: number;
}

export function corners(line: Pick<RaceLine, "bend">): Corner[] {
  const n = line.bend.length;
  const tight = (i: number) => Math.abs(line.bend[i]) > 1 / CORNER_RADIUS;
  let start = 0;
  while (start < n && tight(start)) start++;
  const out: Corner[] = [];
  let from = -1;
  let gap = 0;
  for (let k = 0; k <= n; k++) {
    const i = (start + k) % n;
    if (k < n && tight(i)) {
      if (from < 0) from = k;
      gap = 0;
    } else if (from >= 0 && (++gap > MERGE || k === n)) {
      const to = k - gap;
      if (to - from >= MIN_LEN) {
        let r = Infinity;
        for (let j = from; j <= to; j++) r = Math.min(r, 1 / Math.max(1e-9, Math.abs(line.bend[(start + j) % n])));
        out.push({ from: (start + from) % n, to: (start + to) % n, radius: r });
      }
      from = -1;
      gap = 0;
    }
  }
  return out.sort((a, b) => a.from - b.from);
}
