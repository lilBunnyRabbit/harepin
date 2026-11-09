import { mulberry32, sub } from "../rng";
import { fbm, smoothstep } from "./noise";
import { CELL, N, ORIGIN, SIZE, type Terrain } from "./types";

const PEAK_HEIGHT = 150;
const PEAK_RADIUS = 430;
const PEAK_REACH = 220;

interface Peak {
  x: number;
  z: number;
}

function peak_of(seed: number): Peak {
  const next = mulberry32(sub(seed, "peak"));
  let x = 0;
  let z = 0;
  while (x * x + z * z < 0.01) {
    x = next() - 0.5;
    z = next() - 0.5;
  }
  const scale = (Math.sqrt(next()) * PEAK_REACH) / Math.sqrt(x * x + z * z);
  return { x: x * scale, z: z * scale };
}

// hills ** 1.75 and the polynomial bump stand in for ** 1.7 and exp(), which are not bit-exact across engines.
function raw_height(x: number, z: number, seed: number, peak: Peak): number {
  const r = Math.sqrt(x * x + z * z) / 960 + (fbm(x / 380, z / 380, seed + 3) - 0.5) * 0.3;
  const mask = 1 - smoothstep(0.8, 1.0, r);
  const hills = fbm(x / 520, z / 520, seed + 7);
  const ridge = 1 - Math.abs(2 * fbm(x / 300, z / 300, seed + 11) - 1);
  const dx = x - peak.x;
  const dz = z - peak.z;
  const t = Math.min(1, (dx * dx + dz * dz) / (PEAK_RADIUS * PEAK_RADIUS));
  const top = PEAK_HEIGHT * (1 - t) * (1 - t) * (1 - t);
  const land = 5 + hills * Math.sqrt(hills) * Math.sqrt(Math.sqrt(hills)) * 95 + ridge * ridge * ridge * 22 + top;
  return -9 + (land + 9) * mask;
}

export function terrain(seed: number): Terrain {
  const heights = new Float32Array((N + 1) * (N + 1));
  const peak = peak_of(seed);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) heights[j * (N + 1) + i] = raw_height(ORIGIN + i * CELL, ORIGIN + j * CELL, seed, peak);
  return { seed, size: SIZE, cell: CELL, n: N, heights, road_dist: new Float32Array(heights.length).fill(1e9), surface: new Uint8Array(heights.length) };
}
