import { cell_range, vertex } from "./field";
import { smoothstep } from "./noise";
import { town_level } from "./towns";
import { CELL, ORIGIN, ROAD_HALF, SHOULDER, type RoadEdge, type Terrain, type Town } from "./types";

// Past `core` plus two cells every vertex a lot corner can touch is fully on the plane; the plane then eases back to
// terrain over PLATEAU_BLEND.
const PLATEAU_EDGE = CELL * 2;
const PLATEAU_BLEND = 40;
// A terrain triangle touching a road or pad has vertices up to CELL * sqrt(2) outside it; flattening that far keeps it
// under the surface mesh.
const FLAT = 6;

export class Stamp {
  private readonly road_height: Float32Array;
  readonly owner_dist: Float32Array;
  readonly edge_of: Int32Array;
  /** 1 where the owning edge is a town street, whose height is the town plane. */
  readonly street: Uint8Array;

  constructor(private readonly terrain: Terrain) {
    this.road_height = new Float32Array(terrain.heights.length);
    this.edge_of = new Int32Array(terrain.heights.length).fill(-1);
    this.owner_dist = new Float32Array(terrain.heights.length).fill(1e9);
    this.street = new Uint8Array(terrain.heights.length);
  }

  plateau(town: Town) {
    const { heights } = this.terrain;
    const full = town.core + PLATEAU_EDGE;
    const reach = full + PLATEAU_BLEND;
    const [i0, i1] = cell_range(town.x - reach, town.x + reach);
    const [j0, j1] = cell_range(town.z - reach, town.z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = ORIGIN + i * CELL;
        const z = ORIGIN + j * CELL;
        const d = Math.sqrt((x - town.x) * (x - town.x) + (z - town.z) * (z - town.z));
        if (d >= reach) continue;
        const k = vertex(i, j);
        const w = 1 - smoothstep(full, reach, d);
        heights[k] += (town_level(town, x, z) - heights[k]) * w;
      }
  }

  // Edges stamp in priority order (circuit, streets, spurs). A later edge never takes height over another edge's flat
  // band, so a spur meeting the sloped circuit merges into its surface instead of cutting a step across it.
  edge(edge: RoadEdge) {
    const { road_dist } = this.terrain;
    const { points, half } = edge;
    const reach = half + SHOULDER;
    const segments = edge.closed ? points.length : points.length - 1;
    for (let s = 0; s < segments; s++) {
      const a = points[s];
      const b = points[(s + 1) % points.length];
      const [i0, i1] = cell_range(Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach);
      const [j0, j1] = cell_range(Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const px = ORIGIN + i * CELL;
          const pz = ORIGIN + j * CELL;
          const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
          const ox = px - (a.x + dx * t);
          const oz = pz - (a.z + dz * t);
          const d = Math.sqrt(ox * ox + oz * oz) - half + ROAD_HALF;
          const k = vertex(i, j);
          if (d < road_dist[k]) road_dist[k] = d;
          const owned = this.edge_of[k] !== edge.id && this.owner_dist[k] <= ROAD_HALF + FLAT;
          if (d < this.owner_dist[k] && !owned) {
            this.owner_dist[k] = d;
            this.road_height[k] = a.y + (b.y - a.y) * t;
            this.edge_of[k] = edge.id;
            this.street[k] = edge.kind === "street" ? 1 : 0;
          }
        }
    }
  }

  blend() {
    const { heights, road_dist } = this.terrain;
    for (let k = 0; k < heights.length; k++) {
      // Streets have a flat cross-section but the plateau under them tilts; the plateau is already the street surface.
      if (this.owner_dist[k] > ROAD_HALF + SHOULDER || this.street[k]) continue;
      const w = 1 - smoothstep(ROAD_HALF + FLAT, ROAD_HALF + SHOULDER, this.owner_dist[k]);
      heights[k] += (this.road_height[k] - 0.05 - heights[k]) * w;
    }
  }
}
