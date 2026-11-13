import type { LavaPool } from "./lava";
import { circuit_route } from "./routes";
import { Stamp } from "./stamp";
import { CELL, ItemKind, N, ROAD_HALF, SIZE, SurfaceId, type Checkpoint, type Item, type Ramp, type RoadEdge, type RoadNode, type RoadPoint, type WorldData, type WorldKind } from "./types";

/** Height of the lab's flat ground: above the island biomes' beach, under their scree, so it reads as meadow. */
export const LAB_GROUND = 20;
const STEP = 2;
/** Bare ground's road distance: past every rule that reads it, so it grips as the own ground. */
const FAR = 1e4;
const CHECKPOINTS = 12;
const DEG = Math.PI / 180;

export const LabSurface = {
  ASPHALT: "asphalt",
  GRASS: "grass",
  SAND: "sand",
  DIRT: "dirt",
  HARDPACK: "hardpack",
  SCREE: "scree",
  WET: "wet",
  SNOW: "snow",
  PACKED_SNOW: "packed_snow",
  ICE: "ice",
  SLUSH: "slush",
} as const;
export type LabSurface = (typeof LabSurface)[keyof typeof LabSurface];

/** The grid id each painted surface lays; asphalt and grass lay nothing (road edge, own ground). */
const PAINT: Record<LabSurface, SurfaceId | null> = {
  asphalt: null,
  grass: null,
  sand: SurfaceId.SAND,
  dirt: SurfaceId.DIRT,
  hardpack: SurfaceId.HARDPACK,
  scree: SurfaceId.SCREE,
  wet: SurfaceId.WET,
  snow: SurfaceId.SNOW,
  packed_snow: SurfaceId.PACKED_SNOW,
  ice: SurfaceId.ICE,
  slush: SurfaceId.SLUSH,
};
const SURFACES = Object.values(LabSurface);

export const StationId = {
  HUB: "hub",
  SKIDPAD: "skidpad",
  RUNWAY: "runway",
  GRID: "grid",
  OVAL: "oval",
  BRAKE: "brake",
  SLALOM: "slalom",
  HAIRPIN: "hairpin",
  SWEEPER: "sweeper",
  DRIFT: "drift",
  EIGHT: "eight",
  KICKER: "kicker",
  LAVA: "lava",
  HILL: "hill",
} as const;
export type StationId = (typeof StationId)[keyof typeof StationId];

export interface LabSpot {
  x: number;
  z: number;
  heading: number;
}

/** A ring the car laps: laps count turns around its centre, `band` metres either side of `radius` is on it. */
export interface LabRing {
  x: number;
  z: number;
  radius: number;
  band: number;
}

/** A line across the lane at (x, z), crossed along (fx, fz); `hw` metres either side. */
export interface LabGate {
  x: number;
  z: number;
  fx: number;
  fz: number;
  hw: number;
}

export interface LabLane {
  /** Names the lane in a trial (`lane`) and the export; a surface, or a station's own name for the variant. */
  name: string;
  surface: LabSurface;
  spawn: LabSpot;
  ring?: LabRing;
  start?: LabGate;
  finish?: LabGate;
  /** The lane's centreline, coarse, and its half-width: farther off counts as off the lane. */
  path?: { points: readonly (readonly [number, number])[]; half: number };
}

export interface LabStation {
  id: StationId;
  lanes: LabLane[];
}

type Line = [number, number][];

interface Layout {
  stations: LabStation[];
  roads: { points: Line; half: number; closed: boolean }[];
  paints: { surface: SurfaceId; lines: Line[]; half: number }[];
  cones: [number, number][];
  ramps: Omit<Ramp, "id" | "y">[];
  lava: LavaPool[];
  oval: Line;
}

const spot = (x: number, z: number, fx: number, fz: number): LabSpot => ({ x, z, heading: Math.atan2(fx, fz) });

function resample(line: Line, closed = false): Line {
  const out: Line = [];
  const n = closed ? line.length : line.length - 1;
  for (let s = 0; s < n; s++) {
    const [ax, az] = line[s];
    const [bx, bz] = line[(s + 1) % line.length];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / STEP));
    for (let k = 0; k < steps; k++) out.push([ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps]);
  }
  if (!closed) out.push(line[line.length - 1]);
  return out;
}

function arc(cx: number, cz: number, r: number, from: number, to: number): Line {
  const steps = Math.max(2, Math.ceil((Math.abs(to - from) * r) / STEP));
  return Array.from({ length: steps + 1 }, (_, k): [number, number] => {
    const a = from + ((to - from) * k) / steps;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });
}

/** A disc of radius r painted from a zero-length line: the paint op reaches `half + CELL` round it. */
const disc = (x: number, z: number): Line => [
  [x, z],
  [x, z],
];

/** Every vertex row of an axis-aligned square, painted one cell thin so neighbouring squares meet on a cell's edge. */
function square(x0: number, z0: number, side: number): Line[] {
  const rows: Line[] = [];
  for (let z = z0 + CELL / 2; z < z0 + side; z += CELL) rows.push([
    [x0 + CELL / 2, z],
    [x0 + side - CELL / 2, z],
  ]);
  return rows;
}

const OVAL = { half_x: 880, half_z: 880, corner: 220 };
const SKIDPAD = { radius: 45, ring: 30, cone_step: 15 * DEG };
const RUNWAY = { x: 240, step: 20, z0: -260, z1: -780, half: 7 };
const GRID = { x: 340, z: 340, cell: 50, n: 8 };

function lay_out(): Layout {
  const out: Layout = { stations: [], roads: [], paints: [], cones: [], ramps: [], lava: [], oval: [] };
  const paint = (surface: LabSurface, lines: Line[], half: number) => {
    const id = PAINT[surface];
    if (id !== null) out.paints.push({ surface: id, lines, half });
  };
  const road = (points: Line, half: number, closed = false) => out.roads.push({ points: resample(points, closed), half, closed });
  const lane = (surface: LabSurface, points: Line, half: number) => (surface === LabSurface.ASPHALT ? road(points, half) : paint(surface, [resample(points)], Math.max(0, half - CELL)));
  const ring_cones = (x: number, z: number, r: number, step: number) => {
    for (let a = 0; a < 2 * Math.PI - 1e-9; a += step) out.cones.push([x + r * Math.cos(a), z + r * Math.sin(a)]);
  };
  const station = (id: StationId, lanes: LabLane[]) => out.stations.push({ id, lanes });

  const { half_x, half_z, corner } = OVAL;
  const oval: Line = [
    ...arc(half_x - corner, half_z - corner, corner, 0, Math.PI / 2),
    ...arc(-half_x + corner, half_z - corner, corner, Math.PI / 2, Math.PI),
    ...arc(-half_x + corner, -half_z + corner, corner, Math.PI, 1.5 * Math.PI),
    ...arc(half_x - corner, -half_z + corner, corner, 1.5 * Math.PI, 2 * Math.PI),
  ];
  const start = oval.findIndex(([x, z]) => x < 0 && z < 0);
  out.oval = resample([...oval.slice(start), ...oval.slice(0, start)], true);
  station(StationId.OVAL, [{ name: "asphalt", surface: LabSurface.ASPHALT, spawn: spot(-half_x, 400, 0, -1), ring: { x: 0, z: 0, radius: half_x, band: 200 } }]);
  station(StationId.BRAKE, [{ name: "asphalt", surface: LabSurface.ASPHALT, spawn: spot(half_x, -half_z + corner, 0, 1), start: { x: half_x, z: 200, fx: 0, fz: 1, hw: ROAD_HALF } }]);
  for (let z = 200; z <= 320; z += 10) out.cones.push([half_x - ROAD_HALF - 1, z], [half_x + ROAD_HALF + 1, z]);
  for (const z of [100, 150]) out.cones.push([half_x - ROAD_HALF - 1, z], [half_x - ROAD_HALF - 3, z]);

  road([[0, -60], [0, 60]], 60);
  station(StationId.HUB, [{ name: "asphalt", surface: LabSurface.ASPHALT, spawn: spot(0, 40, 0, -1) }]);

  const pads: LabLane[] = [];
  SURFACES.forEach((surface, k) => {
    const x = -720 + (k % 4) * 110;
    const z = -720 + Math.floor(k / 4) * 110;
    if (surface === LabSurface.ASPHALT) road([[x, z - SKIDPAD.radius], [x, z + SKIDPAD.radius]], SKIDPAD.radius);
    else paint(surface, [disc(x, z)], SKIDPAD.radius - CELL);
    ring_cones(x, z, SKIDPAD.ring + 4, SKIDPAD.cone_step);
    pads.push({ name: surface, surface, spawn: spot(x + SKIDPAD.ring, z, 0, -1), ring: { x, z, radius: SKIDPAD.ring, band: 6 } });
  });
  station(StationId.SKIDPAD, pads);

  const runs: LabLane[] = [];
  SURFACES.forEach((surface, k) => {
    const x = RUNWAY.x + k * RUNWAY.step;
    lane(surface, [[x, RUNWAY.z0], [x, RUNWAY.z1]], RUNWAY.half);
    out.cones.push([x - RUNWAY.step / 2, RUNWAY.z0 - 20], [x - RUNWAY.step / 2, RUNWAY.z0 - 420]);
    const gate = (z: number): LabGate => ({ x, z, fx: 0, fz: -1, hw: RUNWAY.half });
    runs.push({ name: surface, surface, spawn: spot(x, RUNWAY.z0 - 10, 0, -1), start: gate(RUNWAY.z0 - 20), finish: gate(RUNWAY.z0 - 420), path: { points: [[x, RUNWAY.z0], [x, RUNWAY.z1]], half: RUNWAY.half } });
  });
  station(StationId.RUNWAY, runs);

  const painted = SURFACES.filter((s) => PAINT[s] !== null);
  const by_surface = new Map<LabSurface, Line[]>();
  for (let j = 0; j < GRID.n; j++)
    for (let i = 0; i < GRID.n; i++) {
      const surface = painted[(i + 3 * j) % painted.length];
      by_surface.set(surface, [...(by_surface.get(surface) ?? []), ...square(GRID.x + i * GRID.cell, GRID.z + j * GRID.cell, GRID.cell)]);
    }
  for (const [surface, lines] of by_surface) paint(surface, lines, 0);
  road([[GRID.x - 12, GRID.z], [GRID.x - 12, GRID.z + GRID.n * GRID.cell]], 10);
  station(StationId.GRID, [{ name: "mixed", surface: LabSurface.ASPHALT, spawn: spot(GRID.x - 12, GRID.z + 10, 0, 1) }]);

  const slaloms: [LabSurface, number, string][] = [
    [LabSurface.ASPHALT, 18, "asphalt18"],
    [LabSurface.ASPHALT, 24, "asphalt"],
    [LabSurface.ASPHALT, 30, "asphalt30"],
    [LabSurface.DIRT, 24, "dirt"],
    [LabSurface.PACKED_SNOW, 24, "packed_snow"],
  ];
  station(
    StationId.SLALOM,
    slaloms.map(([surface, gap, name], k) => {
      const x = -720 + k * 80;
      lane(surface, [[x, 300], [x, 760]], 10);
      for (let z = 380; z <= 680; z += gap) out.cones.push([x, z]);
      const gate = (z: number): LabGate => ({ x, z, fx: 0, fz: 1, hw: 10 });
      return { name, surface, spawn: spot(x, 310, 0, 1), start: gate(360), finish: gate(700), path: { points: [[x, 300], [x, 760]], half: 10 } };
    }),
  );

  const hairpins = (surface: LabSurface, x0: number): LabLane => {
    const r = 12;
    const z0 = 360;
    const legs = 4;
    const line: Line = [[x0, 300]];
    for (let k = 0; k < legs; k++) {
      const x = x0 + k * 2 * r;
      const up = k % 2 === 0;
      line.push([x, up ? z0 : z0 + 80], [x, up ? z0 + 80 : z0]);
      if (k < legs - 1) line.push(...(up ? arc(x + r, z0 + 80, r, Math.PI, 0) : arc(x + r, z0, r, Math.PI, 2 * Math.PI)).slice(1, -1));
    }
    const x_end = x0 + (legs - 1) * 2 * r;
    line.push([x_end, 300]);
    lane(surface, line, ROAD_HALF);
    return { name: surface, surface, spawn: spot(x0, 304, 0, 1), start: { x: x0, z: z0, fx: 0, fz: 1, hw: ROAD_HALF }, finish: { x: x_end, z: z0, fx: 0, fz: -1, hw: ROAD_HALF }, path: { points: line.filter((_, i) => i % 8 === 0), half: ROAD_HALF } };
  };
  station(StationId.HAIRPIN, [hairpins(LabSurface.ASPHALT, -320), hairpins(LabSurface.DIRT, -200)]);

  const sweeper = (surface: LabSurface, r: number, from: number, name: string): LabLane => {
    const to = from + 120 * DEG;
    const line = arc(0, 0, r, from, to);
    lane(surface, line, 7);
    const at = (a: number, dir: number): LabGate => ({ x: r * Math.cos(a), z: r * Math.sin(a), fx: -Math.sin(a) * dir, fz: Math.cos(a) * dir, hw: 7 });
    const run_in = from - 10 * DEG;
    return { name, surface, spawn: spot(r * Math.cos(run_in), r * Math.sin(run_in), -Math.sin(from), Math.cos(from)), start: at(from + 5 * DEG, 1), finish: at(to - 5 * DEG, 1), ring: { x: 0, z: 0, radius: r, band: 7 } };
  };
  station(StationId.SWEEPER, [sweeper(LabSurface.ASPHALT, 120, 210 * DEG, "r120"), sweeper(LabSurface.ASPHALT, 200, 30 * DEG, "r200"), sweeper(LabSurface.HARDPACK, 150, -60 * DEG, "hardpack")]);

  const drift = (surface: LabSurface, x: number, z: number): LabLane => {
    lane(surface, [[x - 50, z], [x + 50, z]], 50);
    ring_cones(x, z, 20, 30 * DEG);
    return { name: surface, surface, spawn: spot(x + 20, z + 10, 0, -1), ring: { x, z, radius: 20, band: 8 } };
  };
  station(StationId.DRIFT, [drift(LabSurface.ASPHALT, -230, -690), drift(LabSurface.PACKED_SNOW, -90, -690)]);
  road([[-300, -560], [-160, -560]], 35);
  ring_cones(-250, -560, 6, 60 * DEG);
  ring_cones(-210, -560, 6, 60 * DEG);
  station(StationId.EIGHT, [{ name: "asphalt", surface: LabSurface.ASPHALT, spawn: spot(-230, -540, 1, 0) }]);

  const kickers: [string, Omit<Ramp, "id" | "y" | "x" | "z">][] = [
    ["small", { kind: "kicker", fx: 1, fz: 0, hw: 2.6, length: 8, rise: 2, grade: 0, landing: 45, speed: 21 }],
    ["big", { kind: "big", fx: 1, fz: 0, hw: 3.2, length: 14, rise: 4, grade: 0, landing: 80, speed: 27 }],
    ["drop", { kind: "kicker", fx: 1, fz: 0, hw: 2.6, length: 8, rise: 2, grade: 0, landing: 45, speed: 21, back: 0.25 }],
  ];
  station(
    StationId.KICKER,
    kickers.map(([name, ramp], k) => {
      const z = -420 + k * 40;
      const toe = -500;
      road([[-760, z], [toe, z]], 6);
      paint(LabSurface.DIRT, [resample([[toe, z], [-300, z]])], 8);
      out.ramps.push({ ...ramp, x: toe, z });
      return { name, surface: LabSurface.ASPHALT, spawn: spot(-750, z, 1, 0), start: { x: toe, z, fx: 1, fz: 0, hw: 8 }, finish: { x: -320, z, fx: 1, fz: 0, hw: 12 } };
    }),
  );

  const pool = { x: 150, z: 320, radius: 30, level: LAB_GROUND + 0.4 };
  out.lava.push(pool);
  paint(LabSurface.DIRT, [resample(arc(pool.x, pool.z, pool.radius + 6, 0, 2 * Math.PI), true)], 1);
  station(StationId.LAVA, [{ name: "dirt", surface: LabSurface.DIRT, spawn: spot(pool.x + pool.radius + 6, pool.z, 0, 1), ring: { x: pool.x, z: pool.z, radius: pool.radius + 6, band: 4 } }]);

  const hills: [string, LabSurface, number][] = [
    ["10", LabSurface.ASPHALT, 0.1],
    ["20", LabSurface.ASPHALT, 0.2],
    ["30", LabSurface.ASPHALT, 0.3],
    ["dirt20", LabSurface.DIRT, 0.2],
  ];
  station(
    StationId.HILL,
    hills.map(([name, surface, grade], k) => {
      const x = 560 + k * 60;
      const toe = -320;
      lane(surface, [[x, -200], [x, -460]], 8);
      out.ramps.push({ kind: "kicker", x, z: toe, fx: 0, fz: -1, hw: 6, length: 40, rise: 40 * grade, grade: 0, landing: 0, speed: 0, back: grade });
      return { name, surface, spawn: spot(x, -210, 0, -1), start: { x, z: toe, fx: 0, fz: -1, hw: 8 }, finish: { x, z: toe - 40, fx: 0, fz: -1, hw: 8 } };
    }),
  );
  return out;
}

/** Built once: the worker lays the world from it and the lab reads its spawns and gates, so both read one layout. */
export const LAB_LAYOUT: Readonly<Layout> = lay_out();
export const LAB_STATIONS: readonly LabStation[] = LAB_LAYOUT.stations;

const point = ([x, z]: readonly [number, number], next: readonly [number, number] | undefined, prev: readonly [number, number] | undefined): RoadPoint => {
  const [nx, nz] = next ?? [2 * x - (prev?.[0] ?? x), 2 * z - (prev?.[1] ?? z + 1)];
  const len = Math.hypot(nx - x, nz - z) || 1;
  return { x, y: LAB_GROUND, z, tx: (nx - x) / len, tz: (nz - z) / len };
};

const road_points = (line: Line, closed: boolean): RoadPoint[] => line.map((p, i) => point(p, closed ? line[(i + 1) % line.length] : line[i + 1], line[i - 1]));

/** The lab is the same for every seed: a pack link needs none, and every run drives the same ground. */
export function generate_lab(seed: number, kind: WorldKind): WorldData {
  const t0 = performance.now();
  const layout = LAB_LAYOUT;
  const heights = new Float32Array((N + 1) * (N + 1)).fill(LAB_GROUND);
  const road_dist = new Float32Array(heights.length).fill(FAR);
  const land = { seed, size: SIZE, cell: CELL, n: N, heights, road_dist, surface: new Uint8Array(heights.length) };
  const stamp = new Stamp(land);
  const road = road_points(layout.oval, true);
  const nodes: RoadNode[] = [{ id: 0, x: road[0].x, z: road[0].z, y: LAB_GROUND, kind: "junction" }];
  const edges: RoadEdge[] = [{ id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road }];
  for (const r of layout.roads) {
    const points = road_points(r.points, r.closed);
    const a = nodes.length;
    nodes.push({ id: a, x: points[0].x, z: points[0].z, y: LAB_GROUND, kind: "end" }, { id: a + 1, x: points[points.length - 1].x, z: points[points.length - 1].z, y: LAB_GROUND, kind: "end" });
    edges.push({ id: edges.length, a, b: a + 1, kind: "local", half: r.half, closed: r.closed, points });
  }
  for (const edge of edges) stamp.edge(edge);
  for (const p of layout.paints) stamp.paint(p.lines.map((line) => road_points(line, false)), p.half, p.surface);
  stamp.lava(layout.lava);
  const items: Item[] = layout.cones.map(([x, z]) => ({ kind: ItemKind.CONE, x, y: LAB_GROUND, z, fx: 0, fz: 1, scale: 1, light: true }));
  const ramps: Ramp[] = layout.ramps.map((r, id) => ({ ...r, id, y: LAB_GROUND }));
  const step = Math.floor(road.length / CHECKPOINTS);
  const checkpoints: Checkpoint[] = Array.from({ length: CHECKPOINTS }, (_, index) => {
    const p = road[index * step];
    return { x: p.x, y: p.y, z: p.z, heading: Math.atan2(p.tx, p.tz), index };
  });
  return {
    kind,
    deck: null,
    terrain: land,
    ground: { base: { kind: "flat", height: LAB_GROUND, road_dist: FAR }, ops: stamp.ops },
    graph: { nodes, edges },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: [],
    solids: [],
    ramps,
    items,
    challenges: [],
    checkpoints,
    circuit: [0],
    road,
    routes: [circuit_route(road, checkpoints)],
    canyon: null,
    timings: [[kind, performance.now() - t0]],
  };
}
