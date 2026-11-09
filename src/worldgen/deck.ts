import { DECK_STRIDE, type Deck } from "./types";

/** Below this far under the deck surface a query sees no deck: a car falling past the edge must not be shoved up through it. */
export const DECK_UNDER = 1.2;
const CELL = 16;
const WALK_REACH = 24;

export interface DeckHit {
  y: number;
  gx: number;
  gz: number;
  index: number;
  /** Offset from the centreline, + = left. */
  u: number;
}

function key(cx: number, cz: number) {
  return (cx + 1000) * 4096 + (cz + 1000);
}

export class DeckIndex {
  readonly count: number;
  private readonly grid = new Map<number, number[]>();
  private last = 0;
  private readonly hit: DeckHit = { y: 0, gx: 0, gz: 0, index: 0, u: 0 };

  constructor(readonly deck: Deck) {
    this.count = deck.line.length / DECK_STRIDE;
    for (let i = 0; i < this.count; i++) {
      const k = key(Math.floor(this.at(i, 0) / CELL), Math.floor(this.at(i, 2) / CELL));
      const list = this.grid.get(k);
      if (list) list.push(i);
      else this.grid.set(k, [i]);
    }
  }

  at(i: number, field: number): number {
    return this.deck.line[i * DECK_STRIDE + field];
  }

  private dist(i: number, x: number, z: number): number {
    return (this.at(i, 0) - x) ** 2 + (this.at(i, 2) - z) ** 2;
  }

  nearest(x: number, z: number): number {
    const n = this.count;
    let i = this.last;
    let d = this.dist(i, x, z);
    for (;;) {
      const a = (i + 1) % n;
      const b = (i - 1 + n) % n;
      const da = this.dist(a, x, z);
      const db = this.dist(b, x, z);
      if (da < d && da <= db) [i, d] = [a, da];
      else if (db < d) [i, d] = [b, db];
      else break;
    }
    if (d > WALK_REACH * WALK_REACH) {
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      let best = -1;
      let bd = Infinity;
      for (let ring = 0; ring < 8 && best < 0; ring++)
        for (let dz = -ring - 1; dz <= ring + 1; dz++)
          for (let dx = -ring - 1; dx <= ring + 1; dx++)
            for (const j of this.grid.get(key(cx + dx, cz + dz)) ?? []) {
              const dj = this.dist(j, x, z);
              if (dj < bd) [best, bd] = [j, dj];
            }
      if (best < 0) return i;
      i = best;
    }
    this.last = i;
    return i;
  }

  /** The returned object is reused across calls. */
  surface(x: number, z: number, y?: number): DeckHit | null {
    const n = this.count;
    const i = this.nearest(x, z);
    const next = (i + 1) % n;
    const prev = (i - 1 + n) % n;
    let a = i;
    let b = next;
    const tx = this.at(i, 3);
    const tz = this.at(i, 4);
    if ((x - this.at(i, 0)) * tx + (z - this.at(i, 2)) * tz < 0) {
      a = prev;
      b = i;
    }
    const ax = this.at(a, 0);
    const az = this.at(a, 2);
    const sx = this.at(b, 0) - ax;
    const sz = this.at(b, 2) - az;
    const len2 = sx * sx + sz * sz;
    const f = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / len2));
    if (!this.at(a, 7) || !this.at(b, 7)) return null;
    const lerp = (field: number) => this.at(a, field) + (this.at(b, field) - this.at(a, field)) * f;
    const cx = ax + sx * f;
    const cz = az + sz * f;
    let ux = lerp(3);
    let uz = lerp(4);
    const ul = Math.sqrt(ux * ux + uz * uz);
    ux /= ul;
    uz /= ul;
    const u = (x - cx) * uz - (z - cz) * ux;
    if (Math.abs(u) > lerp(6) || Math.abs((x - cx) * ux + (z - cz) * uz) > 2) return null;
    const slope = Math.tan(lerp(5));
    const surface = lerp(1) + u * slope;
    if (y !== undefined && y < surface - DECK_UNDER) return null;
    const grade = (this.at(b, 1) - this.at(a, 1)) / Math.sqrt(len2);
    const hit = this.hit;
    hit.y = surface;
    hit.gx = grade * ux + slope * uz;
    hit.gz = grade * uz - slope * ux;
    hit.index = a;
    hit.u = u;
    return hit;
  }
}
