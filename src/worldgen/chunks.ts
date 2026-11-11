import { biome_cuts, ground_at, type BiomeCuts } from "./biomes";
import { CHUNK, CHUNKS, chunk_of } from "./chunk-grid";
import { sample, vertex_up } from "./field";
import { KINDS } from "./kinds/kinds";
import { landmark_mesh, type LandmarkTones } from "./landmark-mesh";
import { roof_rise } from "./lots";
import { Builder, bounding_sphere, turned, type Rgb, type Sphere } from "./mesh";
import { road_layers, type RoadTones } from "./road-layers";
import { grid_ground, Roads, type Layer } from "./roads";
import { deck_layers, type DeckTones } from "./sky-mesh";
import { hash } from "./noise";
import { ISLAND } from "./recipe";
import { CELL, Ground, N, ORIGIN, PropKind, Roof, SURFACE_GROUND, type Building, type ParkingLot, type Prop, type WorldData } from "./types";

const CHUNK_CELLS = CHUNK / CELL;
export const JITTER_LEVELS = 64;
export { Ground };
const SURFACES = Object.keys(Ground).length;
const ROCK_HALF = SURFACES;
const ROCK = 2 * SURFACES;
const SNOW = ROCK + 1;
export const TERRAIN_BASES = SNOW + 1;
// Deep enough to hide the crack where a half-res chunk edge skips the odd vertices of its full-res neighbour.
const SKIRT = 6;
export const SMALL_BUILDING = 6;

const SHOPFRONT_LOW = 0.5;
const SHOPFRONT_HIGH = 2.8;
const SHOPFRONT_INSET = 0.8;
const FACADE_OUT = 0.03;
const PANE = 2.4;
const MULLION = 0.2;
const PAD_LIFT = 0.06;
const LINE_LIFT = 0.09;
const LINE_HALF = 0.06;

/** Linear RGB, resolved from the palette on the main thread: the palette reads theme tokens from the DOM. */
export interface MeshTones extends RoadTones {
  /** Base-major, JITTER_LEVELS lightness steps per base: the Ground surfaces in order, each half-way to rock, rock, snow. */
  terrain: Float32Array;
  water: Rgb;
  walls: Rgb[];
  roofs: Rgb[];
  roof_flat: Rgb;
  landmark: LandmarkTones;
  deck: DeckTones;
}

export interface Soup {
  positions: Float32Array<ArrayBuffer>;
  colors: Float32Array<ArrayBuffer>;
  sphere: Sphere;
}

export interface ChunkBuffers {
  index: number;
  x0: number;
  z0: number;
  /** `index` holds the full-res triangles first, then the half-res ones; both include the edge skirt. */
  terrain: (Soup & { index: Uint16Array<ArrayBuffer>; full: number }) | null;
  /** Surface vertices first, then `marks`, which draw with a stronger polygon offset. */
  road: (Soup & { surface: number }) | null;
  /** Buildings of SMALL_BUILDING and up come first: a far chunk draws only the first `big` vertices. */
  buildings: (Soup & { big: number }) | null;
  glass: { positions: Float32Array<ArrayBuffer>; big: number; sphere: Sphere } | null;
  parking: Soup | null;
  /** Lake and river surface; left out where a chunk holds none, and on kinds that plan no water. */
  water?: Soup;
}

function jitter(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

/** Writes the colour of lattice vertex (i, j), cells counted from ORIGIN, at `colors[k * 3]`. */
export function paint(colors: Float32Array, k: number, lut: Float32Array, cuts: BiomeCuts, i: number, j: number, y: number, ny: number, surface: number) {
  const x = ORIGIN + i * CELL;
  const z = ORIGIN + j * CELL;
  const { beach, scree, rock, snow_line } = cuts.recipe.limits;
  let base: number = y < beach ? Ground.SAND : ground_at(cuts, x, z, y);
  if (ny < scree.up || y > scree.height) base = ny < rock.up || y > rock.height ? ROCK : base + ROCK_HALF;
  if (y > snow_line) base = SNOW;
  const laid = SURFACE_GROUND[surface];
  if (laid !== null) base = ny < rock.up ? ROCK : laid;
  const level = Math.min(JITTER_LEVELS - 1, Math.floor((jitter(i, j) + 0.5) * JITTER_LEVELS));
  const tone = (base * JITTER_LEVELS + level) * 3;
  colors[k * 3] = lut[tone];
  colors[k * 3 + 1] = lut[tone + 1];
  colors[k * 3 + 2] = lut[tone + 2];
}

export function terrain_colors(data: WorldData, lut: Float32Array): Float32Array {
  const { heights, seed, surface } = data.terrain;
  const cuts = biome_cuts(seed, heights, (KINDS[data.kind].recipe ?? ISLAND).biomes);
  const colors = new Float32Array((N + 1) * (N + 1) * 3);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      paint(colors, k, lut, cuts, i, j, heights[k], vertex_up(heights, i, j), surface[k]);
    }
  return colors;
}

function terrain_chunk(data: WorldData, all_colors: Float32Array, ci: number, cj: number): ChunkBuffers["terrain"] {
  const [x0, z0] = chunk_origin(ci + cj * CHUNKS);
  return terrain_mesh(data.terrain.heights, all_colors, N + 1, ci * CHUNK_CELLS, cj * CHUNK_CELLS, x0, z0);
}

/** One chunk's terrain from `heights` and `all_colors`, `row` vertices wide, its first vertex at (i0, j0) and (x0, z0). */
export function terrain_mesh(heights: Float32Array, all_colors: Float32Array, row: number, i0: number, j0: number, x0: number, z0: number): ChunkBuffers["terrain"] {
  const side = CHUNK_CELLS + 1;
  const skirt_start = side * side;
  const count = skirt_start + 4 * side;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const put = (v: number, i: number, j: number, drop: number) => {
    const k = (j0 + j) * row + i0 + i;
    positions.set([x0 + i * CELL, heights[k] - drop, z0 + j * CELL], v * 3);
    colors.set(all_colors.subarray(k * 3, k * 3 + 3), v * 3);
  };
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) put(j * side + i, i, j, 0);
  // Each edge walked so the skirt faces out of the chunk: +x along the low-z edge, +z along the high-x edge, and so on.
  const edges: [number, number][][] = [[], [], [], []];
  for (let t = 0; t < side; t++) {
    edges[0].push([t, 0]);
    edges[1].push([CHUNK_CELLS, t]);
    edges[2].push([CHUNK_CELLS - t, CHUNK_CELLS]);
    edges[3].push([0, CHUNK_CELLS - t]);
  }
  edges.forEach((edge, e) => edge.forEach(([i, j], t) => put(skirt_start + e * side + t, i, j, SKIRT)));

  const index: number[] = [];
  const surface = (step: number) => {
    for (let j = 0; j < CHUNK_CELLS; j += step)
      for (let i = 0; i < CHUNK_CELLS; i += step) {
        const a = j * side + i;
        const b = a + step;
        const c = a + step * side;
        const d = c + step;
        index.push(a, c, b, b, c, d);
      }
    edges.forEach((edge, e) => {
      for (let t = 0; t + step < side; t += step) {
        const p0 = edge[t][1] * side + edge[t][0];
        const p1 = edge[t + step][1] * side + edge[t + step][0];
        const s0 = skirt_start + e * side + t;
        const s1 = s0 + step;
        index.push(p0, p1, s0, p1, s1, s0);
      }
    });
  };
  surface(1);
  const full = index.length;
  surface(2);
  return { positions, colors, index: Uint16Array.from(index), full, sphere: bounding_sphere(positions.subarray(0, skirt_start * 3)) };
}

interface Town {
  big: Builder;
  small: Builder;
  glass_big: Builder;
  glass_small: Builder;
  parking: Builder;
}

function shopfront(out: Builder, hw: number, hd: number) {
  const w = hw - SHOPFRONT_INSET;
  const z = hd + FACADE_OUT;
  const panes = Math.max(1, Math.round((2 * w + MULLION) / (PANE + MULLION)));
  const pane = (2 * w - (panes - 1) * MULLION) / panes;
  const none: Rgb = [0, 0, 0];
  for (let p = 0; p < panes; p++) {
    const x0 = -w + p * (pane + MULLION);
    const x1 = x0 + pane;
    out.quad([x0, SHOPFRONT_LOW, z], [x1, SHOPFRONT_LOW, z], [x1, SHOPFRONT_HIGH, z], [x0, SHOPFRONT_HIGH, z], none);
  }
}

export interface TownParts {
  buildings: readonly Building[];
  props: readonly Prop[];
  parking: readonly ParkingLot[];
}

/** Town meshes keyed by `key(x, z)`, each part placed by its own position; `ground` drapes the parking pads. */
export function town_builders(data: WorldData, parts: TownParts, tones: MeshTones, ground: (x: number, z: number) => number, key_of: (x: number, z: number) => number): Map<number, Town> {
  const towns = new Map<number, Town>();
  const of = (x: number, z: number) => {
    const key = key_of(x, z);
    let town = towns.get(key);
    if (!town) {
      town = { big: new Builder(), small: new Builder(), glass_big: new Builder(), glass_small: new Builder(), parking: new Builder(undefined, ground) };
      towns.set(key, town);
    }
    return town;
  };
  const seed = data.terrain.seed;
  for (const b of parts.buildings) {
    const wall = tones.walls[b.style % tones.walls.length];
    const roof = tones.roofs[Math.floor(hash(b.lot, 0, seed + 81) * tones.roofs.length)];
    const rise = roof_rise(b);
    const town = of(b.x, b.z);
    const big = b.height + rise >= SMALL_BUILDING;
    const out = (big ? town.big : town.small).at(b);
    out.walls(b.hw, b.hd, -1, b.height, wall);
    if (data.lots[b.lot].kind === "shop") shopfront((big ? town.glass_big : town.glass_small).at(b), b.hw, b.hd);
    if (b.roof === Roof.GABLE || b.roof === Roof.STEEP) out.gable(b.hw, b.hd, b.height, rise, roof, wall);
    else if (b.roof === Roof.CROSS) out.at(turned(b)).gable(b.hd, b.hw, b.height, rise, roof, wall);
    else if (b.roof === Roof.HIP) {
      if (b.hw >= b.hd) out.hip(b.hw, b.hd, b.height, rise, roof);
      else out.at(turned(b)).hip(b.hd, b.hw, b.height, rise, roof);
    } else out.top(b.hw, b.hd, b.height, tones.roof_flat);
  }
  for (const prop of parts.props) if (prop.kind !== PropKind.STREET_LIGHT) landmark_mesh(of(prop.x, prop.z).big, prop, data.terrain.heights, tones.landmark);
  for (const lot of parts.parking) {
    const frame = data.lots[lot.lot];
    const out = of(frame.x, frame.z).parking.at(frame);
    out.top(lot.size.w / 2, lot.size.d / 2, PAD_LIFT, tones.asphalt);
    for (const bay of lot.bays) {
      const z0 = bay.z - bay.l / 2;
      const z1 = bay.z + bay.l / 2;
      for (const x of [bay.x - bay.w / 2, bay.x + bay.w / 2])
        out.quad([x - LINE_HALF, LINE_LIFT, z1], [x + LINE_HALF, LINE_LIFT, z1], [x + LINE_HALF, LINE_LIFT, z0], [x - LINE_HALF, LINE_LIFT, z0], tones.line);
    }
  }
  return towns;
}

export function town_meshes(town: Town | undefined): Pick<ChunkBuffers, "buildings" | "glass" | "parking"> {
  const buildings = town && soup([town.big, town.small]);
  const glass = town && soup([town.glass_big, town.glass_small]);
  return {
    buildings: town && buildings ? { ...buildings, big: town.big.vertices } : null,
    glass: town && glass ? { positions: glass.positions, sphere: glass.sphere, big: town.glass_big.vertices } : null,
    parking: (town && soup([town.parking])) ?? null,
  };
}

export function soup(layers: Layer[]): Soup | null {
  const positions = packed(layers.map((l) => l.positions));
  if (!positions.length) return null;
  return { positions, colors: packed(layers.map((l) => l.colors)), sphere: bounding_sphere(positions) };
}

function packed(parts: number[][]): Float32Array<ArrayBuffer> {
  const out = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function deck_chunks(data: WorldData, tones: MeshTones): (index: number) => ChunkBuffers | null {
  const surface: Layer[] = Array.from({ length: CHUNKS * CHUNKS }, () => ({ positions: [], colors: [] }));
  const marks: Layer[] = Array.from({ length: CHUNKS * CHUNKS }, () => ({ positions: [], colors: [] }));
  if (data.deck) deck_layers(data.deck, tones.deck, chunk_of, surface, marks);
  return (index) => {
    const road = soup([surface[index], marks[index]]);
    if (!road) return null;
    const [x0, z0] = chunk_origin(index);
    return { index, x0, z0, terrain: null, road: { ...road, surface: surface[index].positions.length / 3 }, buildings: null, glass: null, parking: null };
  };
}

function chunk_origin(index: number): [number, number] {
  return [ORIGIN + (index % CHUNKS) * CHUNK, ORIGIN + Math.floor(index / CHUNKS) * CHUNK];
}

/** The world-wide passes run once here; the returned builder meshes one chunk by index, null where it holds nothing. */
export function chunk_meshes(data: WorldData, tones: MeshTones): (index: number) => ChunkBuffers | null {
  if (!KINDS[data.kind].ground) return deck_chunks(data, tones);
  const colors = terrain_colors(data, tones.terrain);
  const roads = road_layers(data, new Roads(grid_ground(data.terrain.heights)), tones);
  const towns = town_builders(data, data, tones, (x, z) => sample(data.terrain.heights, x, z), (x, z) => chunk_of(x, z));
  return (index) => {
    const ci = index % CHUNKS;
    const cj = Math.floor(index / CHUNKS);
    const surface = roads.surface[index];
    const road = soup([surface, roads.marks[index]]);
    const [x0, z0] = chunk_origin(index);
    return {
      index,
      x0,
      z0,
      terrain: terrain_chunk(data, colors, ci, cj),
      road: road && { ...road, surface: surface.positions.length / 3 },
      ...town_meshes(towns.get(index)),
    };
  };
}

export function build_chunks(data: WorldData, tones: MeshTones): ChunkBuffers[] {
  const build = chunk_meshes(data, tones);
  const chunks: ChunkBuffers[] = [];
  for (let index = 0; index < CHUNKS * CHUNKS; index++) {
    const chunk = build(index);
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

export function chunk_transfers(chunks: ChunkBuffers[]): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const c of chunks) {
    if (c.terrain) out.push(c.terrain.positions.buffer, c.terrain.colors.buffer, c.terrain.index.buffer);
    for (const part of [c.road, c.buildings, c.parking, c.water]) if (part) out.push(part.positions.buffer, part.colors.buffer);
    if (c.glass) out.push(c.glass.positions.buffer);
  }
  return out;
}
