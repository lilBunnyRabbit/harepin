export function ihash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash(ix: number, iy: number, seed: number): number {
  return ihash(ix, iy, seed) / 4294967296;
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / norm;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function length(x: number, z: number): number {
  return Math.sqrt(x * x + z * z);
}

// Rotation by a sqrt-built step instead of Math.cos/sin, which may differ in the last bit between engines.
function polygon(count: number, c: number, s: number): [number, number][] {
  const out: [number, number][] = [];
  let x = 1;
  let z = 0;
  for (let i = 0; i < count; i++) {
    out.push([x, z]);
    [x, z] = [x * c - z * s, x * s + z * c];
  }
  return out;
}

export function circle16(): [number, number][] {
  return polygon(16, Math.sqrt(2 + Math.SQRT2) / 2, Math.sqrt(2 - Math.SQRT2) / 2);
}

export function circle24(): [number, number][] {
  return polygon(24, (Math.sqrt(6) + Math.SQRT2) / 4, (Math.sqrt(6) - Math.SQRT2) / 4);
}
