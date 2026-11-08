import { cell_range, vertex } from "./field";
import { smoothstep } from "./noise";
import { CELL, ORIGIN, ROAD_HALF, SHOULDER, type RoadEdge, type Terrain } from "./types";

const PAD_MARGIN = 5;
// A terrain triangle touching a road or pad has vertices up to CELL * sqrt(2) outside it; flattening that far keeps it
// under the surface mesh.
const FLAT = 6;

export class Stamp {
  private readonly road_height: Float32Array;
  private readonly owner_dist: Float32Array;
  readonly edge_of: Int32Array;

  constructor(private readonly terrain: Terrain) {
    this.road_height = new Float32Array(terrain.heights.length);
    this.edge_of = new Int32Array(terrain.heights.length).fill(-1);
    this.owner_dist = new Float32Array(terrain.heights.length).fill(1e9);
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
          }
        }
    }
  }

  blend() {
    const { heights, road_dist } = this.terrain;
    for (let k = 0; k < heights.length; k++) {
      if (this.owner_dist[k] > ROAD_HALF + SHOULDER) continue;
      const w = 1 - smoothstep(ROAD_HALF + FLAT, ROAD_HALF + SHOULDER, this.owner_dist[k]);
      heights[k] += (this.road_height[k] - 0.05 - heights[k]) * w;
    }
  }

  /** Flattens a rotated w x d pad to `y`, easing out over PAD_MARGIN and never pulling a road surface. Roads other than `own` keep their whole flat band. */
  pad(x: number, z: number, w: number, d: number, fx: number, fz: number, y: number, own: number) {
    const { heights, road_dist } = this.terrain;
    const reach = (w + d) / 2 + FLAT + PAD_MARGIN;
    const [i0, i1] = cell_range(x - reach, x + reach);
    const [j0, j1] = cell_range(z - reach, z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = ORIGIN + i * CELL - x;
        const dz = ORIGIN + j * CELL - z;
        const ox = Math.max(0, Math.abs(dx * fz - dz * fx) - w / 2);
        const oz = Math.max(0, Math.abs(dx * fx + dz * fz) - d / 2);
        const out = Math.sqrt(ox * ox + oz * oz);
        if (out >= FLAT + PAD_MARGIN) continue;
        const k = vertex(i, j);
        const keep_road = this.edge_of[k] === own ? smoothstep(ROAD_HALF + 0.5, ROAD_HALF + 2.5, road_dist[k]) : smoothstep(ROAD_HALF + FLAT, ROAD_HALF + FLAT + 2, road_dist[k]);
        heights[k] += (y - heights[k]) * (1 - smoothstep(FLAT, FLAT + PAD_MARGIN, out)) * keep_road;
      }
  }
}
