import { terrain_colors } from "./chunks";
import { CELL, DECK_STRIDE, N, SIZE, type WorldData, type WorldKind } from "./types";

export const MAP_SIDE = N + 1;
const SUN = normalise([-1, 1.4, -1]);
const SHADE_MIN = 0.45;
const SHADE_MAX = 1.25;
const DEEP = 40;
const DEEP_SHADE = 0.55;
const CLOUD_FALLOFF = 0.35;
// The browser's transfer curve without the linear toe: close enough for a map, and the worker has no palette to call.
const GAMMA = 1 / 2.2;

export const MapLineKind = { HIGHWAY: "highway", STREET: "street", CIRCUIT: "circuit" } as const;
export type MapLineKind = (typeof MapLineKind)[keyof typeof MapLineKind];

export interface MapLine {
  kind: MapLineKind;
  closed: boolean;
  /** Interleaved world x, z. */
  points: Float32Array<ArrayBuffer>;
}

export interface MapMark {
  x: number;
  z: number;
  fx: number;
  fz: number;
  length: number;
}

export interface MapTown {
  x: number;
  z: number;
  radius: number;
  name: string;
}

/** World (x, z) lands on raster pixel (x + size / 2, z + size / 2) / size * (MAP_SIDE - 1). */
export interface MapData {
  seed: number;
  kind: WorldKind;
  size: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  lines: MapLine[];
  towns: MapTown[];
  jumps: MapMark[];
  /** Sky track boost pads; none on the island. */
  pads: MapMark[];
  checkpoints: MapMark[];
  start: MapMark;
}

/** `terrain` is the game's terrain LUT and `water` a linear RGB tone, both from the main thread's palette. */
export interface MapTones {
  terrain: Float32Array;
  water: [number, number, number];
  /** The cloud floor's tone, the sky track's backdrop. */
  cloud: [number, number, number];
}

function normalise([x, y, z]: [number, number, number]): [number, number, number] {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

const encode = (c: number) => Math.round(255 * Math.min(1, c) ** GAMMA);

function cloud_pixels(tones: MapTones): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(MAP_SIDE * MAP_SIDE * 4);
  const mid = (MAP_SIDE - 1) / 2;
  for (let j = 0; j < MAP_SIDE; j++)
    for (let i = 0; i < MAP_SIDE; i++) {
      const k = j * MAP_SIDE + i;
      const shade = 1 - CLOUD_FALLOFF * Math.min(1, Math.hypot(i - mid, j - mid) / mid);
      for (let c = 0; c < 3; c++) pixels[k * 4 + c] = encode(tones.cloud[c] * shade);
      pixels[k * 4 + 3] = 255;
    }
  return pixels;
}

export function map_pixels(data: WorldData, tones: MapTones): Uint8ClampedArray<ArrayBuffer> {
  if (data.kind === "sky") return cloud_pixels(tones);
  const heights = data.terrain.heights;
  const colors = terrain_colors(data, tones.terrain);
  const pixels = new Uint8ClampedArray(MAP_SIDE * MAP_SIDE * 4);
  const at = (i: number, j: number) => heights[Math.min(N, Math.max(0, j)) * MAP_SIDE + Math.min(N, Math.max(0, i))];
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const k = j * MAP_SIDE + i;
      const y = heights[k];
      let rgb: ArrayLike<number> = colors.subarray(k * 3, k * 3 + 3);
      let shade: number;
      if (y < 0) {
        rgb = tones.water;
        shade = 1 - (1 - DEEP_SHADE) * Math.min(1, -y / DEEP);
      } else {
        const [nx, ny, nz] = normalise([at(i - 1, j) - at(i + 1, j), 2 * CELL, at(i, j - 1) - at(i, j + 1)]);
        shade = Math.min(SHADE_MAX, Math.max(SHADE_MIN, (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / SUN[1]));
      }
      pixels[k * 4] = encode(rgb[0] * shade);
      pixels[k * 4 + 1] = encode(rgb[1] * shade);
      pixels[k * 4 + 2] = encode(rgb[2] * shade);
      pixels[k * 4 + 3] = 255;
    }
  return pixels;
}

function line(kind: MapLineKind, closed: boolean, points: { x: number; z: number }[]): MapLine {
  return { kind, closed, points: Float32Array.from(points.flatMap((p) => [p.x, p.z])) };
}

function pad_marks(data: WorldData): MapMark[] {
  const deck = data.deck;
  if (!deck) return [];
  return deck.pads.map((pad) => {
    const i = data.road.findIndex((_, k) => deck.line[k * DECK_STRIDE + 8] >= pad.s0);
    const p = data.road[i];
    return { x: p.x, z: p.z, fx: p.tx, fz: p.tz, length: pad.s1 - pad.s0 };
  });
}

export function map_data(data: WorldData, tones: MapTones): MapData {
  const circuit = new Set(data.circuit);
  const roads = data.graph.edges.filter((e) => !circuit.has(e.id)).map((e) => line(e.kind === "street" ? MapLineKind.STREET : MapLineKind.HIGHWAY, e.closed, e.points));
  const start = data.road[0];
  return {
    seed: data.terrain.seed,
    kind: data.kind,
    size: SIZE,
    pixels: map_pixels(data, tones),
    lines: [...roads, line(MapLineKind.CIRCUIT, true, data.road)],
    towns: data.towns.map(({ x, z, radius, name }) => ({ x, z, radius, name })),
    jumps: data.ramps.map((r) => ({ x: r.x, z: r.z, fx: r.fx, fz: r.fz, length: r.length })),
    pads: pad_marks(data),
    checkpoints: data.checkpoints.map((c) => ({ x: c.x, z: c.z, fx: Math.sin(c.heading), fz: Math.cos(c.heading), length: 0 })),
    start: { x: start.x, z: start.z, fx: start.tx, fz: start.tz, length: 0 },
  };
}

export function map_transfers(map: MapData): ArrayBuffer[] {
  return [map.pixels.buffer, ...map.lines.map((l) => l.points.buffer)];
}
