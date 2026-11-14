import { plan_cuts, plant_square, type BiomeCuts, type LandProbe, type Planted } from "./biomes";
import { CHUNK, chunk_corner, chunk_of, chunk_vertex, type Extent } from "./chunk-grid";
import { paint, soup, terrain_mesh, town_builders, town_meshes, type ChunkBuffers, type MeshTones } from "./chunks";
import { build_tile } from "./ground";
import { KINDS } from "./kinds/kinds";
import { PLAN_CELL } from "./mainland";
import { plan_grid } from "./plan-grid";
import { ISLAND } from "./recipe";
import { road_junctions, road_layers, road_layout, type Junctions, type RoadLayout } from "./road-layers";
import { Roads } from "./roads";
import { land_height } from "./terrain";
import { TILE_SIDE, TileStore, type Tile, type VectorOut } from "./tiles";
import { CELL, type Building, type Lot, type ParkingLot, type Prop, type Solid, type Tree, type WorldData } from "./types";
import { SEA_LEVEL, water_index, type WaterIndex } from "./water";
import { bounding_sphere } from "./mesh";

// Past the desktop resident set (about 116 chunks), so a chunk streamed in at the ring edge finds its neighbours built.
const CACHE = 160;

interface ChunkTown {
  lots: Lot[];
  buildings: Building[];
  props: Prop[];
  parking: ParkingLot[];
  trees: Tree[];
  solids: Solid[];
}

export interface Built {
  tile: Tile;
  chunk: ChunkBuffers;
  planted: Planted;
}

/** Water quads span this many lattice cells: low-poly, and the banks rise fast enough to hide the overhang. */
const WATER_STEP = 2;

const UP: VectorOut<number> = { set: (x, y, z) => y / Math.sqrt(x * x + y * y + z * z) };

// Neighbour tiles are built too: road pieces binned to a chunk reach past its border.
export class TileMesher {
  private readonly store: TileStore;
  private readonly recent: number[] = [];
  private readonly cuts: BiomeCuts;
  private readonly junctions: Junctions;
  private readonly layout: RoadLayout;
  private readonly probe: LandProbe;
  private readonly water: WaterIndex | null;
  private readonly towns = new Map<number, ChunkTown>();

  constructor(
    private readonly data: WorldData,
    private readonly ext: Extent,
    private readonly tones: MeshTones,
  ) {
    this.store = new TileStore(ext);
    const { base } = data.ground;
    const biomes = (KINDS[data.kind].recipe ?? ISLAND).biomes;
    const seed = data.terrain.seed;
    const height = base.kind === "terrain" ? land_height(base.seed, base.shape) : () => base.height;
    this.cuts = plan_cuts(seed, plan_grid(ext, PLAN_CELL, height), biomes);
    this.junctions = road_junctions(data);
    this.layout = road_layout(data, this.junctions, ext);
    const op = data.ground.ops.find((o) => o.kind === "water");
    this.water = op?.kind === "water" ? water_index(op.water) : null;
    const store = this.store;
    const town = (x: number, z: number) => {
      const key = chunk_of(x, z, ext);
      let parts = this.towns.get(key);
      if (!parts) this.towns.set(key, (parts = { lots: [], buildings: [], props: [], parking: [], trees: [], solids: [] }));
      return parts;
    };
    for (const lot of data.lots) if (lot.ground) town(lot.x, lot.z).lots.push(lot);
    for (const b of data.buildings) town(b.x, b.z).buildings.push(b);
    for (const p of data.props) town(p.x, p.z).props.push(p);
    for (const lot of data.parking) town(data.lots[lot.lot].x, data.lots[lot.lot].z).parking.push(lot);
    for (const t of data.trees) town(t.x, t.z).trees.push(t);
    for (const s of data.solids) town(s.x, s.z).solids.push(s);
    this.probe = { height: (x, z) => store.height(x, z), road_dist: (x, z) => store.road_dist(x, z), up: (x, z) => store.slope(x, z, UP) };
  }

  build(index: number): Built {
    const { side } = this.ext;
    const ci = index % side;
    const cj = Math.floor(index / side);
    for (let j = Math.max(0, cj - 1); j <= Math.min(side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(side - 1, ci + 1); i++) this.tile(j * side + i);
    const tile = this.tile(index);
    const [x0, z0] = chunk_corner(index, this.ext);
    const roads = road_layers(this.data, new Roads(this.store, this.ext, index), this.tones, this.junctions, this.layout);
    const road = soup([roads.surface[index], roads.marks[index]]);
    const here = this.towns.get(index);
    const chunk: ChunkBuffers = {
      index,
      x0,
      z0,
      terrain: terrain_mesh(tile.heights, this.colors(index, tile), TILE_SIDE, 0, 0, x0, z0),
      road: road && { ...road, surface: roads.surface[index].positions.length / 3 },
      ...town_meshes(here && town_builders(this.data, here, this.tones, (x, z) => this.store.height(x, z), () => index).get(index)),
    };
    const planted = plant_square(this.cuts, this.probe, x0, z0, CHUNK, (x, z) => !this.data.towns.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < t.radius * t.radius) && !this.wet(x, z));
    if (here) {
      planted.trees.push(...here.trees);
      planted.solids.push(...here.solids);
    }
    const water = this.water && this.surface(tile, x0, z0);
    if (water) chunk.water = water;
    return { tile: { heights: tile.heights.slice(), road_dist: tile.road_dist.slice(), surface: tile.surface.slice() }, chunk, planted };
  }

  private wet(x: number, z: number): boolean {
    return this.water !== null && this.water.level(x, z) > this.store.height(x, z) - 0.5;
  }

  // One flat quad per WATER_STEP cells wherever any corner is under water. A corner off the water takes the highest
  // level among the others, so a river's edge runs on into its rising bank instead of stepping.
  private surface(tile: Tile, x0: number, z0: number): ChunkBuffers["water"] {
    const water = this.water as WaterIndex;
    const side = (TILE_SIDE - 1) / WATER_STEP + 1;
    const levels = new Float32Array(side * side);
    for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) levels[j * side + i] = water.level(x0 + i * WATER_STEP * CELL, z0 + j * WATER_STEP * CELL);
    const positions: number[] = [];
    const corner = [0, 0, 0, 0];
    for (let j = 0; j < side - 1; j++)
      for (let i = 0; i < side - 1; i++) {
        const ks = [j * side + i, j * side + i + 1, (j + 1) * side + i + 1, (j + 1) * side + i];
        let top = -Infinity;
        for (const k of ks) top = Math.max(top, levels[k]);
        if (top === -Infinity) continue;
        let under = false;
        for (let c = 0; c < 4; c++) {
          const k = ks[c];
          const level = levels[k] === -Infinity ? top : levels[k];
          corner[c] = level;
          const ti = (k % side) * WATER_STEP;
          const tj = Math.floor(k / side) * WATER_STEP;
          if (tile.heights[tj * TILE_SIDE + ti] < level) under = true;
        }
        if (!under) continue;
        const xa = x0 + i * WATER_STEP * CELL;
        const za = z0 + j * WATER_STEP * CELL;
        const xb = xa + WATER_STEP * CELL;
        const zb = za + WATER_STEP * CELL;
        // A triangle no higher than the sea would lie on the sea plane, and two coplanar see-through surfaces flicker.
        if (Math.max(corner[0], corner[1], corner[2]) > SEA_LEVEL) positions.push(xa, corner[0], za, xb, corner[2], zb, xb, corner[1], za);
        if (Math.max(corner[0], corner[2], corner[3]) > SEA_LEVEL) positions.push(xa, corner[0], za, xa, corner[3], zb, xb, corner[2], zb);
      }
    if (!positions.length) return undefined;
    const colors = new Float32Array(positions.length);
    for (let v = 0; v < colors.length; v += 3) colors.set(this.tones.water, v);
    const packed = Float32Array.from(positions);
    return { positions: packed, colors, sphere: bounding_sphere(packed) };
  }

  private tile(index: number): Tile {
    const at = this.recent.indexOf(index);
    if (at >= 0) this.recent.splice(at, 1);
    else {
      this.store.add(index, build_tile(this.data.ground, index, this.ext));
      if (this.recent.length >= CACHE) this.store.drop(this.recent.shift() as number);
    }
    this.recent.push(index);
    return this.store.get(index) as Tile;
  }

  // Slope from the next vertex along each axis, as `vertex_up` reads the whole grid, so a border vertex shades alike from both sides.
  private colors(index: number, tile: Tile): Float32Array {
    const [i0, j0] = chunk_vertex(index, this.ext);
    const colors = new Float32Array(TILE_SIDE * TILE_SIDE * 3);
    for (let j = 0; j < TILE_SIDE; j++)
      for (let i = 0; i < TILE_SIDE; i++) {
        const k = j * TILE_SIDE + i;
        const y = tile.heights[k];
        const nx = y - this.store.vertex(i0 + i + 1, j0 + j);
        const nz = y - this.store.vertex(i0 + i, j0 + j + 1);
        paint(colors, k, this.tones.terrain, this.cuts, i0 + i, j0 + j, y, CELL / Math.sqrt(nx * nx + CELL * CELL + nz * nz), tile.surface[k]);
      }
    return colors;
  }
}
