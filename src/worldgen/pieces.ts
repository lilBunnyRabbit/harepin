/** Convex polygons packed as runs of (x, z) pairs in one growable buffer, so cutting road triangles allocates nothing. */
export class Pieces {
  xz: Float64Array = new Float64Array(1024);
  start: Int32Array = new Int32Array(128);
  count: Int32Array = new Int32Array(128);
  length = 0;
  private used = 0;

  clear() {
    this.length = 0;
    this.used = 0;
  }

  begin() {
    if (this.length === this.start.length) {
      this.start = grown_int(this.start);
      this.count = grown_int(this.count);
    }
    this.start[this.length] = this.used;
    this.count[this.length] = 0;
  }

  push(x: number, z: number) {
    if (this.used + 2 > this.xz.length) {
      const xz = new Float64Array(this.xz.length * 2);
      xz.set(this.xz);
      this.xz = xz;
    }
    this.xz[this.used++] = x;
    this.xz[this.used++] = z;
    this.count[this.length]++;
  }

  end() {
    if (this.count[this.length] >= 3) this.length++;
    else this.used = this.start[this.length];
  }

  copy(from: Pieces, p: number) {
    const s = from.start[p];
    this.begin();
    for (let i = 0; i < from.count[p]; i++) this.push(from.xz[s + 2 * i], from.xz[s + 2 * i + 1]);
    this.end();
  }
}

function grown_int(a: Int32Array): Int32Array {
  const out = new Int32Array(a.length * 2);
  out.set(a);
  return out;
}

let side: Float64Array = new Float64Array(64);

// Below before above, as the vertex order of every later cut and so the crack-free shared vertices depend on it.
export function split(from: Pieces, p: number, to: Pieces, ux: number, uz: number, line: number) {
  const s = from.start[p];
  const n = from.count[p];
  const xz = from.xz;
  if (n > side.length) side = new Float64Array(n * 2);
  let below = false;
  let above = false;
  for (let i = 0; i < n; i++) {
    side[i] = ux * xz[s + 2 * i] + uz * xz[s + 2 * i + 1] - line;
    if (side[i] < 0) below = true;
    if (side[i] > 0) above = true;
  }
  if (!below || !above) return to.copy(from, p);
  part(from, p, to, -1);
  part(from, p, to, 1);
}

function part(from: Pieces, p: number, to: Pieces, half: -1 | 1) {
  const s = from.start[p];
  const n = from.count[p];
  const xz = from.xz;
  to.begin();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (half < 0 ? side[i] <= 0 : side[i] >= 0) to.push(xz[s + 2 * i], xz[s + 2 * i + 1]);
    if ((side[i] < 0 && side[j] > 0) || (side[i] > 0 && side[j] < 0)) crossing(to, xz[s + 2 * i], xz[s + 2 * i + 1], xz[s + 2 * j], xz[s + 2 * j + 1], side[i], side[j]);
  }
  to.end();
}

// Both triangles on a shared edge walk it in opposite directions; interpolating from the same end gives them the
// bit-identical vertex, so the cut leaves no hairline gap.
function crossing(to: Pieces, px: number, pz: number, qx: number, qz: number, sp: number, sq: number) {
  if (px > qx || (px === qx && pz > qz)) return crossing(to, qx, qz, px, pz, sq, sp);
  const t = sp / (sp - sq);
  to.push(px + (qx - px) * t, pz + (qz - pz) * t);
}
