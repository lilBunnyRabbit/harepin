import { DECK_STRIDE, type Deck } from "./types";

/** Below this far under the deck surface a query sees no deck: a car falling past the edge must not be shoved up through it. */
export const DECK_UNDER = 1.2;
const CELL = 16;
const WALK_REACH = 24;
/** Two sections closer than this in xz can be stacked (a crossover); cells around them check every section. */
const STACK_REACH = 48;
/** Samples closer than this along the lap are one section. */
const SECTION_ALONG = 60;
/** A section answers a stacked query only when one of its samples is this close: wider than the widest deck. */
const LEVEL_REACH = 10;

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
  /** Cells where the track passes over itself. */
  private readonly stacked = new Set<number>();
  private readonly length: number;
  private last = 0;
  private readonly hit: DeckHit = { y: 0, gx: 0, gz: 0, index: 0, u: 0 };
  private readonly picks: number[] = [];
  private readonly nearby: number[] = [];
  private near_cx = NaN;
  private near_cz = NaN;
  private near_count = -1;

  constructor(readonly deck: Deck) {
    this.count = deck.line.length / DECK_STRIDE;
    for (let i = 0; i < this.count; i++) {
      const k = key(Math.floor(this.at(i, 0) / CELL), Math.floor(this.at(i, 2) / CELL));
      const list = this.grid.get(k);
      if (list) list.push(i);
      else this.grid.set(k, [i]);
    }
    const n = this.count;
    this.length = n ? this.at(n - 1, 8) + Math.hypot(this.at(0, 0) - this.at(n - 1, 0), this.at(0, 2) - this.at(n - 1, 2)) : 0;
    const reach = Math.ceil(STACK_REACH / CELL);
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(this.at(i, 0) / CELL);
      const cz = Math.floor(this.at(i, 2) / CELL);
      let stacked = false;
      for (let dz = -reach; dz <= reach && !stacked; dz++)
        for (let dx = -reach; dx <= reach && !stacked; dx++)
          for (const j of this.grid.get(key(cx + dx, cz + dz)) ?? [])
            if (!this.same_section(i, j) && this.dist(j, this.at(i, 0), this.at(i, 2)) < STACK_REACH * STACK_REACH) {
              stacked = true;
              break;
            }
      if (!stacked) continue;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.stacked.add(key(cx + dx, cz + dz));
    }
  }

  at(i: number, field: number): number {
    return this.deck.line[i * DECK_STRIDE + field];
  }

  private dist(i: number, x: number, z: number): number {
    return (this.at(i, 0) - x) ** 2 + (this.at(i, 2) - z) ** 2;
  }

  private same_section(i: number, j: number): boolean {
    const along = Math.abs(this.at(i, 8) - this.at(j, 8));
    return Math.min(along, this.length - along) < SECTION_ALONG;
  }

  nearest(x: number, z: number): number {
    const n = this.count;
    let i = this.last;
    let d = this.dist(i, x, z);
    // Every height query walks here, from wherever the last car left it: no modulo, no destructuring per sample.
    for (;;) {
      const a = i + 1 === n ? 0 : i + 1;
      const b = i === 0 ? n - 1 : i - 1;
      const da = this.dist(a, x, z);
      const db = this.dist(b, x, z);
      if (da < d && da <= db) {
        i = a;
        d = da;
      } else if (db < d) {
        i = b;
        d = db;
      } else break;
    }
    if (d > WALK_REACH * WALK_REACH) {
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      let best = -1;
      let bd = Infinity;
      for (let ring = 0; ring < 8 && best < 0; ring++)
        for (let dz = -ring - 1; dz <= ring + 1; dz++)
          for (let dx = -ring - 1; dx <= ring + 1; dx++)
            {
              const list = this.grid.get(key(cx + dx, cz + dz));
              if (!list) continue;
              for (let k = 0; k < list.length; k++) {
                const dj = this.dist(list[k], x, z);
                if (dj < bd) {
                  best = list[k];
                  bd = dj;
                }
              }
            }
      if (best < 0) return i;
      i = best;
    }
    this.last = i;
    return i;
  }

  /**
   * Nearest sample of every section within LEVEL_REACH of a point in a stacked cell, written to `picks`; returns how
   * many, or -1 outside a stacked cell. Overwrites instead of truncating: truncating an array frees its storage.
   */
  private levels(x: number, z: number): number {
    const count = this.near(Math.floor(x / CELL), Math.floor(z / CELL));
    if (count < 0) return -1;
    const { picks, nearby } = this;
    let n = 0;
    for (let c = 0; c < count; c++) {
      const j = nearby[c];
      const d = this.dist(j, x, z);
      if (d > LEVEL_REACH * LEVEL_REACH) continue;
      let k = 0;
      while (k < n && !this.same_section(picks[k], j)) k++;
      if (k === n) picks[n++] = j;
      else if (d < this.dist(picks[k], x, z)) picks[k] = j;
    }
    return n;
  }

  /**
   * Samples of the 3x3 cells round a stacked cell into `nearby`, in grid order; returns how many, or -1 for a cell
   * that is not stacked. A car's queries stay in one cell for many calls, so the last cell's answer is kept.
   */
  private near(cx: number, cz: number): number {
    if (cx === this.near_cx && cz === this.near_cz) return this.near_count;
    this.near_cx = cx;
    this.near_cz = cz;
    if (!this.stacked.has(key(cx, cz))) return (this.near_count = -1);
    const nearby = this.nearby;
    let n = 0;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.grid.get(key(cx + dx, cz + dz));
        if (list) for (let k = 0; k < list.length; k++) nearby[n++] = list[k];
      }
    return (this.near_count = n);
  }

  /**
   * Where a crossover stacks two decks, the highest one the query is above the underside of (the highest of all with no
   * `y`). The returned object is reused across calls.
   */
  surface(x: number, z: number, y?: number): DeckHit | null {
    const count = this.levels(x, z);
    if (count < 0) return this.probe(this.nearest(x, z), x, z, y);
    let best = -1;
    let top = -Infinity;
    for (let k = 0; k < count; k++) {
      const i = this.picks[k];
      const hit = this.probe(i, x, z, y);
      if (hit && hit.y > top) {
        best = i;
        top = hit.y;
      }
    }
    if (best < 0) return null;
    this.last = best;
    return this.probe(best, x, z, y);
  }

  /**
   * Low edge of the lowest deck near the point: a car this far under every deck has fallen. The edge, not the centreline:
   * on a 70° wall the low edge sits 16 m under it, and a car riding the low half must not read as fallen.
   */
  floor(x: number, z: number): number {
    let y = this.low_edge(this.nearest(x, z));
    const count = this.levels(x, z);
    for (let k = 0; k < count; k++) y = Math.min(y, this.low_edge(this.picks[k]));
    return y;
  }

  private low_edge(i: number): number {
    return this.at(i, 1) - this.at(i, 6) * Math.abs(Math.tan(this.at(i, 5)));
  }

  private lerp(a: number, b: number, f: number, field: number): number {
    return this.at(a, field) + (this.at(b, field) - this.at(a, field)) * f;
  }

  private probe(i: number, x: number, z: number, y: number | undefined): DeckHit | null {
    const n = this.count;
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
    const cx = ax + sx * f;
    const cz = az + sz * f;
    let ux = this.lerp(a, b, f, 3);
    let uz = this.lerp(a, b, f, 4);
    const ul = Math.sqrt(ux * ux + uz * uz);
    ux /= ul;
    uz /= ul;
    const u = (x - cx) * uz - (z - cz) * ux;
    if (Math.abs(u) > this.lerp(a, b, f, 6) || Math.abs((x - cx) * ux + (z - cz) * uz) > 2) return null;
    const slope = Math.tan(this.lerp(a, b, f, 5));
    const surface = this.lerp(a, b, f, 1) + u * slope;
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
