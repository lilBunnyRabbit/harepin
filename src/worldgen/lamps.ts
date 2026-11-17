import { bounding_sphere, type Rgb, type Sphere } from "./mesh";
import { length } from "./noise";
import { PropKind, SIDEWALK, type Prop, type RoadEdge, type RoadNode, type RoadPoint, type Solid, type Town } from "./types";
import { atan2, cos, sin } from "../sim-math";

export type LampKind = typeof PropKind.STREET_LIGHT | typeof PropKind.ROAD_LAMP;

/** Half sizes in metres; the centre lies `reach` in front of the foot. */
export interface Pool {
  reach: number;
  across: number;
  along: number;
  strength: number;
}

export interface LampSpec {
  height: number;
  radius: number;
  pool: Pool;
}

export const LAMPS: Record<LampKind, LampSpec> = {
  [PropKind.STREET_LIGHT]: { height: 5.4, radius: 0.18, pool: { reach: 2.4, across: 5, along: 7, strength: 0.45 } },
  [PropKind.ROAD_LAMP]: { height: 10.6, radius: 0.25, pool: { reach: 2.9, across: 7.5, along: 10, strength: 0.2 } },
};

export const is_lamp = (prop: Prop): prop is Prop & { kind: LampKind } => Object.hasOwn(LAMPS, prop.kind);

export interface Lamps {
  props: Prop[];
  solids: Solid[];
}

export function put_lamp(out: Lamps, kind: LampKind, x: number, y: number, z: number, fx: number, fz: number) {
  out.props.push({ x, y, z, angle: atan2(fx, fz), kind, scale: 1 });
  out.solids.push({ kind: "circle", x, y, z, radius: LAMPS[kind].radius, height: LAMPS[kind].height });
}

const ROAD_EVERY = 48;
const ROAD_OUT = 2.2;
const ROAD_CLEAR = 1.5;
// Junction patches round their corners wider than the roads that meet there.
const NODE_CLEAR = 18;
// Roads are lit out of a town's rim and either way from a junction; between those they stay dark.
const TOWN_REACH = 160;
const NODE_REACH = 110;
const CELL = 16;

const key = (i: number, j: number) => i * 65536 + j;

interface Near {
  x: number;
  z: number;
  clear: number;
}

function edge_grid(edges: readonly RoadEdge[]): Map<number, Near[]> {
  const grid = new Map<number, Near[]>();
  for (const edge of edges) {
    const clear = edge.half + (edge.kind === "street" ? SIDEWALK + 1 : ROAD_CLEAR);
    for (const p of edge.points) {
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      const cell = grid.get(k);
      if (cell) cell.push({ x: p.x, z: p.z, clear });
      else grid.set(k, [{ x: p.x, z: p.z, clear }]);
    }
  }
  return grid;
}

function on_road(grid: Map<number, Near[]>, x: number, z: number): boolean {
  const i = Math.floor(x / CELL);
  const j = Math.floor(z / CELL);
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) for (const p of grid.get(key(i + di, j + dj)) ?? []) if ((p.x - x) ** 2 + (p.z - z) ** 2 < p.clear * p.clear) return true;
  return false;
}

export function near_solids(solids: readonly Solid[], pad: number): (x: number, z: number) => boolean {
  return (x, z) => solids.some((s) => length(s.x - x, s.z - z) < (s.kind === "circle" ? s.radius : length(s.hw, s.hd)) + pad);
}

export function near_stops(towns: readonly Town[], nodes: readonly RoadNode[]): (x: number, z: number) => boolean {
  const stops = nodes.filter((node) => node.kind !== "end");
  return (x, z) => towns.some((t) => length(t.x - x, t.z - z) < t.radius + TOWN_REACH) || stops.some((n) => length(n.x - x, n.z - z) < NODE_REACH);
}

/** `height` is the ground at a mast's foot, given the road point it stands beside: a plan with no grids has only the road's. */
export function road_lamps(
  graph: { nodes: readonly RoadNode[]; edges: readonly RoadEdge[] },
  lit: (x: number, z: number) => boolean,
  height: (x: number, z: number, beside: RoadPoint) => number,
  blocked: (x: number, z: number, beside: RoadPoint) => boolean,
): Lamps {
  const out: Lamps = { props: [], solids: [] };
  const grid = edge_grid(graph.edges);
  const patches = graph.nodes.filter((node) => node.kind !== "end");
  for (const edge of graph.edges) {
    if (edge.kind === "street") continue;
    let run = ROAD_EVERY / 2;
    let n = 0;
    for (let i = 1; i < edge.points.length; i++) {
      const p = edge.points[i];
      run += length(p.x - edge.points[i - 1].x, p.z - edge.points[i - 1].z);
      if (run < ROAD_EVERY) continue;
      run -= ROAD_EVERY;
      const side = n++ % 2 ? 1 : -1;
      const off = side * (edge.half + ROAD_OUT);
      const x = p.x - p.tz * off;
      const z = p.z + p.tx * off;
      if (!lit(p.x, p.z) || on_road(grid, x, z) || patches.some((node) => length(node.x - x, node.z - z) < NODE_CLEAR) || blocked(x, z, p)) continue;
      put_lamp(out, PropKind.ROAD_LAMP, x, height(x, z, p), z, p.tz * side, -p.tx * side);
    }
  }
  return out;
}

const POOL_CELLS = 8;
// Over every laid surface (`LIFT`), so one flat rise clears road, paving and paint alike.
const POOL_LIFT = 0.16;

export type PoolTones = Record<LampKind, Rgb>;

export interface Pools {
  positions: Float32Array<ArrayBuffer>;
  colors: Float32Array<ArrayBuffer>;
  index: Uint32Array<ArrayBuffer>;
  sphere: Sphere;
}

// No lamp is a light the renderer shades with: its light is this mesh, added over the ground it is draped on.
export function lamp_pools(props: readonly Prop[], tones: PoolTones, ground: (x: number, z: number) => number): Pools | undefined {
  const lamps = props.filter(is_lamp);
  if (!lamps.length) return undefined;
  const side = POOL_CELLS + 1;
  const positions = new Float32Array(lamps.length * side * side * 3);
  const colors = new Float32Array(positions.length);
  const index = new Uint32Array(lamps.length * POOL_CELLS * POOL_CELLS * 6);
  let v = 0;
  let t = 0;
  for (const lamp of lamps) {
    const { reach, across, along, strength } = LAMPS[lamp.kind].pool;
    const rgb = tones[lamp.kind];
    const dx = sin(lamp.angle);
    const dz = cos(lamp.angle);
    const cx = lamp.x + dx * reach;
    const cz = lamp.z + dz * reach;
    const base = v;
    for (let i = 0; i < side; i++)
      for (let j = 0; j < side; j++) {
        const a = (i / POOL_CELLS) * 2 - 1;
        const b = (j / POOL_CELLS) * 2 - 1;
        const x = cx + dx * a * across + dz * b * along;
        const z = cz + dz * a * across - dx * b * along;
        const lit = Math.max(0, 1 - a * a - b * b) ** 2 * strength;
        positions.set([x, ground(x, z) + POOL_LIFT, z], v * 3);
        colors.set([rgb[0] * lit, rgb[1] * lit, rgb[2] * lit], v * 3);
        v++;
      }
    for (let i = 0; i < POOL_CELLS; i++)
      for (let j = 0; j < POOL_CELLS; j++) {
        const k = base + i * side + j;
        index.set([k, k + side, k + 1, k + 1, k + side, k + side + 1], t);
        t += 6;
      }
  }
  return { positions, colors, index, sphere: bounding_sphere(positions) };
}
