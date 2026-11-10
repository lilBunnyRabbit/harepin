import { plan_cuts, type BiomeCuts } from "./biomes";
import { chunk_corner, chunk_vertex, type Extent } from "./chunk-grid";
import { paint, soup, terrain_mesh, type ChunkBuffers, type MeshTones } from "./chunks";
import { build_tile } from "./ground";
import { KINDS } from "./kinds/kinds";
import { PLAN_CELL } from "./mainland";
import { plan_grid } from "./plan-grid";
import { ISLAND } from "./recipe";
import { road_junctions, road_layers, type Junctions } from "./road-layers";
import { Roads } from "./roads";
import { land_height } from "./terrain";
import { TILE_SIDE, TileStore, type Tile } from "./tiles";
import { CELL, type WorldData } from "./types";

// Past the desktop resident set (about 116 chunks), so a chunk streamed in at the ring edge finds its neighbours built.
const CACHE = 160;

export interface Built {
  tile: Tile;
  chunk: ChunkBuffers;
}

// Neighbour tiles are built too: road pieces binned to a chunk reach past its border.
export class TileMesher {
  private readonly store: TileStore;
  private readonly recent: number[] = [];
  private readonly cuts: BiomeCuts;
  private readonly junctions: Junctions;

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
  }

  build(index: number): Built {
    const { side } = this.ext;
    const ci = index % side;
    const cj = Math.floor(index / side);
    for (let j = Math.max(0, cj - 1); j <= Math.min(side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(side - 1, ci + 1); i++) this.tile(j * side + i);
    const tile = this.tile(index);
    const [x0, z0] = chunk_corner(index, this.ext);
    const roads = road_layers(this.data, new Roads(this.store, this.ext, index), this.tones, this.junctions);
    const road = soup([roads.surface[index], roads.marks[index]]);
    const chunk: ChunkBuffers = {
      index,
      x0,
      z0,
      terrain: terrain_mesh(tile.heights, this.colors(index, tile), TILE_SIDE, 0, 0, x0, z0),
      road: road && { ...road, surface: roads.surface[index].positions.length / 3 },
      buildings: null,
      glass: null,
      parking: null,
    };
    return { tile: { heights: tile.heights.slice(), road_dist: tile.road_dist.slice(), surface: tile.surface.slice() }, chunk };
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
